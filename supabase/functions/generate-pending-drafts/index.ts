import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type TriggerReason =
  | "annual_review_due"
  | "aum_drop"
  | "overdue_touchpoint"
  | "stalled_prospect";

interface Primary {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
}

interface Trigger {
  source_key: string;
  reason: TriggerReason;
  context: string;
  household_id: string | null;
  prospect_id: string | null;
  // Recipient
  recipient_name: string;
  recipient_first_name: string;
  recipient_contact_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  // Defaults for the prompt
  kind: "email" | "text";
  subject_hint: string | null;
}

const SCHED_PLACEHOLDER = "[SCHEDULING_BUTTON]";

/**
 * When `withButton` is true, the prompt instructs the AI to drop the
 * scheduling-button placeholder between the body and the sign-off. The
 * frontend swaps the placeholder for a styled link to the advisor's
 * /book/:slug page on render. We pass it through as part of the prompt so
 * the AI doesn't have to know what the URL is.
 */
function buttonInstructions(withButton: boolean): string {
  if (!withButton) return "";
  return `\n- IMMEDIATELY BEFORE the sign-off paragraph, output a single line containing only the literal text ${SCHED_PLACEHOLDER} on its own line, separated by blank lines from the body and the sign-off. The system replaces this placeholder with a clickable scheduling button — do NOT write your own URL or "click here" text.`;
}

function bodyEndingInstructions(withButton: boolean, fallback: string): string {
  return withButton
    ? `Close the final body paragraph with a soft invitation to grab a time on the advisor's calendar (the scheduling button below it does the work — don't propose specific times).`
    : fallback;
}

function makePrompt(t: Trigger, withButton: boolean): string {
  switch (t.reason) {
    case "annual_review_due":
      return `Draft a short professional email from a financial advisor to ${t.recipient_first_name} (${t.recipient_name}) suggesting their upcoming annual review. Context: ${t.context}.

Formatting (CRITICAL):
- Separate every paragraph with a BLANK LINE.
- The sign-off paragraph is "Best,\\n[Advisor Name]" — leave the bracket placeholder exactly as written.${buttonInstructions(withButton)}

Content:
- Open with a warm greeting using "${t.recipient_first_name}".
- Acknowledge the review is coming up; don't be pushy.
- ${bodyEndingInstructions(
        withButton,
        `Suggest the client reply with two or three time windows that work for them in the next two to three weeks (don't propose specific times — let the client offer).`,
      )}
- 2 to 3 short paragraphs total in the body, then the sign-off paragraph.
- Plain prose, no markdown, no headers, no bullet lists.`;

    case "aum_drop":
      return `Draft a short, reassuring professional email from a financial advisor to ${t.recipient_first_name} (${t.recipient_name}). Context: ${t.context}.

Formatting (CRITICAL):
- Separate every paragraph with a BLANK LINE.
- The sign-off paragraph is "Best,\\n[Advisor Name]" — leave the bracket placeholder exactly as written.${buttonInstructions(withButton)}

Content:
- Open with "${t.recipient_first_name}" — warm but not alarmist.
- Acknowledge the recent market movement without specifics about exact dollar amounts or percentages (the advisor will personalize).
- Reinforce the long-term plan and the advisor's awareness.
- ${bodyEndingInstructions(
        withButton,
        `Offer a quick call if the client wants to talk through it; don't pressure.`,
      )}
- 2 to 4 short paragraphs total in the body, then the sign-off paragraph.
- Plain prose, no markdown, no headers, no bullet lists.`;

    case "overdue_touchpoint":
      return `Draft a short, friendly check-in email from a financial advisor to ${t.recipient_first_name} (${t.recipient_name}). Context: ${t.context}.

Formatting (CRITICAL):
- Separate every paragraph with a BLANK LINE.
- Sign-off paragraph is "Best,\\n[Advisor Name]".${buttonInstructions(withButton)}

Content:
- Open with "${t.recipient_first_name}".
- Acknowledge it's been a while since you connected.
- Make it feel personal and unhurried — not a transactional check-in.
- ${bodyEndingInstructions(
        withButton,
        `Suggest a quick conversation when convenient.`,
      )}
- 2 to 3 short paragraphs in the body, then the sign-off paragraph.
- Plain prose, no markdown.`;

    case "stalled_prospect":
      return `Draft a short, low-pressure re-engagement email from a financial advisor to ${t.recipient_first_name} (${t.recipient_name}), a prospect who has gone quiet. Context: ${t.context}.

Formatting (CRITICAL):
- Separate every paragraph with a BLANK LINE.
- Sign-off paragraph is "Best,\\n[Advisor Name]".${buttonInstructions(withButton)}

Content:
- Open with "${t.recipient_first_name}".
- Acknowledge it's been a bit since you last connected without making it feel like a guilt trip.
- Briefly remind them what you offered or last discussed.
- ${bodyEndingInstructions(
        withButton,
        `Invite a quick reply or call if there's still interest, with an explicit "no problem if not" out.`,
      )}
- 2 to 3 short paragraphs in the body, then the sign-off paragraph.
- Plain prose, no markdown.`;
  }
}

async function generateBodyAndSubject(
  t: Trigger,
  withBookingButton: boolean,
): Promise<{ subject: string | null; body: string }> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const userPrompt = makePrompt(t, withBookingButton);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 200)}`);
  }
  const json = await response.json();
  const body: string = (json.content?.[0]?.text ?? "").trim();
  if (!body) throw new Error("Empty completion");

  const subject = t.subject_hint ?? deriveSubject(t.reason, t.recipient_name);
  return { subject, body };
}

function titleFor(t: Trigger): string {
  switch (t.reason) {
    case "annual_review_due":
      return `Drafted annual review email for ${t.recipient_name}`;
    case "aum_drop":
      return `Drafted AUM-drop check-in for ${t.recipient_name}`;
    case "overdue_touchpoint":
      return `Drafted overdue touchpoint for ${t.recipient_name}`;
    case "stalled_prospect":
      return `Drafted re-engagement email for ${t.recipient_name}`;
  }
}

function deriveSubject(reason: TriggerReason, recipientName: string): string {
  switch (reason) {
    case "annual_review_due":
      return `Annual review check-in — ${recipientName}`;
    case "aum_drop":
      return `Quick note — ${recipientName}`;
    case "overdue_touchpoint":
      return `Touching base — ${recipientName}`;
    case "stalled_prospect":
      return `Following up — ${recipientName}`;
  }
}

// --- Trigger discovery ---------------------------------------------------

async function discoverAnnualReviewTriggers(
  admin: ReturnType<typeof createClient>,
  advisorId: string,
): Promise<Trigger[]> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + 30); // reviews coming up in next 30 days

  const { data, error } = await admin
    .from("households")
    .select("id, name, annual_review_date, household_members(id, first_name, last_name, email, phone, mobile_phone, relationship, archived_at)")
    .eq("advisor_id", advisorId)
    .is("archived_at", null)
    .not("annual_review_date", "is", null)
    .gte("annual_review_date", now.toISOString().split("T")[0])
    .lte("annual_review_date", cutoff.toISOString().split("T")[0]);
  if (error) throw error;

  const out: Trigger[] = [];
  for (const hh of (data ?? []) as any[]) {
    const primary = (hh.household_members ?? []).find(
      (m: any) => m.relationship === "Primary" && m.archived_at === null,
    ) as Primary | undefined;
    if (!primary) continue;

    const days = Math.max(
      0,
      Math.floor((new Date(hh.annual_review_date).getTime() - now.getTime()) / 86400000),
    );

    out.push({
      source_key: `annual_review_due:${hh.id}`,
      reason: "annual_review_due",
      context: `Annual review is ${days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`} (${hh.annual_review_date}).`,
      household_id: hh.id,
      prospect_id: null,
      recipient_name: hh.name,
      recipient_first_name: primary.first_name,
      recipient_contact_id: primary.id,
      recipient_email: primary.email,
      recipient_phone: primary.mobile_phone ?? primary.phone,
      kind: "email",
      subject_hint: null,
    });
  }
  return out;
}

async function discoverAumDropTriggers(
  admin: ReturnType<typeof createClient>,
  advisorId: string,
): Promise<Trigger[]> {
  // Look at the last 30 days of household snapshots and surface households
  // whose current AUM is materially lower than their 30-day-ago value.
  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);

  const { data: snaps, error } = await admin
    .from("household_snapshots")
    .select("household_id, snapshot_date, total_aum")
    .eq("advisor_id", advisorId)
    .gte("snapshot_date", thirty.toISOString().split("T")[0])
    .order("snapshot_date", { ascending: true });
  if (error) throw error;

  const byHh = new Map<string, { date: string; total_aum: number }[]>();
  for (const s of (snaps ?? []) as any[]) {
    const arr = byHh.get(s.household_id) ?? [];
    arr.push({ date: s.snapshot_date, total_aum: Number(s.total_aum) });
    byHh.set(s.household_id, arr);
  }

  const candidates: { householdId: string; dollarDrop: number; percentDrop: number }[] = [];
  byHh.forEach((arr, hhId) => {
    if (arr.length < 2) return;
    const sorted = [...arr].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const current = sorted[0].total_aum;
    const previous = sorted[sorted.length - 1].total_aum;
    const dollarDrop = previous - current;
    const percentDrop = previous > 0 ? (dollarDrop / previous) * 100 : 0;
    // Threshold: ≥$25k drop OR ≥6% drop, mirroring the dashboard scorecard
    // alert thresholds for the small/medium tiers.
    if (dollarDrop >= 25000 || percentDrop >= 6) {
      candidates.push({ householdId: hhId, dollarDrop, percentDrop });
    }
  });

  if (candidates.length === 0) return [];

  // Fetch household + primary contact info for the candidates.
  const ids = candidates.map((c) => c.householdId);
  const { data: households } = await admin
    .from("households")
    .select("id, name, household_members(id, first_name, last_name, email, phone, mobile_phone, relationship, archived_at)")
    .in("id", ids)
    .is("archived_at", null);

  const out: Trigger[] = [];
  for (const c of candidates) {
    const hh = (households ?? []).find((h: any) => h.id === c.householdId) as any;
    if (!hh) continue;
    const primary = (hh.household_members ?? []).find(
      (m: any) => m.relationship === "Primary" && m.archived_at === null,
    ) as Primary | undefined;
    if (!primary) continue;

    out.push({
      source_key: `aum_drop:${hh.id}`,
      reason: "aum_drop",
      context: `AUM down ~$${Math.round(c.dollarDrop).toLocaleString()} (-${c.percentDrop.toFixed(1)}%) over the last 30 days.`,
      household_id: hh.id,
      prospect_id: null,
      recipient_name: hh.name,
      recipient_first_name: primary.first_name,
      recipient_contact_id: primary.id,
      recipient_email: primary.email,
      recipient_phone: primary.mobile_phone ?? primary.phone,
      kind: "email",
      subject_hint: null,
    });
  }
  return out;
}

async function discoverOverdueTouchpointTriggers(
  admin: ReturnType<typeof createClient>,
  advisorId: string,
): Promise<Trigger[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await admin
    .from("touchpoints")
    .select("id, name, scheduled_date, household_id, households(id, name, household_members(id, first_name, last_name, email, phone, mobile_phone, relationship, archived_at))")
    .eq("advisor_id", advisorId)
    .eq("status", "upcoming")
    .lt("scheduled_date", today)
    .limit(10);
  if (error) throw error;

  const out: Trigger[] = [];
  for (const tp of (data ?? []) as any[]) {
    const hh = tp.households;
    if (!hh) continue;
    const primary = (hh.household_members ?? []).find(
      (m: any) => m.relationship === "Primary" && m.archived_at === null,
    ) as Primary | undefined;
    if (!primary) continue;

    const daysOverdue = Math.floor(
      (Date.now() - new Date(tp.scheduled_date).getTime()) / 86400000,
    );

    out.push({
      source_key: `overdue_touchpoint:${tp.id}`,
      reason: "overdue_touchpoint",
      context: `Touchpoint "${tp.name}" is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue.`,
      household_id: hh.id,
      prospect_id: null,
      recipient_name: hh.name,
      recipient_first_name: primary.first_name,
      recipient_contact_id: primary.id,
      recipient_email: primary.email,
      recipient_phone: primary.mobile_phone ?? primary.phone,
      kind: "email",
      subject_hint: null,
    });
  }
  return out;
}

async function discoverStalledProspectTriggers(
  admin: ReturnType<typeof createClient>,
  advisorId: string,
): Promise<Trigger[]> {
  const fourteen = new Date();
  fourteen.setDate(fourteen.getDate() - 14);

  // postgrest `in` filter wants `(a,b)` — bare tokens, no quotes. Quoted
  // strings get treated as literal characters and never match.
  const { data, error } = await admin
    .from("prospects")
    .select("id, first_name, last_name, email, phone, pipeline_stage, updated_at, company")
    .eq("advisor_id", advisorId)
    .not("pipeline_stage", "in", "(converted,lost)")
    .lt("updated_at", fourteen.toISOString())
    .order("updated_at", { ascending: true })
    .limit(5);
  if (error) throw error;

  const out: Trigger[] = [];
  for (const p of (data ?? []) as any[]) {
    const days = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / 86400000);
    const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Prospect";
    out.push({
      source_key: `stalled_prospect:${p.id}`,
      reason: "stalled_prospect",
      context: `Prospect (${p.pipeline_stage}) hasn't moved in ${days} days.`,
      household_id: null,
      prospect_id: p.id,
      recipient_name: fullName,
      recipient_first_name: p.first_name || fullName,
      recipient_contact_id: null,
      recipient_email: p.email,
      recipient_phone: p.phone,
      kind: "email",
      subject_hint: null,
    });
  }
  return out;
}

// --- Main handler --------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode the JWT and pull the user id from the claims (cheaper and
    // more reliable than auth.getUser(), which doesn't always pick up the
    // global Authorization header in v2 supabase-js).
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized", detail: claimsErr?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const advisorId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Discover triggers across all four reasons (in parallel).
    // Each discoverer is wrapped so a single missing table or schema gap
    // (e.g. `touchpoints` not yet created on this project) doesn't kill the
    // whole batch — we just lose that one trigger type.
    const safe = async <T>(p: Promise<T[]>, label: string): Promise<T[]> => {
      try {
        return await p;
      } catch (e: any) {
        console.warn(`[generate-pending-drafts] ${label} skipped:`, e?.message ?? e);
        return [];
      }
    };
    const [annual, aum, overdue, stalled] = await Promise.all([
      safe(discoverAnnualReviewTriggers(admin, advisorId), "annual_review_due"),
      safe(discoverAumDropTriggers(admin, advisorId), "aum_drop"),
      safe(discoverOverdueTouchpointTriggers(admin, advisorId), "overdue_touchpoint"),
      safe(discoverStalledProspectTriggers(admin, advisorId), "stalled_prospect"),
    ]);
    const triggers: Trigger[] = [...annual, ...aum, ...overdue, ...stalled];

    if (triggers.length === 0) {
      return new Response(JSON.stringify({ generated: 0, skipped: 0, triggers: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Dedupe against existing drafts. Pending drafts always block (already
    //    in the inbox). Sent/Dismissed drafts block until the per-reason
    //    cooldown elapses — this lets the advisor re-engage clients who
    //    didn't respond to the first draft, without regenerating the same
    //    draft on every Refresh.
    const COOLDOWN_DAYS: Record<TriggerReason, number> = {
      annual_review_due: 10,
      aum_drop: 14,
      overdue_touchpoint: 14,
      stalled_prospect: 21,
    };

    const sourceKeys = triggers.map((t) => t.source_key);
    const { data: existing } = await admin
      .from("pending_drafts")
      .select("source_key, status, sent_at, dismissed_at, created_at")
      .eq("advisor_id", advisorId)
      .in("source_key", sourceKeys);

    const recordsByKey = new Map<string, any[]>();
    for (const row of (existing ?? []) as any[]) {
      const arr = recordsByKey.get(row.source_key) ?? [];
      arr.push(row);
      recordsByKey.set(row.source_key, arr);
    }

    const now = Date.now();
    const blocked = new Set<string>();
    let pendingBlock = 0;
    let cooldownBlock = 0;
    for (const [key, rows] of recordsByKey) {
      if (rows.some((r) => r.status === "pending")) {
        blocked.add(key);
        pendingBlock++;
        continue;
      }
      const actions = rows
        .filter((r) => r.sent_at || r.dismissed_at)
        .map((r) => ({
          status: r.status as "sent" | "dismissed",
          ts: new Date((r.sent_at || r.dismissed_at) as string).getTime(),
        }))
        .sort((a, b) => b.ts - a.ts);
      if (actions.length === 0) continue;
      const reason = key.split(":")[0] as TriggerReason;
      const cooldown = COOLDOWN_DAYS[reason];
      if (!cooldown) continue;
      const ageDays = (now - actions[0].ts) / 86400000;
      if (ageDays < cooldown) {
        blocked.add(key);
        cooldownBlock++;
      }
    }

    const fresh = triggers.filter((t) => !blocked.has(t.source_key));

    // Booking settings — when enabled the AI is asked to drop a
    // [SCHEDULING_BUTTON] placeholder; the frontend swaps it for a styled
    // link to /book/:slug (or a meeting-type deep link) on render. When
    // disabled we omit the placeholder instruction entirely.
    const { data: bookingSettings } = await admin
      .from("advisor_booking_settings")
      .select("slug, enabled")
      .eq("advisor_id", advisorId)
      .maybeSingle();
    const withBookingButton = !!(bookingSettings && (bookingSettings as any).enabled);

    // For each trigger, find the meeting type that fits the reason so the
    // booking link can deep-link straight to the right type instead of the
    // full menu (e.g. annual_review_due → /book/:slug/annual-review). Falls
    // back to the generic page if no type matches.
    const PREFERRED_EVENT_TYPE: Record<TriggerReason, string | null> = {
      annual_review_due: "Annual Review",
      aum_drop: null,
      overdue_touchpoint: null,
      stalled_prospect: "Discovery Call",
    };
    const meetingTypes = withBookingButton
      ? (
          await admin
            .from("booking_meeting_types")
            .select("slug, event_type")
            .eq("advisor_id", advisorId)
            .eq("active", true)
        ).data ?? []
      : [];
    const buildBookingUrlPath = (t: Trigger): string | null => {
      if (!withBookingButton || !bookingSettings) return null;
      const baseSlug = (bookingSettings as any).slug as string;
      const preferred = PREFERRED_EVENT_TYPE[t.reason];
      let path = `/book/${baseSlug}`;
      if (preferred) {
        const match = (meetingTypes as any[]).find((m) => m.event_type === preferred);
        if (match) path = `/book/${baseSlug}/${match.slug}`;
      }
      // Append recipient prefill params so the confirm form lands populated.
      // The recipient already knows their own info — exposing it back to them
      // through the link is fine, and saves typing.
      const params = new URLSearchParams();
      if (t.recipient_name) params.set("n", t.recipient_name);
      if (t.recipient_email) params.set("e", t.recipient_email);
      if (t.recipient_phone) params.set("p", t.recipient_phone);
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path;
    };

    // 3. Generate drafts (sequential to avoid rate-limit spikes; small N).
    let generated = 0;
    const errors: { source_key: string; message: string }[] = [];
    for (const t of fresh) {
      try {
        const { subject, body } = await generateBodyAndSubject(t, withBookingButton);
        const { data: inserted, error: insErr } = await admin
          .from("pending_drafts")
          .insert({
            advisor_id: advisorId,
            household_id: t.household_id,
            prospect_id: t.prospect_id,
            trigger_reason: t.reason,
            trigger_context: t.context,
            kind: t.kind,
            subject,
            body,
            recipient_contact_id: t.recipient_contact_id,
            recipient_name: t.recipient_name,
            recipient_email: t.recipient_email,
            recipient_phone: t.recipient_phone,
            source_key: t.source_key,
            status: "pending",
            booking_url_path: buildBookingUrlPath(t),
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        generated++;

        // Emit an activity_event for the sidebar stream so the advisor sees
        // "Goodie drafted X for Y" without having to open the inbox. Failure
        // here shouldn't roll back the draft — the event is informational.
        try {
          await admin.from("activity_events").insert({
            advisor_id: advisorId,
            kind: "draft_generated",
            title: titleFor(t),
            body: t.context,
            household_id: t.household_id,
            prospect_id: t.prospect_id,
            related_record_id: (inserted as any)?.id ?? null,
            related_record_type: "pending_draft",
          });
        } catch (eventErr: any) {
          console.warn("activity_event insert failed:", eventErr?.message ?? eventErr);
        }
      } catch (e: any) {
        errors.push({ source_key: t.source_key, message: String(e?.message ?? e) });
      }
    }

    return new Response(
      JSON.stringify({
        generated,
        skipped: triggers.length - fresh.length,
        skipped_pending: pendingBlock,
        skipped_cooldown: cooldownBlock,
        triggers: triggers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    // Postgrest errors come through as plain objects ({ code, message,
    // details, hint }) — `String(e)` on those yields "[object Object]" and
    // hides the actual cause. Pull the message out manually.
    let message: string;
    if (e instanceof Error) {
      message = e.message;
    } else if (e && typeof e === "object") {
      message = e.message || e.error_description || e.error || JSON.stringify(e);
    } else {
      message = String(e);
    }
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("generate-pending-drafts error:", message, e, stack);
    return new Response(
      JSON.stringify({ error: message, raw: e, stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
