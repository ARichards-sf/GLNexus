import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Sparkles, CalendarDays, Bot, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHouseholds, useAllComplianceNotes } from "@/hooks/useHouseholds";
import { useTodaysMeetings } from "@/hooks/useCalendarEvents";
import GoodieSuggests from "./GoodieSuggests";
import TodaysMeetingsWidget from "./dashboard/TodaysMeetingsWidget";
import DashboardGoodiePanel from "./DashboardGoodiePanel";

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
  /** Caps the height of the body so a long list doesn't crowd out the chat. */
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
 * Right-sidebar copilot console. Stacks three sections vertically:
 *   1. Goodie Suggests — actionable AI recommendations (book-wide, page-agnostic)
 *   2. Today's Meetings — schedule with on-demand AI briefs per row
 *   3. Goodie chat — conversational assistant, fills the remaining space
 *
 * Each of the top two sections is independently collapsible (state persisted
 * in localStorage) so the advisor can dial in the density. The chat always
 * takes whatever vertical space remains.
 */
export default function CopilotSidebar() {
  const { data: households = [] } = useHouseholds();
  const { data: recentNotes = [] } = useAllComplianceNotes();
  const { data: todaysMeetings = [] } = useTodaysMeetings();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Section
        icon={Sparkles}
        label="Goodie Suggests"
        storageKey="suggests"
        bodyMaxHeight="max-h-[40vh]"
      >
        <GoodieSuggests households={households} recentNotes={recentNotes as any} embedded />
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

      {/* Chat takes the remaining height. The DashboardGoodiePanel fragment
          renders its own scrollable transcript + sticky input; we just give
          it a flex column that fills. */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-2 text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
          Ask Goodie
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardGoodiePanel />
        </div>
      </div>
    </div>
  );
}
