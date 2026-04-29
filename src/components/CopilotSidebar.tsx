import { useState, type ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTodaysMeetings } from "@/hooks/useCalendarEvents";
import { usePendingDrafts } from "@/hooks/usePendingDrafts";
import { useActivityEvents } from "@/hooks/useActivityEvents";
import { useTasks } from "@/hooks/useTasks";
import TodaysMeetingsWidget from "./dashboard/TodaysMeetingsWidget";
import AiInboxSection from "./AiInboxSection";
import PendingTasksSection from "./PendingTasksSection";
import ActivityStreamSection from "./ActivityStreamSection";

const STORAGE_PREFIX = "copilot_sec_";

const loadCollapsed = (key: string, def = false): boolean => {
  if (typeof window === "undefined") return def;
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + key);
    return v === null ? def : v === "true";
  } catch {
    return def;
  }
};

const saveCollapsed = (key: string, v: boolean) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, String(v));
  } catch {
    // localStorage can throw in private mode; section state is non-critical.
  }
};

function SectionHeader({
  icon: Icon,
  label,
  count,
  collapsed,
  onToggle,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/40 transition-colors text-left"
    >
      <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        {label}
        {typeof count === "number" && count > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] tracking-normal normal-case">
            {count}
          </span>
        )}
      </span>
      {collapsed ? (
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      ) : (
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}

function Section({
  icon,
  label,
  storageKey,
  count,
  defaultCollapsed = false,
  /** Caps the height of the body so a long list doesn't crowd out other sections. */
  bodyMaxHeight,
  children,
}: {
  icon: LucideIcon;
  label: string;
  storageKey: string;
  count?: number;
  defaultCollapsed?: boolean;
  bodyMaxHeight?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(storageKey, defaultCollapsed));
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      saveCollapsed(storageKey, next);
      return next;
    });
  };

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <SectionHeader icon={icon} label={label} count={count} collapsed={collapsed} onToggle={toggle} />
      {!collapsed && (
        <div className={cn("overflow-y-auto", bodyMaxHeight)}>{children}</div>
      )}
    </div>
  );
}

/**
 * Right-sidebar copilot console. Stacks four sections vertically:
 *   1. AI Inbox — pending pre-drafted outreach awaiting review
 *   2. Today's Meetings — schedule with on-demand AI briefs per row
 *   3. Pending Tasks — top priority open tasks with one-click complete
 *   4. Activity — auto-emitted events ("Goodie drafted...", "Meeting completed...")
 *
 * Each section is independently collapsible (state persisted in localStorage)
 * so the advisor can dial in the density. There's no fixed chat panel here —
 * Goodie chat lives at /goodie via the left-sidebar nav.
 */
export default function CopilotSidebar() {
  const { data: todaysMeetings = [] } = useTodaysMeetings();
  const { data: pendingDrafts = [] } = usePendingDrafts();
  const { data: events = [] } = useActivityEvents();
  const { data: tasks = [] } = useTasks("mine");
  const openTaskCount = tasks.filter((t) => t.status === "todo").length;
  const unreadActivity = events.filter((e) => !e.read_at).length;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <Section
        icon={Inbox}
        label="AI Inbox"
        storageKey="inbox"
        count={pendingDrafts.length}
        bodyMaxHeight="max-h-[40vh]"
      >
        <AiInboxSection />
      </Section>

      <Section
        icon={CalendarDays}
        label="Today's Meetings"
        storageKey="meetings"
        count={todaysMeetings.length}
        bodyMaxHeight="max-h-[40vh]"
      >
        <TodaysMeetingsWidget embedded />
      </Section>

      <Section
        icon={CheckSquare}
        label="Pending Tasks"
        storageKey="tasks"
        count={openTaskCount}
        bodyMaxHeight="max-h-[40vh]"
      >
        <PendingTasksSection />
      </Section>

      <Section
        icon={Activity}
        label="Activity"
        storageKey="activity"
        count={unreadActivity}
        bodyMaxHeight="max-h-[50vh]"
      >
        <ActivityStreamSection />
      </Section>
    </div>
  );
}
