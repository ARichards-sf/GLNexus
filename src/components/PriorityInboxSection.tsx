import {
  AlertTriangle,
  Frown,
  Inbox,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePriorityEmails, type PriorityEmail } from "@/hooks/usePriorityEmails";
import { useEmailReaderPanel } from "@/contexts/EmailReaderPanelContext";

const PRIORITY_STYLE: Record<
  NonNullable<PriorityEmail["ai_priority"]>,
  { label: string; tone: string }
> = {
  urgent: {
    label: "Urgent",
    tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  high: {
    label: "High",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  normal: { label: "Normal", tone: "bg-muted text-muted-foreground" },
  low: { label: "Low", tone: "bg-muted text-muted-foreground" },
};

const TIER_STYLE: Record<string, string> = {
  platinum: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  gold: "bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  silver: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

/**
 * Priority Inbox — top urgent/high emails from known clients, sorted by
 * priority then tier. Click a row to open the full email reader, where the
 * advisor can read the body and draft a tier-aware reply.
 */
export default function PriorityInboxSection() {
  const { data: emails = [], isLoading } = usePriorityEmails();
  const { openEmailReader } = useEmailReaderPanel();

  if (isLoading) {
    return (
      <div className="px-3 py-3 text-xs text-muted-foreground flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        Loading priority inbox…
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Priority Inbox
          </span>
          <span className="text-[10px] text-muted-foreground">
            {emails.length === 0 ? "All clear" : `${emails.length} flagged`}
          </span>
        </div>

        {emails.length === 0 ? (
          <div className="text-center py-4">
            <Inbox className="w-4 h-4 mx-auto mb-1 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">
              No urgent or high-priority client mail.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {emails.map((e) => {
              const priorityStyle = PRIORITY_STYLE[e.ai_priority ?? "normal"];
              const tier = e.households?.wealth_tier ?? null;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openEmailReader(e)}
                  className={cn(
                    "w-full text-left rounded-md border bg-card p-2 transition-all duration-200",
                    "border-border hover:border-primary/40 hover:shadow-sm",
                    !e.is_read && "border-l-2 border-l-primary",
                  )}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-0 px-1.5 py-0 h-4 text-[9px] tracking-wide font-medium uppercase",
                          priorityStyle.tone,
                        )}
                      >
                        {e.ai_priority === "urgent" && (
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                        )}
                        {priorityStyle.label}
                      </Badge>
                      {tier && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-0 px-1.5 py-0 h-4 text-[9px] tracking-wide font-medium uppercase",
                            TIER_STYLE[tier] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {tier}
                        </Badge>
                      )}
                      {e.ai_sentiment === "frustrated" && (
                        <Badge
                          variant="outline"
                          className="border-0 px-1.5 py-0 h-4 text-[9px] tracking-wide font-medium uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        >
                          <Frown className="w-2.5 h-2.5 mr-0.5" />
                          Frustrated
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground truncate">
                        {e.from_name ?? e.from_email ?? "Unknown sender"}
                      </span>
                      {e.received_at && (
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                          {formatDistanceToNow(new Date(e.received_at))} ago
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground leading-snug line-clamp-1">
                      {e.subject ?? "(no subject)"}
                    </p>
                    {e.ai_summary && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {e.ai_summary}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}
