import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

// Public booking edge function. Called by the unauthenticated /book/:slug
// pages with four actions:
//   - "get_page"      → advisor + active meeting types
//   - "resolve_email" → resolves an email to wealth_tier + display name so
//                       the booking page can filter slots & greet by name
//   - "get_slots"     → bookable slots for a (slug, type_slug, date), filtered
//                       by the booker's resolved wealth tier
//   - "book"          → creates calendar_event + emits activity event
//                       (re-validates the slot against the email's tier)
// Public read access is granted via RLS on the booking tables; writes use
// the service-role client inside this function.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Time-zone-aware helpers --------------------------------------------

/**
 * Convert a `YYYY-MM-DD` + `HH:MM` (interpreted in `tz`) to a UTC Date.
 * Implementation: build a naïve UTC instant from the local fields, ask
 * `Intl.DateTimeFormat` what *that* instant looks like in `tz`, then derive
 * the offset and shift accordingly. Avoids pulling in a tz library.
 */
function localToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const naiveUtc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0));

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(naiveUtc);
  const pv: Record<string, string> = {};
  for (const p of parts) pv[p.type] = p.value;

  const tzAsUtc = Date.UTC(
    Number(pv.year),
    Number(pv.month) - 1,
    Number(pv.day),
    Number(pv.hour) === 24 ? 0 : Number(pv.hour),
    Number(pv.minute),
  );
  const offsetMs = naiveUtc.getTime() - tzAsUtc;
  return new Date(naiveUtc.getTime() + offsetMs);
}

/** Returns 0–6 (Sunday–Saturday) for `dateStr` in `tz`. */
function dayOfWeekInTz(dateStr: string, tz: string): number {
  // Anchor at noon so DST transitions don't shift us into the wrong day.
  const utc = localToUtc(dateStr, "12:00", tz);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  });
  const wk = fmt.format(utc).slice(0, 3).toLowerCase();
  return ({ sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as Record<string, number>)[wk] ?? 0;
}

// --- Tier resolution -----------------------------------------------------

type ResolvedTier = "platinum" | "gold" | "silver" | null;

const TIER_LEVEL: Record<string, number> = {
  platinum: 3,
  gold: 2,
  silver: 1,
};

/** Numeric rank for comparing booker tier vs window's min_tier. NULL = 0. */
function tierLevel(t: string | null | undefined): number {
  if (!t) return 0;
  return TIER_LEVEL[t] ?? 0;
}

/**
 * Resolve a normalized email to the booker's wealth tier on this advisor's
 * book. Checks household_members → households first; falls back to prospects
 * (always tier 0). Returns null tier if no match — caller treats null as
 * "prospect / unknown" and only shows windows with min_tier IS NULL.
 */
async function resolveEmailToTier(
  admin: ReturnType<typeof createClient>,
  advisorId: string,
  email: string,
): Promise<{
  tier: ResolvedTier;
  display_name: string | null;
  household_id: string | null;
  prospect_id: string | null;
}> {
  if (!email) {
    return { tier: null, display_name: null, household_id: null, prospect_id: null };
  }

  const { data: memberMatch } = await admin
    .from("household_members")
    .select("id, household_id, first_name, last_name, household:households(name, wealth_tier)")
    .eq("advisor_id", advisorId)
    .eq("email", email)
    .is("archived_at", null)
    .maybeSingle();

  if (memberMatch) {
    const m: any = memberMatch;
    const tier = (m.household?.wealth_tier ?? null) as ResolvedTier;
    const display =
      m.household?.name ?? (`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || null);
    return {
      tier,
      display_name: display,
      household_id: m.household_id ?? null,
      prospect_id: null,
    };
  }

  const { data: prospectMatch } = await admin
    .from("prospects")
    .select("id, first_name, last_name")
    .eq("advisor_id", advisorId)
    .eq("email", email)
    .maybeSingle();

  if (prospectMatch) {
    const p: any = prospectMatch;
    return {
      tier: null,
      display_name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || null,
      household_id: null,
      prospect_id: p.id,
    };
  }

  return { tier: null, display_name: null, household_id: null, prospect_id: null };
}

// --- Slot calculation ---------------------------------------------------

interface AvailabilityWindow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  min_tier: string | null;
}

interface BusyEvent {
  start: Date;
  end: Date;
}

function generateSlots(args: {
  date: string;
  windows: AvailabilityWindow[];
  durationMin: number;
  bufferMin: number;
  tz: string;
  busy: BusyEvent[];
  advanceNoticeHours: number;
  maxPerDay: number;
  step?: number;
}): string[] {
  const step = args.step ?? args.durationMin;
  const durationMs = args.durationMin * 60_000;
  const bufferMs = args.bufferMin * 60_000;
  const minTime = Date.now() + args.advanceNoticeHours * 3_600_000;

  const dayStart = localToUtc(args.date, "00:00", args.tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
  const sameDayCount = args.busy.filter(
    (b) => b.start >= dayStart && b.start < dayEnd,
  ).length;
  if (sameDayCount >= args.maxPerDay) return [];

  const slots: string[] = [];
  for (const w of args.windows) {
    const winStart = localToUtc(args.date, w.start_time, args.tz);
    const winEnd = localToUtc(args.date, w.end_time, args.tz);
    let cur = new Date(winStart);
    while (cur.getTime() + durationMs <= winEnd.getTime()) {
      const slotStartMs = cur.getTime();
      const slotEndMs = slotStartMs + durationMs;
      // Advance notice
      if (slotStartMs >= minTime) {
        // Conflict check (with buffer on both sides)
        const conflictStart = slotStartMs - bufferMs;
        const conflictEnd = slotEndMs + bufferMs;
        const conflict = args.busy.some(
          (b) => b.start.getTime() < conflictEnd && b.end.getTime() > conflictStart,
        );
        if (!conflict) {
          slots.push(new Date(slotStartMs).toISOString());
        }
      }
      cur = new Date(cur.getTime() + step * 60_000);
    }
  }
  return slots;
}

// --- Handlers -----------------------------------------------------------

async function handleGetPage(
  admin: ReturnType<typeof createClient>,
  slug: string,
) {
  const { data: settings, error } = await admin
    .from("advisor_booking_settings")
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!settings) return json({ error: "not_found" }, 404);

  const { data: types } = await admin
    .from("booking_meeting_types")
    .select("id, slug, name, description, duration_minutes, event_type, color, sort_order")
    .eq("advisor_id", (settings as any).advisor_id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", (settings as any).advisor_id)
    .maybeSingle();

  return json({
    settings,
    meeting_types: types ?? [],
    advisor: {
      display_name: (profile as any)?.display_name ?? null,
      avatar_url: (profile as any)?.avatar_url ?? null,
    },
  });
}

async function handleResolveEmail(
  admin: ReturnType<typeof createClient>,
  slug: string,
  email: string,
) {
  const { data: settings } = await admin
    .from("advisor_booking_settings")
    .select("advisor_id")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (!settings) return json({ error: "not_found" }, 404);
  const advisorId = (settings as any).advisor_id;

  const resolved = await resolveEmailToTier(admin, advisorId, email.trim().toLowerCase());
  // Don't leak whether the email matched a household vs. prospect — frontend
  // only needs tier + greeting name.
  return json({
    tier: resolved.tier,
    display_name: resolved.display_name,
  });
}

async function handleGetSlots(
  admin: ReturnType<typeof createClient>,
  slug: string,
  typeSlug: string,
  date: string,
  email: string | null,
) {
  const { data: settings } = await admin
    .from("advisor_booking_settings")
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (!settings) return json({ error: "not_found" }, 404);
  const advisorId = (settings as any).advisor_id;
  const tz = (settings as any).time_zone as string;

  const { data: type } = await admin
    .from("booking_meeting_types")
    .select("*")
    .eq("advisor_id", advisorId)
    .eq("slug", typeSlug)
    .eq("active", true)
    .maybeSingle();
  if (!type) return json({ error: "type_not_found" }, 404);

  // Tier-aware filtering: resolve booker's email → tier, then drop windows
  // whose min_tier outranks the booker. Unknown emails (level 0) only see
  // windows with min_tier IS NULL.
  const resolved = email
    ? await resolveEmailToTier(admin, advisorId, email.trim().toLowerCase())
    : { tier: null as ResolvedTier };
  const bookerLevel = tierLevel(resolved.tier);

  const dow = dayOfWeekInTz(date, tz);
  const { data: windowsRaw } = await admin
    .from("advisor_availability_windows")
    .select("day_of_week, start_time, end_time, min_tier")
    .eq("advisor_id", advisorId)
    .eq("day_of_week", dow);
  const windows = (windowsRaw ?? []).filter(
    (w: any) => tierLevel(w.min_tier) <= bookerLevel,
  );
  if (windows.length === 0) return json({ slots: [], time_zone: tz });

  // Pull busy events for the day in the advisor's tz
  const dayStart = localToUtc(date, "00:00", tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
  const { data: events } = await admin
    .from("calendar_events")
    .select("start_time, end_time, status")
    .eq("advisor_id", advisorId)
    .neq("status", "cancelled")
    .gte("start_time", dayStart.toISOString())
    .lt("start_time", dayEnd.toISOString());
  const busy: BusyEvent[] = (events ?? []).map((e: any) => ({
    start: new Date(e.start_time),
    end: new Date(e.end_time),
  }));

  const slots = generateSlots({
    date,
    windows: windows as AvailabilityWindow[],
    durationMin: (type as any).duration_minutes,
    bufferMin: (settings as any).buffer_minutes,
    tz,
    busy,
    advanceNoticeHours: (settings as any).advance_notice_hours,
    maxPerDay: (settings as any).max_per_day,
    step: 30, // 30-min increments are the standard granularity
  });

  return json({ slots, time_zone: tz });
}

async function handleBook(
  admin: ReturnType<typeof createClient>,
  body: any,
) {
  const slug = body?.slug as string;
  const typeSlug = body?.type_slug as string;
  const startTime = body?.start_time as string; // UTC ISO
  const name = (body?.name as string ?? "").trim();
  const email = (body?.email as string ?? "").trim().toLowerCase();
  const phone = (body?.phone as string ?? "").trim() || null;
  const answer = (body?.answer as string ?? "").trim() || null;

  if (!slug || !typeSlug || !startTime || !name || !email) {
    return json({ error: "missing_fields" }, 400);
  }

  const { data: settings } = await admin
    .from("advisor_booking_settings")
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (!settings) return json({ error: "not_found" }, 404);
  const advisorId = (settings as any).advisor_id;
  const tz = (settings as any).time_zone as string;

  const { data: type } = await admin
    .from("booking_meeting_types")
    .select("*")
    .eq("advisor_id", advisorId)
    .eq("slug", typeSlug)
    .eq("active", true)
    .maybeSingle();
  if (!type) return json({ error: "type_not_found" }, 404);

  const start = new Date(startTime);
  const end = new Date(start.getTime() + (type as any).duration_minutes * 60_000);

  // Resolve email → tier for both linking + tier-aware slot validation.
  const resolved = await resolveEmailToTier(admin, advisorId, email);
  const bookerLevel = tierLevel(resolved.tier);

  // Re-validate the slot to defend against race conditions and tampering.
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
  const dow = dayOfWeekInTz(dateStr, tz);
  const { data: windowsRaw } = await admin
    .from("advisor_availability_windows")
    .select("day_of_week, start_time, end_time, min_tier")
    .eq("advisor_id", advisorId)
    .eq("day_of_week", dow);
  const windows = (windowsRaw ?? []).filter(
    (w: any) => tierLevel(w.min_tier) <= bookerLevel,
  );

  const dayStart = localToUtc(dateStr, "00:00", tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
  const { data: events } = await admin
    .from("calendar_events")
    .select("start_time, end_time")
    .eq("advisor_id", advisorId)
    .neq("status", "cancelled")
    .gte("start_time", dayStart.toISOString())
    .lt("start_time", dayEnd.toISOString());
  const busy: BusyEvent[] = (events ?? []).map((e: any) => ({
    start: new Date(e.start_time),
    end: new Date(e.end_time),
  }));
  const slots = generateSlots({
    date: dateStr,
    windows: windows as AvailabilityWindow[],
    durationMin: (type as any).duration_minutes,
    bufferMin: (settings as any).buffer_minutes,
    tz,
    busy,
    advanceNoticeHours: (settings as any).advance_notice_hours,
    maxPerDay: (settings as any).max_per_day,
    step: 30,
  });
  if (!slots.includes(start.toISOString())) {
    return json({ error: "slot_unavailable" }, 409);
  }

  // Use the already-resolved match for linking. If no household and no
  // prospect, fall through to the lightweight prospect creation below.
  let householdId: string | null = resolved.household_id;
  let prospectId: string | null = resolved.prospect_id;
  let recipientLabel = resolved.display_name ?? name;

  if (!householdId && !prospectId) {
    {
      // No existing contact — create a lightweight prospect so the advisor
      // can follow up. They can convert/merge later.
      const [firstName, ...rest] = name.split(/\s+/);
      const lastName = rest.join(" ") || "(unknown)";
      const { data: newProspect, error: insErr } = await admin
        .from("prospects")
        .insert({
          advisor_id: advisorId,
          first_name: firstName || name,
          last_name: lastName,
          email,
          phone,
          source: "Booking Page",
          pipeline_stage: "lead",
          notes: answer ?? null,
        } as any)
        .select("id")
        .single();
      if (insErr) {
        // Fall back to unlinked event if prospect insert fails (e.g. RLS,
        // column drift). Booking should still succeed in that case.
        console.warn("public-booking: prospect insert failed:", insErr.message);
      } else if (newProspect) {
        prospectId = (newProspect as any).id;
      }
    }
  }

  // Create the calendar_event
  const description = answer
    ? `Pre-meeting question:\n${(type as any).pre_meeting_question ?? "(see meeting type)"}\n\nResponse:\n${answer}`
    : null;
  const { data: createdEvent, error: eventErr } = await admin
    .from("calendar_events")
    .insert({
      advisor_id: advisorId,
      household_id: householdId,
      prospect_id: prospectId,
      title: `${(type as any).name} — ${recipientLabel}`,
      description,
      meeting_context: answer ?? null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      event_type: (type as any).event_type,
      status: "scheduled",
    } as any)
    .select("id, title, start_time, end_time")
    .single();
  if (eventErr) throw eventErr;

  // Emit activity event so the sidebar stream surfaces the booking.
  try {
    await admin.from("activity_events").insert({
      advisor_id: advisorId,
      kind: "system",
      title: `New meeting booked: ${(type as any).name} with ${recipientLabel}`,
      body: `${start.toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" })} (${tz})`,
      household_id: householdId,
      prospect_id: prospectId,
      related_record_id: (createdEvent as any).id,
      related_record_type: "calendar_event",
    });
  } catch (e: any) {
    console.warn("activity_event insert failed:", e?.message);
  }

  return json({
    event_id: (createdEvent as any).id,
    title: (createdEvent as any).title,
    start_time: (createdEvent as any).start_time,
    end_time: (createdEvent as any).end_time,
    time_zone: tz,
  });
}

// --- Main ----------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action =
      url.searchParams.get("action") ??
      (req.method === "GET" ? "get_page" : "book");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "get_page") {
      const slug = url.searchParams.get("slug") ?? "";
      if (!slug) return json({ error: "missing_slug" }, 400);
      return await handleGetPage(admin, slug);
    }
    if (action === "resolve_email") {
      const slug = url.searchParams.get("slug") ?? "";
      const email = url.searchParams.get("email") ?? "";
      if (!slug || !email) return json({ error: "missing_params" }, 400);
      return await handleResolveEmail(admin, slug, email);
    }
    if (action === "get_slots") {
      const slug = url.searchParams.get("slug") ?? "";
      const typeSlug = url.searchParams.get("type_slug") ?? "";
      const date = url.searchParams.get("date") ?? "";
      const email = url.searchParams.get("email"); // optional
      if (!slug || !typeSlug || !date) return json({ error: "missing_params" }, 400);
      return await handleGetSlots(admin, slug, typeSlug, date, email);
    }
    if (action === "book") {
      const body = await req.json().catch(() => ({}));
      return await handleBook(admin, body);
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("public-booking error:", message, e);
    return json({ error: message }, 500);
  }
});
