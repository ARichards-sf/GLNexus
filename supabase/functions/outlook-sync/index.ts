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
const SCOPES = "offline_access User.Read Mail.Read Mail.Send";
const INITIAL_LOOKBACK_DAYS = 30;
const PAGE_SIZE = 50;
const SAFETY_PAGE_LIMIT = 20;
const AI_BATCH_SIZE = 10;

type Folder = "inbox" | "sent";

type Connection = {
  advisor_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  inbox_delta_link: string | null;
  sent_delta_link: string | null;
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

    const advisorIds = await resolveAdvisors(req, admin);
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
      "advisor_id, refresh_token, access_token, access_token_expires_at, inbox_delta_link, sent_delta_link",
    )
    .eq("advisor_id", advisorId)
    .single();

  if (connErr || !conn) {
    throw new Error("No Outlook connection for this advisor");
  }

  const accessToken = await ensureAccessToken(conn as Connection, admin);

  const inboxResult = await syncFolder(
    admin, advisorId, "inbox", conn.inbox_delta_link, accessToken,
  );
  const sentResult = await syncFolder(
    admin, advisorId, "sent", conn.sent_delta_link, accessToken,
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
): Promise<string[]> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return [];

  let body: { all?: boolean; advisor_id?: string } = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* empty body is fine */ }
  }

  // Cron / fan-out — sync every connected advisor.
  if (body.all === true) {
    const { data, error } = await admin
      .from("outlook_connections")
      .select("advisor_id");
    if (error) {
      console.error("Failed to load connections for fan-out:", error);
      return [];
    }
    return (data ?? []).map((r) => r.advisor_id);
  }

  // Service-role with explicit advisor_id (admin / debugging).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader === `Bearer ${serviceKey}` && body.advisor_id) {
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
async function syncFolder(
  admin: SupabaseClient,
  advisorId: string,
  folder: Folder,
  storedDeltaLink: string | null,
  accessToken: string,
): Promise<{
  counts: { fetched: number; upserted: number };
  deltaLink: string | null;
}> {
  let url: string;
  if (storedDeltaLink) {
    url = storedDeltaLink;
  } else {
    const folderName = folder === "inbox" ? "inbox" : "sentitems";
    const since = new Date(
      Date.now() - INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const params = new URLSearchParams({
      "$filter": `receivedDateTime ge ${since}`,
      "$top": String(PAGE_SIZE),
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
    upserted += await upsertMessages(admin, advisorId, folder, page.value);

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
  contact_id: string;
  household_id: string;
  household_name: string;
  wealth_tier: string | null;
};

async function upsertMessages(
  admin: SupabaseClient,
  advisorId: string,
  folder: Folder,
  messages: GraphMessage[],
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

  const rows = live.map((m) => {
    const fromAddr = (m.from?.emailAddress?.address ??
      m.sender?.emailAddress?.address ?? "").toLowerCase();
    const fromName = m.from?.emailAddress?.name ??
      m.sender?.emailAddress?.name ?? null;

    const linkAddr = folder === "inbox"
      ? fromAddr
      : (m.toRecipients?.[0]?.emailAddress?.address ?? "").toLowerCase();
    const link = linkAddr ? contactByEmail.get(linkAddr) : null;

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
      body_html: m.body?.content ?? null,
      received_at: m.receivedDateTime ?? null,
      sent_at: m.sentDateTime ?? null,
      importance: m.importance ?? null,
      has_attachments: !!m.hasAttachments,
      is_read: !!m.isRead,
      web_link: m.webLink ?? null,
      contact_id: link?.contact_id ?? null,
      household_id: link?.household_id ?? null,
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

  const { data, error } = await admin
    .from("household_members")
    .select(
      "id, email, household_id, households!inner(advisor_id, name, wealth_tier)",
    )
    .in("email", addresses)
    .eq("households.advisor_id", advisorId);

  if (error) {
    console.error("loadContactsByEmail failed:", error);
    return out;
  }

  for (const row of (data ?? []) as Array<{
    id: string;
    email: string | null;
    household_id: string;
    households: { name: string; wealth_tier: string | null } | null;
  }>) {
    if (!row.email) continue;
    out.set(row.email.toLowerCase(), {
      contact_id: row.id,
      household_id: row.household_id,
      household_name: row.households?.name ?? "",
      wealth_tier: row.households?.wealth_tier ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// AI prioritization — batch unprocessed inbox messages through Claude.
// Hard rule: emails from senders not matched to a contact CANNOT be high or
// urgent. They top out at "normal" regardless of how time-sensitive the
// content is. This keeps vendor/system noise out of the priority inbox.
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

  const { data: pending, error } = await admin
    .from("email_messages")
    .select(
      "id, subject, from_email, from_name, body_preview, received_at, contact_id, household_id, importance",
    )
    .eq("advisor_id", advisorId)
    .eq("folder", "inbox")
    .is("ai_processed_at", null)
    .order("received_at", { ascending: false })
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
    const isClient = !!p.contact_id;
    const tier = p.household_id ? tierByHousehold.get(p.household_id) : null;
    const tag = isClient
      ? `[CLIENT — ${(tier ?? "untiered").toUpperCase()}]`
      : "[UNKNOWN SENDER — vendor or non-client]";
    return `--- Email ${i + 1} (id=${p.id}) ${tag} ---
From: ${p.from_name ?? ""} <${p.from_email ?? "?"}>
Subject: ${p.subject ?? "(no subject)"}
MS-Importance: ${p.importance ?? "normal"}
Preview: ${(p.body_preview ?? "").slice(0, 400)}`;
  }).join("\n\n");

  const system =
    `You triage a financial advisor's inbox. For each email, return JSON with priority, sentiment, summary, intent, and a suggested action.

PRIORITY (hard rules):
- urgent  — only for emails tagged [CLIENT] AND any of: explicit deadline, escalation, complaint, money movement, time-sensitive decision, expressed frustration. Platinum-tier clients get the benefit of the doubt; bump borderline cases up.
- high    — [CLIENT] emails asking a direct question, requesting work, or expressing concern. Platinum/gold tier outranks silver — when content is otherwise similar, platinum/gold should be high while silver is normal.
- normal  — routine [CLIENT] correspondence, FYI from a known client, or vendor/system emails that need eventual action (e.g. failed automation, billing).
- low     — newsletters, marketing, automated notifications without action needed.

CRITICAL: emails tagged [UNKNOWN SENDER] CANNOT be high or urgent. Cap them at normal regardless of how time-sensitive the content seems. The advisor cares about clients, not vendor noise.

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

    // Belt-and-suspenders: enforce the "unknown sender cannot be high/urgent"
    // rule on our side too, in case the model slips.
    let priority = ["urgent", "high", "normal", "low"].includes(r.priority)
      ? r.priority
      : "normal";
    if (!original.contact_id && (priority === "urgent" || priority === "high")) {
      priority = "normal";
    }

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

    // Activity events ONLY for known clients with priority high/urgent.
    // Vendor/system noise stays out of the activity stream.
    if (
      original.contact_id &&
      (priority === "urgent" || priority === "high")
    ) {
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
