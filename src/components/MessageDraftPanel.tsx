import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Copy, Send, Sparkles, AtSign, Phone } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { streamChat } from "@/lib/aiChat";
import { useDraftPanel } from "@/contexts/DraftPanelContext";
import { useCreateComplianceNote } from "@/hooks/useHouseholds";
import { useMarkDraftSent } from "@/hooks/usePendingDrafts";
import { emitActivityEvent } from "@/hooks/useActivityEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/integrations/supabase/client";
import RichTextEditor from "@/components/RichTextEditor";

const SCHED_PLACEHOLDER = "[SCHEDULING_BUTTON]";

const TEXT_MAX = 320;

const DEFAULT_SUBJECT = (name: string) => `Following up — ${name}`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert plain text from the AI stream into paragraph-wrapped HTML so
 * TipTap renders it with the spacing the writer intended. Blank lines
 * (`\n\n+`) separate paragraphs; single `\n` inside a paragraph becomes a
 * line break (which mostly only matters for the sign-off block).
 *
 * If the text contains the `[SCHEDULING_BUTTON]` placeholder, we swap it
 * for a styled link to the advisor's booking page (when `bookingUrl` is
 * provided) or strip the placeholder entirely (when not). The class
 * `email-button` is styled in index.css to render as a button.
 */
function plainTextToHtml(text: string, bookingUrl?: string | null): string {
  if (!text) return "";
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return "";
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

function buildPrompt(opts: {
  kind: "email" | "text";
  recipientName: string;
  recipientFirstName?: string;
  reason: string;
  callToAction?: string;
  /** When true, instruct the AI to insert the scheduling-button placeholder. */
  withBookingButton?: boolean;
}): string {
  const {
    kind,
    recipientName,
    recipientFirstName,
    reason,
    callToAction = "schedule a brief call",
    withBookingButton = false,
  } = opts;

  if (kind === "email") {
    return `You are drafting a short, empathetic, professional EMAIL from a financial advisor to a client.

CLIENT: ${recipientName}${recipientFirstName ? ` (primary contact: ${recipientFirstName})` : ""}
REASON FOR OUTREACH: ${reason}
NEXT STEP TO PROPOSE: ${callToAction}

WRITE THE EMAIL BODY ONLY — do NOT include the subject line, do NOT include the recipient's email address, do NOT add quotation marks around the message.

Formatting (CRITICAL):
- Separate every paragraph with a BLANK LINE (one full empty line between paragraphs).
- The sign-off MUST be on its own paragraph, separated from the body by a blank line.
- Inside the sign-off paragraph, put "Best," on the first line, then a single newline, then "[Advisor Name]" on the next line. Leave the bracket placeholder exactly as written.${
      withBookingButton
        ? `
- IMMEDIATELY BEFORE the sign-off paragraph (and AFTER the body's final paragraph), output a single line containing only the literal text ${SCHED_PLACEHOLDER} on its own line, separated from the body and the sign-off by blank lines. The system replaces this placeholder with a clickable scheduling button.`
        : ""
    }

Content:
- Open with a warm but brief greeting using ${recipientFirstName || "the client's first name"} (no "Dear"). The greeting is its own paragraph.
- Acknowledge the situation directly without being alarmist.
- 2 to 4 short paragraphs total in the body${withBookingButton ? `, then the ${SCHED_PLACEHOLDER} placeholder line, then the sign-off paragraph` : ", then the sign-off paragraph"}.
- Close the final body paragraph with a soft invitation${withBookingButton ? ` to grab a time on your calendar (the system will append a clickable button below this paragraph — do NOT write your own URL or "click here" link)` : ` (e.g., "${callToAction}")`}.
- Plain prose, no markdown, no headers, no bullet lists.`;
  }

  return `You are drafting a brief professional SMS from a financial advisor to a client.

CLIENT: ${recipientName}${recipientFirstName ? ` (first name: ${recipientFirstName})` : ""}
REASON: ${reason}
NEXT STEP TO PROPOSE: ${callToAction}

Constraints:
- Under 280 characters total
- Friendly but professional
- Use ${recipientFirstName || "the client's first name"} once
- Suggest the next step (${callToAction})
- No emojis, no markdown, no quotation marks
- No advisor signature — SMS is implicitly attributed to the sender

Output ONLY the message text.`;
}

/**
 * Renders inside the AppLayout right sidebar when DraftPanelContext has an
 * active draft. Lets the advisor confirm AI-generated copy against the
 * household profile (which is visible in the main content area).
 */
export default function MessageDraftPanel() {
  const { draft, closeDraftPanel } = useDraftPanel();
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const createNote = useCreateComplianceNote();
  const markDraftSent = useMarkDraftSent();
  const advisorIdForBooking = user ? targetAdvisorId(user.id) : undefined;

  // Booking settings for the *current* advisor (or impersonation target).
  // When enabled, we instruct the AI to drop the scheduling-button
  // placeholder and swap it for a styled link on render.
  const { data: bookingSettings } = useQuery({
    queryKey: ["advisor_booking_settings", advisorIdForBooking],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advisor_booking_settings" as any)
        .select("slug, enabled")
        .eq("advisor_id", advisorIdForBooking!)
        .maybeSingle();
      if (error) throw error;
      return data as { slug: string; enabled: boolean } | null;
    },
    enabled: !!advisorIdForBooking,
    staleTime: 5 * 60 * 1000,
  });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const generationKey = useRef(0);
  // Plain-text accumulator for the AI stream. Email mode converts this to
  // HTML on each delta so TipTap renders proper paragraphs; SMS mode just
  // mirrors it directly into body.
  const rawStreamRef = useRef("");

  const isEmail = draft?.kind === "email";

  // Primary contact for the household. Outreach (email/text) is always
  // addressed to the Primary so the advisor sees the right name/email/phone
  // and the resulting compliance note tags the right contact's activity feed.
  const { data: primary, isFetched: primaryFetched } = useQuery({
    queryKey: ["draft_primary_contact", draft?.householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("id, first_name, last_name, email, phone, mobile_phone")
        .eq("household_id", draft!.householdId!)
        .eq("relationship", "Primary")
        .is("archived_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!draft?.householdId,
  });

  const primaryDisplayName = primary
    ? [primary.first_name, primary.last_name].filter(Boolean).join(" ").trim()
    : "";
  const primaryEmail = primary?.email ?? null;
  const primaryPhone = primary?.mobile_phone ?? primary?.phone ?? null;

  // Resolve the booking URL with this priority:
  //   1. draft.bookingUrlPath — when present (AI Inbox draft), the edge
  //      function already chose the meeting type that fits the trigger
  //      (e.g. annual review → /book/:slug/annual-review).
  //   2. Generic /book/:slug — for ad-hoc drafts where no specific type
  //      was selected.
  // We append ?email=<primary> so the recipient lands on the booking page
  // already identified — the booking page filters availability by their
  // wealth tier without making them retype anything.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = useMemo<string | null>(() => {
    if (!bookingSettings?.enabled || !bookingSettings.slug) return null;
    const base = draft?.bookingUrlPath
      ? `${origin}${draft.bookingUrlPath}`
      : `${origin}/book/${bookingSettings.slug}`;
    if (primaryEmail) {
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}email=${encodeURIComponent(primaryEmail)}`;
    }
    return base;
  }, [bookingSettings?.enabled, bookingSettings?.slug, draft?.bookingUrlPath, origin, primaryEmail]);

  const generate = () => {
    if (!draft) return;
    const myKey = ++generationKey.current;
    rawStreamRef.current = "";
    setBody("");
    setGenerating(true);

    const kind = draft.kind;
    // Prefer the freshly-fetched Primary first name so the AI greeting always
    // matches the contact, even if the caller didn't pass one.
    const firstName = primary?.first_name || draft.recipientFirstName;

    streamChat({
      messages: [
        {
          role: "user",
          content: buildPrompt({
            kind,
            recipientName: draft.recipientName,
            recipientFirstName: firstName,
            reason: draft.reason,
            callToAction: draft.callToAction,
            withBookingButton: kind === "email" && !!bookingUrl,
          }),
        },
      ],
      context: "",
      onDelta: (chunk) => {
        if (myKey !== generationKey.current) return;
        rawStreamRef.current += chunk;
        if (kind === "email") {
          setBody(plainTextToHtml(rawStreamRef.current, bookingUrl));
        } else {
          setBody(rawStreamRef.current);
        }
      },
      onToolCalls: () => {},
      onDone: () => {
        if (myKey !== generationKey.current) return;
        setGenerating(false);
      },
      onError: (msg) => {
        if (myKey !== generationKey.current) return;
        setGenerating(false);
        toast.error(`Draft failed: ${msg}`);
      },
    });
  };

  // Reset + regenerate whenever the draft target changes (or first opens).
  // Wait for the Primary contact query to settle (or be skipped, if there's
  // no household scope) so the AI prompt can use the correct first name on
  // its very first run instead of a generic "Hi there".
  // When the panel is opened from the AI Inbox (`prefillBody` set), use the
  // prebuilt copy verbatim instead of re-streaming a fresh draft.
  useEffect(() => {
    if (!draft) return;
    const primaryReady = !draft.householdId || primaryFetched;
    if (!primaryReady) return;
    if (draft.prefillBody) {
      // Older AI drafts can carry `Subject: <line>` baked into the body
      // (early prompts didn't separate the two). If we see that pattern,
      // hoist it to the subject and strip it from the body so it renders
      // correctly even for already-saved rows.
      const subjMatch = isEmail
        ? draft.prefillBody.match(/^\s*Subject:\s*(.+?)(?:\r?\n|$)/i)
        : null;
      const extractedSubject = subjMatch?.[1]?.trim();
      const cleanedBody = subjMatch
        ? draft.prefillBody.slice(subjMatch[0].length).replace(/^\s*\n+/, "")
        : draft.prefillBody;
      setSubject(
        isEmail
          ? extractedSubject ?? draft.prefillSubject ?? DEFAULT_SUBJECT(draft.recipientName)
          : "",
      );
      // Prefill is plain text (the way the edge function stores it); convert
      // to TipTap-friendly HTML for email mode, mirror as-is for SMS.
      setBody(isEmail ? plainTextToHtml(cleanedBody, bookingUrl) : cleanedBody);
      setGenerating(false);
      return;
    }
    setSubject(isEmail ? draft.prefillSubject ?? DEFAULT_SUBJECT(draft.recipientName) : "");
    setBody("");
    generate();
    return () => {
      // Cancel any in-flight stream when this panel unmounts or draft changes
      generationKey.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.kind, draft?.recipientName, draft?.reason, draft?.pendingDraftId, draft?.bookingUrlPath, primaryFetched, bookingUrl]);

  if (!draft) return null;

  // HTML → plain text that preserves paragraph and line breaks, for the
  // clipboard / mock-send paths. textContent collapses everything; this
  // does the right thing for the limited tag set TipTap produces.
  const stripHtml = (html: string): string => {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<\/?p[^>]*>/gi, "")
      .replace(/<\/h[1-6]>\s*/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/(?:ul|ol|blockquote)>\s*/gi, "\n")
      .replace(/<\/?[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const handleCopy = async () => {
    // Email: copy plain-text version (most paste targets handle that better
    // than HTML; users who need formatting can paste from a HTML-aware
    // mail composer manually).
    const plain = isEmail ? stripHtml(body) : body;
    const text = isEmail ? `Subject: ${subject}\n\n${plain}` : plain;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(isEmail ? "Email copied to clipboard" : "Message copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const handleMockSend = async () => {
    const plain = isEmail ? stripHtml(body).trim() : body.trim();
    if (!plain) {
      toast.error("Message body is empty.");
      return;
    }
    if (isEmail && !subject.trim()) {
      toast.error("Subject is empty.");
      return;
    }

    // Log a compliance note on the household so this outreach shows up
    // in their activity history. Sending is still mocked, but the
    // record-keeping side is real.
    if (draft.householdId) {
      const noteType = isEmail ? "Email" : "Text";
      const summary = isEmail
        ? `Subject: ${subject.trim()}\n\n${plain}`
        : plain;
      try {
        await createNote.mutateAsync({
          householdId: draft.householdId,
          type: noteType,
          summary,
          // Tag the Primary so the touchpoint appears on their contact
          // activity feed (compliance_note_contacts junction). Without this
          // the note exists at the household level but isn't associated to
          // any individual.
          contactIds: primary?.id ? [primary.id] : [],
        });
        toast.success(
          isEmail
            ? `Email logged on ${draft.recipientName} record (mock send — actual delivery not wired).`
            : `Text logged on ${draft.recipientName} record (mock send — actual delivery not wired).`,
        );
      } catch (e: any) {
        toast.error(`Logged the message but couldn't save the note: ${e.message}`);
      }
    } else {
      // No household scope (shouldn't happen via current entry points,
      // but fall back gracefully).
      toast.success(
        isEmail
          ? `Email queued for ${draft.recipientName} (mock — actual sending not yet wired).`
          : `Text queued for ${draft.recipientName} (mock — actual sending not yet wired).`,
      );
    }

    // If this draft came from the AI Inbox, mark the pending row as sent
    // so it disappears from the inbox. Failures here shouldn't block the
    // close — the compliance note is the system of record.
    if (draft.pendingDraftId) {
      try {
        await markDraftSent.mutateAsync(draft.pendingDraftId);
      } catch (e) {
        console.error("Failed to mark pending draft sent:", e);
      }
    }

    // Emit activity_event so the sidebar stream surfaces the send. Skipped
    // when no user (shouldn't happen via current entry points but defensive).
    if (user) {
      void emitActivityEvent({
        advisorId: user.id,
        kind: "draft_sent",
        title: `${isEmail ? "Email" : "Text"} sent to ${draft.recipientName}`,
        body: isEmail ? subject.trim() : null,
        household_id: draft.householdId ?? null,
        related_record_id: draft.pendingDraftId ?? null,
        related_record_type: draft.pendingDraftId ? "pending_draft" : null,
      });
    }

    draft.onSent?.();
    closeDraftPanel();
  };

  // For SMS, body is plain text. For email, body is HTML; use the stripped
  // text length for the char counter (plain) for accurate carrier-segment math.
  const charCount = isEmail ? 0 : body.length;
  const overTextLimit = !isEmail && charCount > TEXT_MAX;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border bg-card space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="gap-1.5 bg-amber-muted text-amber font-medium">
            <Sparkles className="w-3 h-3" />
            AI draft
          </Badge>
          <span className="text-muted-foreground truncate" title={draft.reason}>
            {draft.reason}
          </span>
        </div>
        <div className="flex items-start gap-2 text-[11px]">
          <span className="text-muted-foreground shrink-0 pt-px">To:</span>
          <div className="min-w-0 flex-1">
            {primaryFetched ? (
              primary ? (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground truncate">
                    {primaryDisplayName || draft.recipientName}
                    <span className="ml-1.5 text-muted-foreground font-normal">(Primary)</span>
                  </span>
                  {isEmail ? (
                    primaryEmail ? (
                      <span className="flex items-center gap-1 text-muted-foreground truncate">
                        <AtSign className="w-3 h-3 shrink-0" />
                        <span className="truncate">{primaryEmail}</span>
                      </span>
                    ) : (
                      <span className="text-destructive">No email on file — confirm before sending.</span>
                    )
                  ) : primaryPhone ? (
                    <span className="flex items-center gap-1 text-muted-foreground truncate">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="truncate">{primaryPhone}</span>
                    </span>
                  ) : (
                    <span className="text-destructive">No phone on file — confirm before sending.</span>
                  )}
                </div>
              ) : (
                <span className="text-destructive">No Primary contact found on this household.</span>
              )
            ) : (
              <span className="text-muted-foreground">Loading contact…</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isEmail && (
          <div className="space-y-1.5">
            <Label htmlFor="draft-panel-subject" className="text-xs">Subject</Label>
            <Input
              id="draft-panel-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={generating}
              className="text-sm"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="draft-panel-body" className="text-xs">{isEmail ? "Body" : "Message"}</Label>
            {generating && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Drafting…
              </span>
            )}
            {!isEmail && !generating && (
              <span className={`text-[11px] tabular-nums ${overTextLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {charCount} / {TEXT_MAX}
              </span>
            )}
          </div>
          {isEmail ? (
            <RichTextEditor
              value={body}
              onChange={setBody}
              disabled={generating}
              minHeightClass="min-h-[420px]"
              placeholder="Draft will appear here…"
            />
          ) : (
            <Textarea
              id="draft-panel-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[160px] text-sm"
              placeholder={generating ? "" : "Draft will appear here…"}
            />
          )}
          {overTextLimit && (
            <p className="text-[11px] text-destructive">
              Over {TEXT_MAX} characters — most carriers will split this into multiple SMS messages.
            </p>
          )}
        </div>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
          Review the draft against the household details on the left. Edit anything that doesn't match
          the conversation history, then Send (mock) or Copy to dispatch through your normal channel.
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={generate}
          disabled={generating}
          className="text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={generating || createNote.isPending || !body}>
            <Copy className="w-3.5 h-3.5 mr-1" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" size="sm" onClick={handleMockSend} disabled={generating || createNote.isPending || !body}>
            {createNote.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1" />
            )}
            {createNote.isPending ? "Logging…" : "Send"}
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pb-2 px-4 -mt-1 shrink-0">
        Send logs a note on the household record. Actual email/SMS delivery is not yet wired.
      </p>
    </div>
  );
}
