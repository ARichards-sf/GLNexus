import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarCheck,
  GitBranch,
  Mail,
  Send,
  Sparkles,
  TrendingDown,
  Trophy,
  X,
  Zap,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useActivityEvents,
  useMarkActivityRead,
  type ActivityEvent,
  type ActivityEventKind,
} from "@/hooks/useActivityEvents";

const KIND_META: Record<ActivityEventKind, { icon: LucideIcon; tone: string }> = {
  draft_generated: {
    icon: Sparkles,
    tone: "bg-amber-muted text-amber",
  },
  draft_sent: {
    icon: Send,
    tone: "bg-emerald-muted text-emerald",
  },
  draft_dismissed: {
    icon: X,
    tone: "bg-secondary text-muted-foreground",
  },
  aum_drop_detected: {
    icon: TrendingDown,
    tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  tier_changed: {
    icon: Trophy,
    tone: "bg-amber-muted text-amber",
  },
  pipeline_changed: {
    icon: GitBranch,
    tone: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  meeting_completed: {
    icon: CalendarCheck,
    tone: "bg-emerald-muted text-emerald",
  },
  task_due_soon: {
    icon: Zap,
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  cooldown_ending: {
    icon: Mail,
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  system: {
    icon: Activity,
    tone: "bg-secondary text-muted-foreground",
  },
};

const SECTION_LIMIT = 5;

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Right-sidebar activity stream — surfaces auto-emitted events so the
 * advisor sees Goodie's work without going looking for it. Auto-marks
 * unread events as read on view (debounced through the markRead mutation).
 */
export default function ActivityStreamSection() {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useActivityEvents();
  const markRead = useMarkActivityRead();

  const visible = events.slice(0, SECTION_LIMIT);

  // Mark unread events as read when the user expands the section. Fires
  // once per render-set of unread ids; the hook itself handles dedupe via
  // the `is null` filter.
  useEffect(() => {
    const unread = visible.filter((e) => !e.read_at).map((e) => e.id);
    if (unread.length > 0) {
      // Defer to avoid running during render commit.
      const timer = setTimeout(() => {
        markRead.mutate(unread);
      }, 800);
      return () => clearTimeout(timer);
    }
    // We deliberately don't depend on `markRead` to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((e) => e.id).join("|")]);

  const handleClick = (e: ActivityEvent) => {
    if (e.household_id) {
      navigate(`/household/${e.household_id}`);
    } else if (e.prospect_id) {
      navigate(`/prospects/${e.prospect_id}`);
    }
  };

  return (
    <div className="px-3 py-2 space-y-1.5">
      {isLoading ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 mx-auto mb-1 animate-spin" />
          Loading activity…
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-4">
          <Activity className="w-5 h-5 mx-auto mb-1 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            No activity yet. Goodie will surface auto-detected events here as they happen.
          </p>
        </div>
      ) : (
        visible.map((event) => {
          const meta = KIND_META[event.kind] ?? KIND_META.system;
          const Icon = meta.icon;
          const clickable = !!event.household_id || !!event.prospect_id;
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => handleClick(event)}
              disabled={!clickable}
              className={cn(
                "group w-full text-left flex items-start gap-2 p-2 rounded-md transition-colors",
                clickable
                  ? "hover:bg-secondary/40 cursor-pointer"
                  : "cursor-default",
                !event.read_at && "bg-primary/5",
              )}
            >
              <div className={cn("shrink-0 w-6 h-6 rounded-md flex items-center justify-center", meta.tone)}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                  {event.title}
                </p>
                {event.body && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{event.body}</p>
                )}
                <p className="text-[10px] text-muted-foreground/70">{relativeTime(event.created_at)}</p>
              </div>
              {!event.read_at && (
                <span
                  className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-primary"
                  aria-label="Unread"
                />
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
