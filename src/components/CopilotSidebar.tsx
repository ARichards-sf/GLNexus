import { useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckSquare,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTodaysMeetings } from "@/hooks/useCalendarEvents";
import { usePendingDrafts } from "@/hooks/usePendingDrafts";
import { usePriorityEmails } from "@/hooks/usePriorityEmails";
import { useActivityEvents } from "@/hooks/useActivityEvents";
import { useTasks } from "@/hooks/useTasks";
import TodaysMeetingsWidget from "./dashboard/TodaysMeetingsWidget";
import PriorityInboxSection from "./PriorityInboxSection";
import AiInboxSection from "./AiInboxSection";
import PendingTasksSection from "./PendingTasksSection";
import ActivityStreamSection from "./ActivityStreamSection";

const STORAGE_KEY = "copilot_active_tab";

type TabId = "inbox" | "meetings" | "tasks" | "activity";

const VALID_TABS: TabId[] = ["inbox", "meetings", "tasks", "activity"];

const loadActiveTab = (): TabId => {
  if (typeof window === "undefined") return "inbox";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && VALID_TABS.includes(v as TabId) ? (v as TabId) : "inbox";
  } catch {
    return "inbox";
  }
};

const saveActiveTab = (id: TabId) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage can throw in private mode; tab state is non-critical.
  }
};

function TabPill({
  icon: Icon,
  label,
  count,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden 3xl:inline">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold leading-none",
            "bg-primary/15 text-primary",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );
}

/**
 * Right-sidebar copilot console. Four tabs:
 *   1. AI Inbox — pending pre-drafted outreach awaiting review
 *   2. Today's Meetings — schedule with on-demand AI briefs per row
 *   3. Pending Tasks — top priority open tasks with one-click complete
 *   4. Activity — auto-emitted events ("Goodie drafted...", "Meeting completed...")
 *
 * Active tab persists in localStorage. Counts in the tab strip stay visible
 * across switches so the advisor doesn't lose track of unread items.
 */
export default function CopilotSidebar() {
  const { data: todaysMeetings = [] } = useTodaysMeetings();
  const { data: pendingDrafts = [] } = usePendingDrafts();
  const { data: priorityEmails = [] } = usePriorityEmails();
  const { data: events = [] } = useActivityEvents();
  const { data: tasks = [] } = useTasks("mine");
  const openTaskCount = tasks.filter((t) => t.status === "todo").length;
  const unreadActivity = events.filter((e) => !e.read_at).length;

  const [active, setActive] = useState<TabId>(() => loadActiveTab());
  const handleChange = (val: string) => {
    const next = (VALID_TABS.includes(val as TabId) ? val : "inbox") as TabId;
    setActive(next);
    saveActiveTab(next);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Tabs
        value={active}
        onValueChange={handleChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border bg-card px-2 pt-2">
          <TabsList className="w-full grid grid-cols-4 h-9 bg-secondary/40 p-0.5">
            <TabsTrigger value="inbox" className="text-[11px] px-1.5">
              <TabPill
                icon={Inbox}
                label="AI Drafts"
                count={priorityEmails.length + pendingDrafts.length}
              />
            </TabsTrigger>
            <TabsTrigger value="meetings" className="text-[11px] px-1.5">
              <TabPill icon={CalendarDays} label="Meets" count={todaysMeetings.length} />
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-[11px] px-1.5">
              <TabPill icon={CheckSquare} label="Tasks" count={openTaskCount} />
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-[11px] px-1.5">
              <TabPill icon={Activity} label="Activity" count={unreadActivity} />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="inbox"
          className="mt-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
          forceMount
        >
          <PriorityInboxSection />
          <AiInboxSection />
        </TabsContent>
        <TabsContent
          value="meetings"
          className="mt-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
          forceMount
        >
          <TodaysMeetingsWidget embedded />
        </TabsContent>
        <TabsContent
          value="tasks"
          className="mt-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
          forceMount
        >
          <PendingTasksSection />
        </TabsContent>
        <TabsContent
          value="activity"
          className="mt-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
          forceMount
        >
          <ActivityStreamSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
