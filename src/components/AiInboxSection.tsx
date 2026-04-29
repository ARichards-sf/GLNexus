import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarCheck,
  Clock,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  TrendingDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  usePendingDrafts,
  useGeneratePendingDrafts,
  useDismissPendingDraft,
  type PendingDraft,
  type PendingDraftReason,
} from "@/hooks/usePendingDrafts";
import { useDraftPanel } from "@/contexts/DraftPanelContext";

const REASON_META: Record<
  PendingDraftReason,
  { label: string; icon: LucideIcon; tone: string }
> = {
  annual_review_due: {
    label: "Annual review",
    icon: CalendarCheck,
    tone: "bg-amber-muted text-amber",
  },
  aum_drop: {
    label: "AUM drop",
    icon: TrendingDown,
    tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  overdue_touchpoint: {
    label: "Overdue touchpoint",
    icon: Clock,
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  stalled_prospect: {
    label: "Stalled prospect",
    icon: AlertCircle,
    tone: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

/**
 * AI Inbox — list of pending pre-drafted outreach messages. Stacked inside
 * CopilotSidebar's "AI Inbox" section. Click a row to open MessageDraftPanel
 * pre-populated with the draft body; review/edit/Send marks the inbox row
 * sent and logs a compliance note.
 *
 * Click "Refresh" in the section header to call generate-pending-drafts,
 * which scans trigger conditions and writes new drafts. The function is
 * idempotent (source_key dedupe) so spamming the button is safe.
 */
export default function AiInboxSection() {
  const navigate = useNavigate();
  const { data: drafts = [], isLoading } = usePendingDrafts();
  const generate = useGeneratePendingDrafts();
  const dismiss = useDismissPendingDraft();
  const { openDraftPanel } = useDraftPanel();

  const handleRefresh = async () => {
    try {
      const res = await generate.mutateAsync();
      const {
        generated = 0,
        triggers = 0,
        skipped_pending = 0,
        skipped_cooldown = 0,
      } = res ?? {};
      if (triggers === 0) {
        toast.info("No new outreach triggers right now — your book is in good shape.");
      } else if (generated === 0) {
        const parts: string[] = [];
        if (skipped_pending > 0) parts.push(`${skipped_pending} already in inbox`);
        if (skipped_cooldown > 0) parts.push(`${skipped_cooldown} in cooldown`);
        toast.info(`No new drafts — ${parts.join(", ") || "everything up to date"}.`);
      } else {
        const detail: string[] = [];
        if (skipped_pending > 0) detail.push(`${skipped_pending} already in inbox`);
        if (skipped_cooldown > 0) detail.push(`${skipped_cooldown} in cooldown`);
        toast.success(
          `Drafted ${generated} new message${generated === 1 ? "" : "s"}${
            detail.length > 0 ? ` · ${detail.join(", ")}` : ""
          }.`,
        );
      }
    } catch (e: any) {
      toast.error(`Couldn't generate drafts: ${e.message}`);
    }
  };

  const handleOpen = (d: PendingDraft) => {
    // Navigate to the household so the advisor sees the underlying data
    // alongside the draft. Prospect-only drafts navigate to /prospects/{id}.
    if (d.household_id) {
      navigate(`/household/${d.household_id}`);
    } else if (d.prospect_id) {
      navigate(`/prospects/${d.prospect_id}`);
    }
    openDraftPanel({
      kind: d.kind,
      recipientName: d.recipient_name,
      reason: d.trigger_context ?? REASON_META[d.trigger_reason].label,
      callToAction:
        d.trigger_reason === "annual_review_due"
          ? "schedule the review"
          : "schedule a brief call",
      householdId: d.household_id ?? undefined,
      pendingDraftId: d.id,
      prefillBody: d.body,
      prefillSubject: d.subject ?? undefined,
      bookingUrlPath: d.booking_url_path,
    });
  };

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await dismiss.mutateAsync(id);
    } catch (err: any) {
      toast.error(`Couldn't dismiss: ${err.message}`);
    }
  };

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {drafts.length === 0
            ? "Nothing pending"
            : `${drafts.length} draft${drafts.length === 1 ? "" : "s"} ready to review`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={generate.isPending}
          className="h-6 px-2 text-[11px]"
        >
          {generate.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1" />
          )}
          {generate.isPending ? "Drafting…" : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 mx-auto mb-1 animate-spin" />
          Loading inbox…
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-6">
          <Inbox className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            No drafts pending. Click <strong>Refresh</strong> to scan for triggers.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {drafts.map((d) => {
            const meta = REASON_META[d.trigger_reason];
            const Icon = meta.icon;
            const subjectPreview =
              d.subject ||
              (d.body.length > 60 ? `${d.body.slice(0, 60).replace(/\n/g, " ")}…` : d.body);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleOpen(d)}
                className="group w-full text-left p-2 rounded-md border border-border bg-card hover:bg-secondary/40 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${meta.tone}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="border-0 px-1.5 py-0 h-4 text-[9px] tracking-wide font-medium uppercase bg-muted text-muted-foreground">
                        {d.kind === "email" ? <Mail className="w-2.5 h-2.5 mr-0.5" /> : null}
                        {meta.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {d.recipient_name}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground leading-snug line-clamp-1">
                      {subjectPreview}
                    </p>
                    {d.trigger_context && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {d.trigger_context}
                      </p>
                    )}
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDismiss(e, d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDismiss(e as any, d.id);
                      }
                    }}
                    className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Dismiss draft"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
