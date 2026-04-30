// Generates a draft reply for a single email_messages row. The reply is
// tier-aware: tone calibrates to the linked household's wealth_tier, and a
// booking link is included when the original email's intent is scheduling
// (or when the AI deems a meeting useful).
//
// Auth: caller must have a Supabase user JWT for the advisor who owns the
// email. RLS on email_messages enforces ownership; we double-check after
// fetching.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

type Tier = "platinum" | "gold" | "silver" | null;

const TONE_BY_TIER: Record<string, string> = {
  platinum:
    "white-glove and deeply attentive — this is a top-tier client. Make them feel personally prioritized.",
  gold:
    "warm and attentive. Professional, with genuine care for the relationship.",
  silver:
    "courteous and respectful. Professional and helpful, slightly more concise.",
  untiered:
    "professional and warm. Treat them as a valued client.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({})) as {
      email_message_id?: string;
    };
    if (!body.email_message_id) {
      return json({ error: "email_message_id required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: email, error: emailErr } = await admin
      .from("email_messages")
      .select(`
        id, advisor_id, subject, body_preview, body_html, from_email, from_name,
        ai_intent, ai_summary, ai_suggested_action,
        contact_id, household_id,
        household_members!email_messages_contact_id_fkey(first_name, last_name),
        households(name, wealth_tier)
      `)
      .eq("id", body.email_message_id)
      .single();

    if (emailErr || !email) return json({ error: "Email not found" }, 404);
    if (email.advisor_id !== user.id) return json({ error: "Forbidden" }, 403);

    const { data: bookingSettings } = await admin
      .from("advisor_booking_settings")
      .select("slug, enabled")
      .eq("advisor_id", user.id)
      .maybeSingle();

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const advisorName = profile?.full_name ?? "Your Advisor";
    const appUrl = Deno.env.get("APP_URL") ?? "https://glnexus.vercel.app";

    const member = Array.isArray(email.household_members)
      ? email.household_members[0]
      : email.household_members;
    const household = Array.isArray(email.households)
      ? email.households[0]
      : email.households;

    // Pre-fill the recipient's email so the booking page resolves their tier
    // automatically (silver/gold/platinum availability filtering happens
    // server-side keyed off this email).
    const clientEmail = (member as { email?: string | null } | null)?.email
      ?? email.from_email
      ?? null;
    const bookingUrl =
      bookingSettings?.enabled && bookingSettings.slug
        ? clientEmail
          ? `${appUrl}/book/${bookingSettings.slug}?email=${encodeURIComponent(clientEmail)}`
          : `${appUrl}/book/${bookingSettings.slug}`
        : null;

    const tier = (household?.wealth_tier ?? null) as Tier;
    const tone = TONE_BY_TIER[tier ?? "untiered"] ?? TONE_BY_TIER.untiered;
    const recipientFirstName =
      member?.first_name ?? email.from_name?.split(" ")[0] ?? "there";

    const draft = await generateDraft({
      tone,
      tier,
      recipientFirstName,
      advisorName,
      originalSubject: email.subject ?? "(no subject)",
      originalBody: email.body_preview ?? "",
      aiIntent: email.ai_intent ?? null,
      aiSuggestedAction: email.ai_suggested_action ?? null,
      bookingUrl,
    });

    return json(draft, 200);
  } catch (e) {
    console.error("draft-email-reply error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});

const SCHED_PLACEHOLDER = "[SCHEDULING_BUTTON]";

async function generateDraft(input: {
  tone: string;
  tier: Tier;
  recipientFirstName: string;
  advisorName: string;
  originalSubject: string;
  originalBody: string;
  aiIntent: string | null;
  aiSuggestedAction: string | null;
  bookingUrl: string | null;
}): Promise<{ subject: string; body: string }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const bookingGuidance = input.bookingUrl
    ? `If the email asks to schedule a meeting, suggests a call, or the suggested action involves scheduling, output a single line containing only the literal token ${SCHED_PLACEHOLDER} on its own line. The system replaces this token with a styled "Schedule a meeting" button linking to ${input.bookingUrl}. The page already filters available times by the recipient's tier — you don't need to mention tiers. Lead the body paragraph just before the button with something like "Pick a time that works:" or "Here's my calendar." If the email isn't about scheduling, do NOT emit the token. Never write a raw URL.`
    : `(No booking page configured — do NOT include any scheduling link or token.)`;

  const tierLine = input.tier
    ? `Recipient is a ${input.tier.toUpperCase()}-tier client.`
    : `Recipient is an untiered client.`;

  const system =
    `You draft email replies on behalf of a financial advisor. Your reply must:
- Match the tone for the client's tier: ${input.tone}
- Be plain text, no markdown, no HTML.
- Use blank lines between paragraphs.
- Address the recipient by their first name on the opening line.
- 2 to 4 short paragraphs in the body, then a sign-off paragraph.
- Sign off as "Best,\\n${input.advisorName}".
- Don't quote the original email back at them.
- Don't include "Subject:" headers anywhere except the very first line.

${bookingGuidance}

Output format (CRITICAL):
First line: Subject: <reply subject, usually "Re: <original>">
Then a blank line.
Then the body, with paragraphs separated by blank lines${input.bookingUrl ? `, and the ${SCHED_PLACEHOLDER} token (if used) on its own line, surrounded by blank lines` : ""}.`;

  const user =
    `${tierLine}
Recipient first name: ${input.recipientFirstName}
Original subject: ${input.originalSubject}
Original message (preview):
${input.originalBody.slice(0, 1500)}

${input.aiIntent ? `Detected intent: ${input.aiIntent}` : ""}
${input.aiSuggestedAction ? `Suggested action for the advisor: ${input.aiSuggestedAction}` : ""}

Draft the reply now.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text?: string }>;
  };
  const raw = data.content.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!raw) throw new Error("Empty completion");

  const subjMatch = raw.match(/^Subject:\s*(.+?)(?:\r?\n|$)/i);
  let subject: string;
  let bodyText: string;
  if (subjMatch) {
    subject = subjMatch[1].trim();
    bodyText = raw.slice(subjMatch[0].length).replace(/^\s*\n+/, "");
  } else {
    subject = `Re: ${input.originalSubject}`;
    bodyText = raw;
  }

  return { subject, body: plainTextToHtml(bodyText, input.bookingUrl) };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Convert plain-text body (with optional [SCHEDULING_BUTTON] token) into the
// HTML the TipTap editor renders. The button uses class "email-button" so it
// matches the existing AI Drafts visual; outlook-send-reply rewrites that
// class to inline styles before dispatching to Graph.
function plainTextToHtml(text: string, bookingUrl: string | null): string {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return paragraphs
    .map((p) => {
      if (p === SCHED_PLACEHOLDER) {
        if (!bookingUrl) return "";
        return `<p><a href="${escapeHtml(bookingUrl)}" class="email-button" target="_blank" rel="noopener noreferrer">Schedule a meeting</a></p>`;
      }
      return `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
