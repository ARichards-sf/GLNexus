// Pulls new + changed messages from each connected advisor's Inbox and Sent
// Items via Microsoft Graph delta queries, persists them to email_messages,
// links senders/recipients to existing CRM records (with tier), then runs
// Claude over the unprocessed batch to assign priority + sentiment + intent.
//
// Trigger modes:
//   1. User JWT in Authorization header → syncs that user's connection
//   2. Service-role bearer + body { advisor_id } → syncs that advisor (admin)
//   3. Any valid bearer + body { all: true } → fans out to every connection
//      (this is what the 5-min pg_cron job uses)
//
// First sync per folder: pulls the last 30 days. Subsequent syncs use the
// stored deltaLink to fetch only changes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MS_AUTHORITY = "https://login.microsoftonline.com/common";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES =
  "offline_access User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite";
const INITIAL_LOOKBACK_DAYS = 30;
const PAGE_SIZE = 50;
const SAFETY_PAGE_LIMIT = 20;
const AI_BATCH_SIZE = 10;
// Hard cap on stored body_html. Outlook newsletters routinely come back
// 1–10 MB; without this we'd dump that into Postgres as TOAST and bloat
// row writes / replication. 1 MB keeps every realistic client email
// intact while truncating runaway HTML noise.
const MAX_BODY_BYTES = 1_000_000;
const TRUNCATION_MARKER =
  "\n\n<!-- [truncated by GLNexus — view the full message in Outlook] -->";

/** Clamp body HTML to MAX_BODY_BYTES; appends a truncation marker so
 *  consumers can tell the row was capped. Null in → null out. */
function clampBody(html: string | null | undefined): string | null {
  if (!html) return null;
  if (html.length <= MAX_BODY_BYTES) return html;
  const cutoff = MAX_BODY_BYTES - TRUNCATION_MARKER.length;
  return html.slice(0, Math.max(0, cutoff)) + TRUNCATION_MARKER;
}

type Folder = "inbox" | "sent";

type Connection = {
  advisor_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  inbox_delta_link: string | null;
  sent_delta_link: string | null;
  /** When the advisor first connected — initial sync uses this as the
   *  since-watermark so we don't pull mail from before they enabled the
   *  integration. */
  created_at: string;
};

type AdvisorResult = {
  advisor_id: string;
  inbox?: { fetched: number; upserted: number };
  sent?: { fetched: number; upserted: number };
  ai_processed?: number;
  error?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pre-parse body once so both action dispatch and resolveAdvisors can
    // read it. JSON re-parsing isn't supported on the Request stream.
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = await req.clone().json();
      } catch {
        // empty body OK
      }
    }

    // ------- action: rescan_contact ----------------------------------
    // Single-contact historical pull. Used when a new contact or
    // prospect is added with an email, so the advisor sees mail they
    // exchanged with that person before the CRM record existed.
    // Stored with is_historical=true so the AI prioritizer skips them.
    if (body.action === "rescan_contact") {
      const advisorIds = await resolveAdvisors(req, admin, body);
      if (!advisorIds.length) return json({ error: "Unauthorized" }, 401);
      const advisorId = advisorIds[0];
      try {
        const stored = await rescanContactMail(admin, advisorId, body);
        return json({ ok: true, stored });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`Rescan failed for ${advisorId}:`, msg);
        return json({ error: msg }, 500);
      }
    }

    // ------- default action: regular sync ----------------------------
    const advisorIds = await resolveAdvisors(req, admin, body);
    if (!advisorIds.length) return json({ error: "Unauthorized" }, 401);

    const results: AdvisorResult[] = [];
    for (const advisorId of advisorIds) {
      try {
        const r = await syncOneAdvisor(admin, advisorId);
        results.push({ advisor_id: advisorId, ...r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`Sync failed for ${advisorId}:`, msg);
        await admin
          .from("outlook_connections")
          .update({ last_sync_error: msg.slice(0, 500) })
          .eq("advisor_id", advisorId);
        results.push({ advisor_id: advisorId, error: msg });
      }
    }

    // Single-advisor calls return the flat shape the UI expects; multi-advisor
    // (cron) calls return the array.
    if (results.length === 1) {
      const r = results[0];
      return json(
        r.error
          ? { error: r.error }
          : { ok: true, inbox: r.inbox, sent: r.sent, ai_processed: r.ai_processed },
        r.error ? 500 : 200,
      );
    }
    return json({ ok: true, results }, 200);
  } catch (e) {
    console.error("outlook-sync error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});

async function syncOneAdvisor(
  admin: SupabaseClient,
  advisorId: string,
): Promise<{
  inbox: { fetched: number; upserted: number };
  sent: { fetched: number; upserted: number };
  ai_processed: number;
}> {
  const { data: conn, error: connErr } = await admin
    .from("outlook_connections")
    .select(
      "advisor_id, refresh_token, access_token, access_token_expires_at, inbox_delta_link, sent_delta_link, created_at",
    )
    .eq("advisor_id", advisorId)
    .single();

  if (connErr || !conn) {
    throw new Error("No Outlook connection for this advisor");
  }

  const accessToken = await ensureAccessToken(conn as Connection, admin);
  const connectedAt = (conn as Connection).created_at;

  const inboxResult = await syncFolder(
    admin, advisorId, "inbox", conn.inbox_delta_link, accessToken, connectedAt,
  );
  const sentResult = await syncFolder(
    admin, advisorId, "sent", conn.sent_delta_link, accessToken, connectedAt,
  );

  await admin
    .from("outlook_connections")
    .update({
      inbox_delta_link: inboxResult.deltaLink ?? conn.inbox_delta_link,
      sent_delta_link: sentResult.deltaLink ?? conn.sent_delta_link,
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
    })
    .eq("advisor_id", advisorId);

  const aiProcessed = await prioritizeUnprocessed(admin, advisorId);

  return {
    inbox: inboxResult.counts,
    sent: sentResult.counts,
    ai_processed: aiProcessed,
  };
}

// ---------------------------------------------------------------------------
// Auth resolution: returns a list of advisor IDs to sync.
// ---------------------------------------------------------------------------
async function resolveAdvisors(
  req: Request,
  admin: SupabaseClient,
  parsedBody?: Record<string, unknown>,
): Promise<string[]> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return [];

  const body = (parsedBody ?? {}) as { all?: boolean; advisor_id?: string };
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isServiceRole = authHeader === `Bearer ${serviceKey}`;

  // Cron / fan-out — sync every connected advisor. ONLY allowed for the
  // service-role bearer (the pg_cron job uses it). Without this gate, any
  // signed-in user could trigger a Graph + Claude run across every
  // connected mailbox in the project — pure cost amplifier.
  if (body.all === true) {
    if (!isServiceRole) {
      console.warn("Refused fan-out: caller is not service-role");
      return [];
    }
    const { data, error } = await admin
      .from("outlook_connections")
      .select("advisor_id")
      .eq("needs_reauth", false);
    if (error) {
      console.error("Failed to load connections for fan-out:", error);
      return [];
    }
    return (data ?? []).map((r) => r.advisor_id);
  }

  // Service-role with explicit advisor_id (admin / debugging).
  if (isServiceRole && body.advisor_id) {
    return [body.advisor_id];
  }

  // User JWT — derive advisor_id from the bearer.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  return user ? [user.id] : [];
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------
async function ensureAccessToken(
  conn: Connection,
  admin: SupabaseClient,
): Promise<string> {
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt > Date.now() + 60_000) {
    return conn.access_token;
  }

  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID")!;
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

  const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      scope: SCOPES,
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Microsoft signals "the user has to re-authorize" via invalid_grant —
    // typically consent revoked, password change, account disabled, or
    // 90-day idle. Retrying every 5 minutes won't help. Flip the flag so
    // the UI can prompt to reconnect, then surface a clean message
    // through last_sync_error.
    if (/invalid_grant/i.test(errText)) {
      await admin
        .from("outlook_connections")
        .update({
          needs_reauth: true,
          last_sync_error: "Outlook access expired — please reconnect.",
        })
        .eq("advisor_id", conn.advisor_id);
      throw new Error("OUTLOOK_NEEDS_REAUTH");
    }
    throw new Error(`Token refresh failed: ${res.status} ${errText}`);
  }

  const tok = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const newExpires = new Date(
    Date.now() + (tok.expires_in - 60) * 1000,
  ).toISOString();

  await admin
    .from("outlook_connections")
    .update({
      access_token: tok.access_token,
      access_token_expires_at: newExpires,
      ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
    })
    .eq("advisor_id", conn.advisor_id);

  return tok.access_token;
}

// ---------------------------------------------------------------------------
// Folder sync (delta query)
// ---------------------------------------------------------------------------
// Lightweight metadata fields fetched on every page. Body is intentionally
// excluded — we fetch it per-message later, only for rows whose sender or
// recipient matches a known contact/prospect on this advisor's book.
// Saves ~95% of Graph payload bytes and Postgres storage on noisy mailboxes.
const HEADERS_SELECT = [
  "id",
  "conversationId",
  "subject",
  "bodyPreview",
  "from",
  "sender",
  "toRecipients",
  "ccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "importance",
  "hasAttachments",
  "isRead",
  "webLink",
].join(",");

async function syncFolder(
  admin: SupabaseClient,
  advisorId: string,
  folder: Folder,
  storedDeltaLink: string | null,
  accessToken: string,
  connectedAt: string,
): Promise<{
  counts: { fetched: number; upserted: number };
  deltaLink: string | null;
}> {
  let url: string;
  if (storedDeltaLink) {
    url = storedDeltaLink;
  } else {
    const folderName = folder === "inbox" ? "inbox" : "sentitems";
    // Anchor the initial sync to when the advisor connected — never pull
    // mail older than that. Avoids surprise-importing years of history.
    const since = new Date(connectedAt).toISOString();
    const params = new URLSearchParams({
      "$filter": `receivedDateTime ge ${since}`,
      "$top": String(PAGE_SIZE),
      "$select": HEADERS_SELECT,
    });
    url = `${GRAPH}/me/mailFolders/${folderName}/messages/delta?${params}`;
  }

  let fetched = 0;
  let upserted = 0;
  let deltaLink: string | null = null;
  let pages = 0;

  while (url && pages < SAFETY_PAGE_LIMIT) {
    pages += 1;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="html"',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Graph delta query (${folder}) failed: ${res.status} ${errText}`,
      );
    }

    const page = await res.json() as {
      value: GraphMessage[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    };

    fetched += page.value.length;
    upserted += await upsertMessages(
      admin, advisorId, folder, page.value, accessToken,
    );

    if (page["@odata.deltaLink"]) {
      deltaLink = page["@odata.deltaLink"];
      break;
    }
    if (page["@odata.nextLink"]) {
      url = page["@odata.nextLink"];
      continue;
    }
    break;
  }

  return { counts: { fetched, upserted }, deltaLink };
}

/** Pulls the body for a single message — used after match filtering so we
 *  only spend bandwidth + storage on messages tied to a known person. */
async function fetchMessageBody(
  accessToken: string,
  graphId: string,
): Promise<string | null> {
  const res = await fetch(
    `${GRAPH}/me/messages/${graphId}?$select=body`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="html"',
      },
    },
  );
  if (!res.ok) return null;
  const j = await res.json() as { body?: { content?: string } };
  return j.body?.content ?? null;
}

type GraphRecipient = { emailAddress?: { address?: string; name?: string } };
type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  from?: GraphRecipient;
  sender?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  importance?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  webLink?: string;
  "@removed"?: { reason: string };
};

type ContactLink = {
  /** Set when the email matches a household_member row. */
  contact_id: string | null;
  /** Set when the email matches a household_member row. */
  household_id: string | null;
  /** Set when the email matches a prospect row instead. */
  prospect_id: string | null;
  /** For display + tier — household name when contact, prospect name fallback. */
  household_name: string;
  wealth_tier: string | null;
};

async function upsertMessages(
  admin: SupabaseClient,
  advisorId: string,
  folder: Folder,
  messages: GraphMessage[],
  accessToken: string,
): Promise<number> {
  if (!messages.length) return 0;

  const removed = messages.filter((m) => m["@removed"]).map((m) => m.id);
  if (removed.length) {
    await admin
      .from("email_messages")
      .delete()
      .eq("advisor_id", advisorId)
      .in("graph_message_id", removed);
  }

  const live = messages.filter((m) => !m["@removed"]);
  if (!live.length) return 0;

  // Build the address set for this batch and resolve them all at once
  // against household_members + prospects.
  const addressesNeeded = new Set<string>();
  for (const m of live) {
    const fromAddr = m.from?.emailAddress?.address ??
      m.sender?.emailAddress?.address;
    if (fromAddr) addressesNeeded.add(fromAddr.toLowerCase());
    for (const r of m.toRecipients ?? []) {
      const a = r.emailAddress?.address;
      if (a) addressesNeeded.add(a.toLowerCase());
    }
    for (const r of m.ccRecipients ?? []) {
      const a = r.emailAddress?.address;
      if (a) addressesNeeded.add(a.toLowerCase());
    }
  }

  const contactByEmail = await loadContactsByEmail(
    admin, advisorId, [...addressesNeeded],
  );

  // Decide which messages get their full body fetched. Inbox: match on
  // sender. Sent: match on first recipient. Anything that doesn't match
  // a known contact/prospect skips the body fetch entirely.
  const linkFor = (m: GraphMessage): { addr: string; link: ContactLink | null } => {
    const fromAddr = (m.from?.emailAddress?.address ??
      m.sender?.emailAddress?.address ?? "").toLowerCase();
    const linkAddr = folder === "inbox"
      ? fromAddr
      : (m.toRecipients?.[0]?.emailAddress?.address ?? "").toLowerCase();
    return { addr: linkAddr, link: linkAddr ? contactByEmail.get(linkAddr) ?? null : null };
  };

  // Fetch bodies in parallel for the matched subset only.
  const matched = live.filter((m) => linkFor(m).link);
  const bodyById = new Map<string, string | null>();
  if (matched.length) {
    const bodies = await Promise.all(
      matched.map((m) => fetchMessageBody(accessToken, m.id)),
    );
    matched.forEach((m, i) => bodyById.set(m.id, bodies[i]));
  }

  const rows = live.map((m) => {
    const fromAddr = (m.from?.emailAddress?.address ??
      m.sender?.emailAddress?.address ?? "").toLowerCase();
    const fromName = m.from?.emailAddress?.name ??
      m.sender?.emailAddress?.name ?? null;
    const { link } = linkFor(m);

    return {
      advisor_id: advisorId,
      graph_message_id: m.id,
      graph_conversation_id: m.conversationId ?? null,
      folder,
      from_email: fromAddr || null,
      from_name: fromName,
      to_recipients: (m.toRecipients ?? []).map(toJson),
      cc_recipients: (m.ccRecipients ?? []).map(toJson),
      subject: m.subject ?? null,
      body_preview: m.bodyPreview ?? null,
      // Body is only stored when the sender/recipient matches a known
      // contact or prospect — vendor mail keeps just the headers. Cap at
      // MAX_BODY_BYTES so a runaway newsletter can't bloat the row.
      body_html: link ? clampBody(bodyById.get(m.id) ?? null) : null,
      received_at: m.receivedDateTime ?? null,
      sent_at: m.sentDateTime ?? null,
      importance: m.importance ?? null,
      has_attachments: !!m.hasAttachments,
      is_read: !!m.isRead,
      web_link: m.webLink ?? null,
      contact_id: link?.contact_id ?? null,
      household_id: link?.household_id ?? null,
      prospect_id: link?.prospect_id ?? null,
      ai_processed_at: null,
    };
  });

  const { error } = await admin
    .from("email_messages")
    .upsert(rows, { onConflict: "advisor_id,graph_message_id" });

  if (error) {
    console.error("Upsert email_messages failed:", error);
    return 0;
  }
  return rows.length;
}

function toJson(r: GraphRecipient) {
  return {
    email: r.emailAddress?.address ?? null,
    name: r.emailAddress?.name ?? null,
  };
}

async function loadContactsByEmail(
  admin: SupabaseClient,
  advisorId: string,
  addresses: string[],
): Promise<Map<string, ContactLink>> {
  const out = new Map<string, ContactLink>();
  if (!addresses.length) return out;

  // Run member + prospect lookups in parallel. Members win when an email
  // matches both (real client > prospect record), so we fold members in last.
  const [membersResult, prospectsResult] = await Promise.all([
    admin
      .from("household_members")
      .select(
        "id, email, household_id, households!inner(advisor_id, name, wealth_tier)",
      )
      .in("email", addresses)
      .eq("households.advisor_id", advisorId),
    admin
      .from("prospects")
      .select("id, email, first_name, last_name")
      .in("email", addresses)
      .eq("advisor_id", advisorId),
  ]);

  if (prospectsResult.error) {
    console.error("loadContactsByEmail prospects failed:", prospectsResult.error);
  } else {
    for (const row of (prospectsResult.data ?? []) as Array<{
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    }>) {
      if (!row.email) continue;
      out.set(row.email.toLowerCase(), {
        contact_id: null,
        household_id: null,
        prospect_id: row.id,
        household_name:
          `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Prospect",
        wealth_tier: null,
      });
    }
  }

  if (membersResult.error) {
    console.error("loadContactsByEmail members failed:", membersResult.error);
    return out;
  }

  for (const row of (membersResult.data ?? []) as Array<{
    id: string;
    email: string | null;
    household_id: string;
    households: { name: string; wealth_tier: string | null } | null;
  }>) {
    if (!row.email) continue;
    out.set(row.email.toLowerCase(), {
      contact_id: row.id,
      household_id: row.household_id,
      prospect_id: null,
      household_name: row.households?.name ?? "",
      wealth_tier: row.households?.wealth_tier ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// AI prioritization — batch unprocessed CLIENT inbox messages through Claude.
// Hard rule: only emails matched to a known contact (contact_id IS NOT NULL)
// are ever prioritized. Vendor/system mail is left with ai_priority = null
// and never reaches the advisor's Priority Inbox.
// ---------------------------------------------------------------------------
async function prioritizeUnprocessed(
  admin: SupabaseClient,
  advisorId: string,
): Promise<number> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — skipping AI prioritization.");
    return 0;
  }

  // Order ASC so the backlog drains oldest-first. With DESC, a 50-email
  // burst leaves the older 40 permanently un-triaged because every
  // subsequent run picks the same newest 10.
  // is_historical filters out the rescan rows — those got stored for
  // timeline context only, no AI scoring.
  const { data: pending, error } = await admin
    .from("email_messages")
    .select(
      "id, subject, from_email, from_name, body_preview, received_at, contact_id, household_id, importance",
    )
    .eq("advisor_id", advisorId)
    .eq("folder", "inbox")
    .eq("is_historical", false)
    .not("contact_id", "is", null)
    .is("ai_processed_at", null)
    .order("received_at", { ascending: true })
    .limit(AI_BATCH_SIZE);

  if (error || !pending?.length) return 0;

  // Pull tier for any household referenced in the batch.
  const householdIds = [
    ...new Set(pending.map((p) => p.household_id).filter(Boolean) as string[]),
  ];
  const tierByHousehold = new Map<string, string | null>();
  if (householdIds.length) {
    const { data: hh } = await admin
      .from("households")
      .select("id, wealth_tier, name")
      .in("id", householdIds);
    for (const h of hh ?? []) {
      tierByHousehold.set(h.id, (h as { wealth_tier?: string }).wealth_tier ?? null);
    }
  }

  const summaries = pending.map((p, i) => {
    const tier = p.household_id ? tierByHousehold.get(p.household_id) : null;
    const tag = `[CLIENT — ${(tier ?? "untiered").toUpperCase()}]`;
    return `--- Email ${i + 1} (id=${p.id}) ${tag} ---
From: ${p.from_name ?? ""} <${p.from_email ?? "?"}>
Subject: ${p.subject ?? "(no subject)"}
MS-Importance: ${p.importance ?? "normal"}
Preview: ${(p.body_preview ?? "").slice(0, 400)}`;
  }).join("\n\n");

  const system =
    `You triage a financial advisor's inbox. Every email below is from a known client. Return JSON with priority, sentiment, summary, intent, and a suggested action.

PRIORITY:
- urgent  — explicit deadline, escalation, complaint, money movement, time-sensitive decision, or expressed frustration. Platinum-tier clients get the benefit of the doubt; bump borderline cases up.
- high    — direct question, request for work, or expressed concern. Platinum/gold outranks silver — when content is otherwise similar, platinum/gold should be high while silver is normal.
- normal  — routine correspondence, FYI from the client.
- low     — pure pleasantries, thank-you notes, or auto-generated bounces from the client's address.

SENTIMENT: one of positive, neutral, negative, frustrated. Use frustrated for explicit annoyance/anger/complaints; negative for worry, confusion, or dissatisfaction; positive for thanks/praise/excitement; neutral for everything else.

INTENT: one of question, request, scheduling, complaint, fyi, admin, marketing, other.

SUGGESTED ACTION: one short sentence the advisor can act on. Empty string for low priority or pure FYI.`;

  const user =
    `Triage these ${pending.length} emails. Respond with a JSON object: { "results": [ { "id": "<email id>", "priority": "...", "sentiment": "...", "score": 0-100, "summary": "...", "intent": "...", "suggested_action": "..." } ] }. Only include the JSON — no prose.

${summaries}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Claude prioritize failed:", res.status, t);
    return 0;
  }

  const data = await res.json() as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  const jsonText = extractJson(text);
  if (!jsonText) {
    console.error("No JSON in Claude response:", text.slice(0, 200));
    return 0;
  }

  let parsed: { results: Array<{
    id: string;
    priority: string;
    sentiment?: string;
    score: number;
    summary: string;
    intent: string;
    suggested_action: string;
  }> };
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error("Failed to parse Claude JSON:", e);
    return 0;
  }

  let updated = 0;
  for (const r of parsed.results ?? []) {
    const original = pending.find((p) => p.id === r.id);
    if (!original) continue;

    const priority = ["urgent", "high", "normal", "low"].includes(r.priority)
      ? r.priority
      : "normal";

    const sentiment = ["positive", "neutral", "negative", "frustrated"]
      .includes(r.sentiment ?? "")
      ? r.sentiment
      : "neutral";

    const { error: updErr } = await admin
      .from("email_messages")
      .update({
        ai_priority: priority,
        ai_priority_score: clamp(r.score, 0, 100),
        ai_sentiment: sentiment,
        ai_summary: r.summary?.slice(0, 1000) ?? null,
        ai_intent: r.intent?.slice(0, 50) ?? null,
        ai_suggested_action: r.suggested_action?.slice(0, 500) ?? null,
        ai_processed_at: new Date().toISOString(),
      })
      .eq("advisor_id", advisorId)
      .eq("id", r.id);

    if (updErr) {
      console.error("Failed to update email_messages:", updErr);
      continue;
    }
    updated += 1;

    if (priority === "urgent" || priority === "high") {
      await admin.from("activity_events").insert({
        advisor_id: advisorId,
        kind: "system",
        title: `${priority === "urgent" ? "Urgent" : "Priority"} email: ${
          original.subject ?? "(no subject)"
        }`,
        body: r.summary ?? null,
        related_record_id: r.id,
        related_record_type: "email_message",
        household_id: original.household_id ?? null,
      });
    }
  }
  return updated;
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return null;
}

function clamp(n: unknown, lo: number, hi: number): number {
  const v = typeof n === "number" ? n : 50;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Rescan: pull historical mail for a single email address (a newly-added
// contact or prospect). Stored with is_historical=true so the prioritizer
// skips them — they're for timeline context, not "act on this now."
// ---------------------------------------------------------------------------
const DEFAULT_RESCAN_LOOKBACK_DAYS = 90;
const MAX_RESCAN_LOOKBACK_DAYS = 365;
const RESCAN_PAGE_LIMIT = 5;

async function rescanContactMail(
  admin: SupabaseClient,
  advisorId: string,
  body: Record<string, unknown>,
): Promise<{ inbox: number; sent: number }> {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Missing 'email' in rescan request");

  const contactId = (body.contact_id as string | undefined) ?? null;
  const householdId = (body.household_id as string | undefined) ?? null;
  const prospectId = (body.prospect_id as string | undefined) ?? null;
  if (!contactId && !prospectId) {
    throw new Error("Rescan needs either contact_id or prospect_id");
  }

  const lookback = clamp(
    Number(body.lookback_days ?? DEFAULT_RESCAN_LOOKBACK_DAYS),
    1,
    MAX_RESCAN_LOOKBACK_DAYS,
  );

  const { data: conn, error: connErr } = await admin
    .from("outlook_connections")
    .select(
      "advisor_id, refresh_token, access_token, access_token_expires_at, inbox_delta_link, sent_delta_link, created_at",
    )
    .eq("advisor_id", advisorId)
    .single();
  if (connErr || !conn) {
    throw new Error("No Outlook connection — cannot rescan");
  }
  const accessToken = await ensureAccessToken(conn as Connection, admin);

  const since = new Date(
    Date.now() - lookback * 24 * 60 * 60 * 1000,
  ).toISOString();
  const safeEmail = email.replace(/'/g, "''");

  // Inbox: messages received from the contact's email.
  const inboxStored = await rescanFolder(admin, advisorId, accessToken, {
    folder: "inbox",
    odataFilter: `from/emailAddress/address eq '${safeEmail}' and receivedDateTime ge ${since}`,
    contactId, householdId, prospectId,
  });

  // Sent: messages sent TO the contact (any recipient on the to list).
  const sentStored = await rescanFolder(admin, advisorId, accessToken, {
    folder: "sent",
    odataFilter: `toRecipients/any(r:r/emailAddress/address eq '${safeEmail}') and sentDateTime ge ${since}`,
    contactId, householdId, prospectId,
  });

  return { inbox: inboxStored, sent: sentStored };
}

async function rescanFolder(
  admin: SupabaseClient,
  advisorId: string,
  accessToken: string,
  args: {
    folder: Folder;
    odataFilter: string;
    contactId: string | null;
    householdId: string | null;
    prospectId: string | null;
  },
): Promise<number> {
  const folderName = args.folder === "inbox" ? "inbox" : "sentitems";
  const params = new URLSearchParams({
    "$filter": args.odataFilter,
    "$top": String(PAGE_SIZE),
    // Full body on rescan — we know we want it (single-contact pull,
    // small N), so headers-only would just add a second roundtrip.
  });
  let url = `${GRAPH}/me/mailFolders/${folderName}/messages?${params}`;

  let stored = 0;
  let pages = 0;

  while (url && pages < RESCAN_PAGE_LIMIT) {
    pages += 1;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="html"',
      },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Rescan ${args.folder} failed: ${res.status} ${errText}`);
    }
    const page = await res.json() as {
      value: GraphMessage[];
      "@odata.nextLink"?: string;
    };

    if (page.value.length) {
      const rows = page.value.map((m) => {
        const fromAddr = (m.from?.emailAddress?.address ??
          m.sender?.emailAddress?.address ?? "").toLowerCase();
        const fromName = m.from?.emailAddress?.name ??
          m.sender?.emailAddress?.name ?? null;
        return {
          advisor_id: advisorId,
          graph_message_id: m.id,
          graph_conversation_id: m.conversationId ?? null,
          folder: args.folder,
          from_email: fromAddr || null,
          from_name: fromName,
          to_recipients: (m.toRecipients ?? []).map(toJson),
          cc_recipients: (m.ccRecipients ?? []).map(toJson),
          subject: m.subject ?? null,
          body_preview: m.bodyPreview ?? null,
          body_html: clampBody(m.body?.content ?? null),
          received_at: m.receivedDateTime ?? null,
          sent_at: m.sentDateTime ?? null,
          importance: m.importance ?? null,
          has_attachments: !!m.hasAttachments,
          is_read: !!m.isRead,
          web_link: m.webLink ?? null,
          contact_id: args.contactId,
          household_id: args.householdId,
          prospect_id: args.prospectId,
          // Mark sentinel-processed so the prioritizer skips it cleanly,
          // and is_historical=true so the explicit filter does too.
          is_historical: true,
          ai_processed_at: new Date().toISOString(),
          ai_priority: null,
        };
      });

      const { error } = await admin
        .from("email_messages")
        .upsert(rows, { onConflict: "advisor_id,graph_message_id" });
      if (error) {
        console.error("Rescan upsert failed:", error);
      } else {
        stored += rows.length;
      }
    }

    if (page["@odata.nextLink"]) {
      url = page["@odata.nextLink"];
      continue;
    }
    break;
  }

  return stored;
}
