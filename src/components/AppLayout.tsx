import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { Bot, Bell, PhoneOff, ChevronLeft, ChevronRight } from "lucide-react";
import AppSidebar from "./AppSidebar";
import ImpersonationBar from "./ImpersonationBar";
import AiAssistant from "./AiAssistant";
import InSessionPanel from "./InSessionPanel";
import DashboardGoodiePanel from "./DashboardGoodiePanel";
import { Button } from "@/components/ui/button";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { InSessionProvider, useInSession } from "@/contexts/InSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTaskNotificationCount,
  useMarkNotificationsRead,
  useCreateTask,
} from "@/hooks/useTasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function TopBar() {
  const navigate = useNavigate();
  const { data: count = 0 } = useTaskNotificationCount();
  const markRead = useMarkNotificationsRead();

  const handleClick = () => {
    navigate("/tasks");
    if (count > 0) {
      markRead.mutate();
    }
  };

  return (
    <div className="h-10 border-b border-border bg-card/50 flex items-center justify-end px-4 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        title="Tasks"
        onClick={handleClick}
        className="relative"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-destructive" />
        )}
      </Button>
    </div>
  );
}

function LayoutInner() {
  const { sessionEvent, isInSession, endSession } = useInSession();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const createTask = useCreateTask();

  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("goodie-panel-collapsed") === "true";
  });

  const togglePanel = () => {
    const next = !panelCollapsed;
    setPanelCollapsed(next);
    localStorage.setItem("goodie-panel-collapsed", String(next));
  };

  const hidePanel = pathname.startsWith("/admin") || pathname === "/settings";
  const showPanel = !hidePanel && !!user;
  const householdName = sessionEvent?.households?.name;

  const handleEndSession = () => {
    if (user && sessionEvent && sessionEvent.household_id) {
      const name = sessionEvent.households?.name ?? "client";
      createTask.mutate(
        {
          title: `Send follow-up email — ${name}`,
          description: `Review and send the Goodie-drafted follow-up email after your session with ${name}.`,
          due_date: new Date().toISOString().split("T")[0],
          priority: "high",
          household_id: sessionEvent.household_id,
          task_type: "follow_up_email",
          assigned_to: user.id,
          advisor_id: user.id,
          status: "todo",
          metadata: {
            session_event_id: sessionEvent.id,
            household_name: name,
            event_type: sessionEvent.event_type,
          },
        },
        {
          onSuccess: () => {
            toast.success("Session ended · Follow-up task added to your Tasks");
          },
        }
      );
    }
    endSession();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ImpersonationBar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {user && <TopBar />}
          <main
            className={cn(
              "flex-1 overflow-y-auto transition-all duration-300",
              showPanel && !panelCollapsed && "2xl:mr-[360px] 3xl:mr-[480px]",
              showPanel && panelCollapsed && "2xl:mr-[48px]"
            )}
          >
            <Outlet />
          </main>
        </div>

        {showPanel && (
          <>
            {/* Collapsed strip */}
            {panelCollapsed && (
              <aside className="hidden 2xl:flex fixed right-0 top-0 bottom-0 w-[48px] border-l border-border bg-card/30 z-40 flex-col items-center py-3 gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePanel}
                  title="Expand Goodie panel"
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                {isInSession && (
                  <span className="relative flex h-2 w-2 mt-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </aside>
            )}

            {/* Expanded panel */}
            {!panelCollapsed && (
              <aside className="hidden 2xl:flex fixed right-0 top-0 bottom-0 w-[360px] 3xl:w-[480px] border-l border-border bg-background shadow-lg z-40 flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <h2 className="text-sm font-semibold truncate">
                      {isInSession && householdName
                        ? `In Session · ${householdName}`
                        : "Goodie"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isInSession && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEndSession}
                        className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                      >
                        <PhoneOff className="w-3.5 h-3.5 mr-1.5" />
                        End Session
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={togglePanel}
                      title="Collapse panel"
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  {isInSession && sessionEvent?.household_id ? (
                    <div className="flex-1 overflow-y-auto p-4">
                      <InSessionPanel
                        event={sessionEvent}
                        householdId={sessionEvent.household_id}
                      />
                    </div>
                  ) : (
                    <DashboardGoodiePanel />
                  )}
                </div>
              </aside>
            )}
          </>
        )}
      </div>
      <AiAssistant />
    </div>
  );
}

export default function AppLayout() {
  useRealtimeRefresh();
  return (
    <InSessionProvider>
      <LayoutInner />
    </InSessionProvider>
  );
}
