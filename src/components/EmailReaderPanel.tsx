import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Frown,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiSurface } from "@/components/ui/ai-surface";
import RichTextEditor from "@/components/RichTextEditor";
import { useEmailReaderPanel } from "@/contexts/EmailReaderPanelContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Draft = { subject: string; body: string };

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
};

const TIER_TONE: Record<string, string> = {
  platinum: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  gold: "bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  silver: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

/**
 * Mounts inside AppLayout's right sidebar when EmailReaderPanelContext has
 * an active email. Two stacked sections in one scrollable column:
 *   1. Read — sender, AI summary/action, full body in a sandboxed iframe
 *   2. Draft — same AiSurface treatment as MessageDraftPanel; "Draft AI
 *      Response" calls the draft-email-reply edge function and inlines
 *      the result for editing.
 */
export default function EmailReaderPanel() {
  const { email, closeEmailReader } = useEmailReaderPanel();
  const queryClient = useQueryClient();
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);

  // Reset everything when the panel switches to a different email or closes.
  useEffect(() => {
    if (!email) {
      setBodyHtml(null);
      setBodyLoading(false);
      setDraft(null);
      setDrafting(false);
      return;
    }
    let cancelled = false;
    setBodyHtml(null);
    setBodyLoading(true);
    setDraft(null);
    (async () => {
      const { data, error } = await supabase
        .from("email_messages")
        .select("body_html")
        .eq("id", email.id)
        .maybeSingle();
      if (cancelled) return;
      setBodyLoading(false);
      if (error) {
        console.error(error);
        return;
      }
      setBodyHtml(data?.body_html ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [email?.id]);

  const iframeSrcDoc = useMemo(() => {
    if (bodyHtml) return wrapHtml(bodyHtml);
    if (email?.body_preview) return wrapHtml(escapeHtml(email.body_preview));
    return wrapHtml("<em>No body content.</em>");
  }, [bodyHtml, email?.body_preview]);

  if (!email) return null;

  const tier = email.households?.wealth_tier ?? null;
  const householdName = email.households?.name ?? null;

  const handleDraft = async () => {
    setDrafting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-email-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email_message_id: email.id }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Draft failed (${res.status})`);
      setDraft(json as Draft);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${draft.subject}\n\n${stripHtml(draft.body)}`,
      );
      toast.success("Draft copied to clipboard");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleSend = async () => {
    if (!draft) return;
    if (!stripHtml(draft.body).trim()) {
      toast.error("Body is empty");
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-send-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email_message_id: email.id,
            subject: draft.subject,
            body: draft.body,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Send failed (${res.status})`);
      toast.success("Reply sent");
      queryClient.invalidateQueries({ queryKey: ["priority-emails"] });
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
      closeEmailReader();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border bg-card space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {email.ai_priority && (
            <Badge
              variant="outline"
              className={cn(
                "border-0 px-1.5 py-0 h-4 text-[9px] tracking-wide font-medium uppercase",
                PRIORITY_TONE[email.ai_priority] ?? "bg-muted text-muted-foreground",
              )}
            >
              {email.ai_priority === "urgent" && (
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
              )}
              {email.ai_priority}
            </Badge>
          )}
          {tier && (
            <Badge
              variant="outline"
              className={cn(
                "border-0 px-1.5 py-0 h-4 text-[9px] tracking-wide font-medium uppercase",
                TIER_TONE[tier] ?? "bg-muted text-muted-foreground",
              )}
            >
              {tier}
            </Badge>
          )}
          {email.ai_sentiment === "frustrated" && (
            <Badge
              variant="outline"
              className="border-0 px-1.5 py-0 h-4 text-[9px] tracking-wide font-medium uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
              <Frown className="w-2.5 h-2.5 mr-0.5" />
              Frustrated
            </Badge>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-snug">
            {email.subject ?? "(no subject)"}
          </p>
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <div>
              <span className="font-medium text-foreground">
                {email.from_name ?? email.from_email ?? "Unknown"}
              </span>
              {email.from_email && email.from_name && (
                <span className="text-muted-foreground">
                  {" "}&lt;{email.from_email}&gt;
                </span>
              )}
            </div>
            <div>
              {householdName && <>To {householdName} · </>}
              {email.received_at && format(new Date(email.received_at), "PPp")}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {(email.ai_summary || email.ai_suggested_action) && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
            {email.ai_summary && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  AI summary
                </div>
                <p className="text-xs text-foreground leading-snug">
                  {email.ai_summary}
                </p>
              </div>
            )}
            {email.ai_suggested_action && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  Suggested action
                </div>
                <p className="text-xs text-foreground leading-snug">
                  {email.ai_suggested_action}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Message</Label>
          {bodyLoading ? (
            <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-border rounded">
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Loading…
            </div>
          ) : (
            <iframe
              srcDoc={iframeSrcDoc}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="w-full h-[320px] border border-border rounded bg-white"
              title="Email body"
            />
          )}
          {email.web_link && (
            <div className="flex justify-end">
              <a
                href={email.web_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Open original in Outlook
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <Label className="text-xs">Reply</Label>
            </div>
            {draft && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDraft}
                disabled={drafting}
                className="h-7 px-2 text-[11px]"
              >
                <RefreshCw
                  className={cn(
                    "w-3 h-3 mr-1",
                    drafting && "animate-spin",
                  )}
                />
                Regenerate
              </Button>
            )}
          </div>

          {!draft ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleDraft}
              disabled={drafting}
              className="w-full"
            >
              {drafting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Drafting…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Draft AI Response
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="reply-subject" className="text-xs">
                  Subject
                </Label>
                <Input
                  id="reply-subject"
                  value={draft.subject}
                  onChange={(e) =>
                    setDraft({ ...draft, subject: e.target.value })
                  }
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Body</Label>
                <AiSurface tone="subtle" loading={drafting}>
                  <RichTextEditor
                    value={draft.body}
                    onChange={(html) => setDraft({ ...draft, body: html })}
                    disabled={drafting || sending}
                    minHeightClass="min-h-[280px]"
                    placeholder="Draft will appear here…"
                  />
                </AiSurface>
              </div>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                Tone is calibrated to {tier ? `${tier}-tier` : "the client's"}{" "}
                relationship. If a scheduling link is included, it auto-filters
                booking slots by their tier when they enter their email.
              </div>
            </div>
          )}
        </div>
      </div>

      {draft && (
        <>
          <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeEmailReader}
              disabled={sending}
              className="text-xs text-muted-foreground"
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={sending}
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSend}
                disabled={sending || !stripHtml(draft.body).trim()}
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1" />
                )}
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center pb-2 px-4 -mt-1 shrink-0">
            Sent through your connected Outlook mailbox · threaded with the original.
          </p>
        </>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// HTML → plain text that preserves paragraph and line breaks. Used for the
// clipboard path and for the "is the body actually empty" check (TipTap
// reports `<p></p>` for an empty editor — non-zero length but zero content).
function stripHtml(html: string): string {
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
}

// Wraps email body HTML in a minimal document with a base style so the
// sandboxed iframe renders consistently. Links open in a new top-level
// context (escaping the sandbox) so clicks behave like a normal mail client.
function wrapHtml(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>
  body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; padding: 12px; margin: 0; background: #fff; }
  a { color: #2563eb; }
  img { max-width: 100%; height: auto; }
  blockquote { border-left: 3px solid #ddd; margin: 8px 0; padding: 4px 12px; color: #555; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
</style></head><body>${inner}</body></html>`;
}
