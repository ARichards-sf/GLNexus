import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, PhoneOff, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import IdleWarningDialog from "@/components/IdleWarningDialog";
import { useQueryClient } from "@tanstack/react-query";
import AppSidebar from "./AppSidebar";
import ImpersonationBar from "./ImpersonationBar";
import AiAssistant from "./AiAssistant";
import MessageDraftPanel from "./MessageDraftPanel";
import { DemoTour } from "./DemoTour";
import { useDraftPanel } from "@/contexts/DraftPanelContext";
import InSessionPanel from "./InSessionPanel";
import CopilotSidebar from "./CopilotSidebar";
import EndSessionDialog from "./EndSessionDialog";
import VpmTicketPanel from "./VpmTicketPanel";
import { Button } from "@/components/ui/button";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { InSessionProvider, useInSession } from "@/contexts/InSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCreateTask } from "@/hooks/useTasks";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFirmContext } from "@/hooks/useFirmContext";
import { useSelectedFirm } from "@/contexts/FirmContext";
import { useFirms } from "@/hooks/useFirms";
import { TEST_DATA_USER_ID } from "@/lib/demoMode";

function LayoutInner() {
  const { sessionEvent, isInSession, endSession, isProspectSession } = useInSession();
  const { user, signOut } = useAuth();
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const handleIdleWarning = useCallback(() => {
    setShowIdleWarning(true);
  }, []);

  const handleIdleTimeout = useCallback(async () => {
    setShowIdleWarning(false);
    await signOut();
  }, [signOut]);

  const { resetTimer } = useIdleTimeout({
    onWarning: handleIdleWarning,
    onTimeout: handleIdleTimeout,
    enabled: !!user,
  });

  const handleStayLoggedIn = useCallback(() => {
    setShowIdleWarning(false);
    resetTimer();
  }, [resetTimer]);
  const { isVpmSession } = useImpersonation();
  const { pathname } = useLocation();
  const createTask = useCreateTask();
  const queryClient = useQueryClient();
  const { draft, closeDraftPanel } = useDraftPanel();

  // Firm branding colors
  const { currentFirm, allFirms } = useFirmContext();
  const { selectedFirmId } = useSelectedFirm();
  const { data: firms = [] } = useFirms();

  const brandingFirm = selectedFirmId
    ? firms.find(f => f.id === selectedFirmId) ?? currentFirm
    : currentFirm;

  const accentColor = (brandingFirm as any)?.accent_color;
  const secondaryColor = (brandingFirm as any)?.secondary_color;

  const firmCssVars = {
    ...(accentColor
      ? { "--firm-accent": accentColor }
      : {}),
    ...(secondaryColor
      ? { "--firm-secondary": secondaryColor }
      : { "--firm-secondary": accentColor || "" }),
  } as React.CSSProperties;

  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("goodie-panel-collapsed") === "true";
  });

  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const sessionSnapshot = useRef<CalendarEvent | null>(null);

  const togglePanel = () => {
    const next = !panelCollapsed;
    setPanelCollapsed(next);
    localStorage.setItem("goodie-panel-collapsed", String(next));
  };

  // When a draft opens, force-expand the right panel so the user can see
  // it. They can still collapse afterward if they want.
  useEffect(() => {
    if (draft && panelCollapsed) {
      setPanelCollapsed(false);
      localStorage.setItem("goodie-panel-collapsed", "false");
    }
  }, [draft, panelCollapsed]);

  const hidePanel = pathname.startsWith("/admin") || pathname === "/settings" || pathname === "/goodie";
  // Force-show the panel whenever a draft is active so it can't get
  // stranded behind a route that normally hides it.
  const showPanel = (!hidePanel || !!draft) && !!user;
  const sessionName = isInSession
    ? (sessionEvent?.households?.name ||
        (sessionEvent?.prospects
          ? `${sessionEvent.prospects.first_name} ${sessionEvent.prospects.last_name}`
          : "Session"))
    : null;

  const handleEndSessionConfirm = async (data: {
    pillars: string[];
    summary: string;
    noteType: string;
    lane?: string;
  }) => {
    const snap = sessionSnapshot.current;
    if (!snap || !user) {
      endSession();
      setEndSessionOpen(false);
      return;
    }

    const wasProspect = !!snap.prospect_id && !snap.household_id;
    const name =
      snap.households?.name ||
      (snap.prospects
        ? `${snap.prospects.first_name} ${snap.prospects.last_name}`
        : "client");

    // 1. Compliance note (client sessions only)
    if (data.summary.trim() && snap.household_id) {
      try {
        await supabase.from("compliance_notes").insert({
          household_id: snap.household_id,
          advisor_id: user.id,
          advisor_name: (user.user_metadata as any)?.full_name || null,
          type: data.noteType,
          summary: data.summary.trim(),
          date: new Date().toISOString().split("T")[0],
          pillars_covered: data.pillars,
          auto_generated: true,
        } as any);
        queryClient.invalidateQueries({ queryKey: ["compliance_notes"] });
        queryClient.invalidateQueries({ queryKey: ["all_compliance_notes"] });
      } catch (err) {
        console.error("Failed to save note:", err);
      }
    }

    // 2. Follow-up email task
    createTask.mutate({
      title: `Send follow-up email — ${name}`,
      description: `Review and send follow-up after session with ${name}.`,
      due_date: new Date().toISOString().split("T")[0],
      priority: "high",
      household_id: snap.household_id ?? undefined,
      task_type: "follow_up_email",
      assigned_to: user.id,
      advisor_id: user.id,
      status: "todo",
      metadata: {
        session_event_id: snap.id,
        name,
        prospect_id: snap.prospect_id ?? undefined,
        event_type: snap.event_type,
        pillars_covered: data.pillars,
        lane: data.lane,
      },
    });

    // 3. Prospect stage update + lane task
    if (wasProspect && snap.prospect_id && data.lane && data.lane !== "skip") {
      await supabase
        .from("prospects")
        .update({
          pipeline_stage: data.lane === "handoff" ? "lost" : "discovery_complete",
          ...(data.lane === "handoff" && { lost_reason: "Routed to Compass desk" }),
        })
        .eq("id", snap.prospect_id);

      queryClient.invalidateQueries({ queryKey: ["prospects"] });

      const laneTasks: Record<string, { title: string; type: string; days: number }> = {
        financial_planning: {
          title: `Financial planning intake — ${name}`,
          type: "financial_planning",
          days: 7,
        },
        portfolio_construction: {
          title: `Portfolio proposal — ${name}`,
          type: "portfolio_construction",
          days: 7,
        },
        point_solution: {
          title: `Product recommendation — ${name}`,
          type: "point_solution",
          days: 5,
        },
        handoff: {
          title: `Handoff — ${name}`,
          type: "handoff",
          days: 2,
        },
      };

      const lt = laneTasks[data.lane];
      if (lt) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + lt.days);
        createTask.mutate({
          title: lt.title,
          priority: data.lane === "handoff" ? "medium" : "high",
          task_type: lt.type,
          due_date: dueDate.toISOString().split("T")[0],
          advisor_id: user.id,
          assigned_to: user.id,
          status: "todo",
          metadata: {
            prospect_id: snap.prospect_id,
            lane: data.lane,
          },
        });
      }
    }

    // 4. End session
    endSession();
    setEndSessionOpen(false);

    const noteMsg = data.summary.trim() ? " · Note logged" : "";
    const laneMsg =
      data.lane && data.lane !== "skip"
        ? ` · ${data.lane.replace(/_/g, " ")} lane selected`
        : "";

    toast.success(`Session ended${noteMsg}${laneMsg} · Follow-up task created`);
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {user?.id === TEST_DATA_USER_ID && (
        <div className="flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/40 px-4 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span>
            Demonstration environment — all client data shown is fictional and for testing purposes only.
          </span>
        </div>
      )}
      <ImpersonationBar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main
            style={firmCssVars}
            className={cn(
              "flex-1 overflow-y-auto transition-all duration-300",
              // Draft panel is wider (room for the rich-text editor +
              // toolbar). Standard Goodie panel uses the smaller widths.
              showPanel && !panelCollapsed && !draft && "2xl:mr-[360px] 3xl:mr-[480px]",
              showPanel && !panelCollapsed && !!draft && "2xl:mr-[480px] 3xl:mr-[600px]",
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
              <aside className="hidden 2xl:flex fixed right-0 top-0 bottom-0 w-[48px] border-l border-border bg-card z-40 flex-col items-center py-3 gap-2">
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
              <aside
                className={cn(
                  "hidden 2xl:flex fixed right-0 top-0 bottom-0 border-l border-border bg-card shadow-lg z-40 flex-col",
                  draft ? "w-[480px] 3xl:w-[600px]" : "w-[360px] 3xl:w-[480px]",
                )}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <h2 className="text-sm font-semibold truncate">
                      {draft
                        ? `Draft ${draft.kind === "email" ? "Email" : "Text"} · ${draft.recipientName}`
                        : isVpmSession
                          ? "VPM Ticket"
                          : isInSession && sessionName
                            ? `In Session · ${sessionName}`
                            : "Goodie"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {draft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={closeDraftPanel}
                        className="text-xs text-muted-foreground"
                      >
                        Close
                      </Button>
                    )}
                    {!draft && isInSession && !isVpmSession && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          sessionSnapshot.current = sessionEvent;
                          setEndSessionOpen(true);
                        }}
                        className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                      >
                        <PhoneOff className="w-3.5 h-3.5 mr-1.5" />
                        End Session
                      </Button>
                    )}
                    {/* Collapse arrow hidden in draft mode — collapsing
                        the panel hides the editor entirely, which is
                        confusing during draft review. Use Close instead. */}
                    {!draft && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePanel}
                        title="Collapse panel"
                        className="h-8 w-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  {draft ? (
                    <MessageDraftPanel />
                  ) : isVpmSession ? (
                    <VpmTicketPanel />
                  ) : isInSession && sessionEvent && (sessionEvent.household_id || sessionEvent.prospect_id) ? (
                    <div className="flex-1 overflow-y-auto p-4">
                      <InSessionPanel
                        event={sessionEvent}
                        householdId={sessionEvent.household_id ?? undefined}
                      />
                    </div>
                  ) : (
                    <CopilotSidebar />
                  )}
                </div>
              </aside>
            )}
          </>
        )}
      </div>
      <AiAssistant />
      <DemoTour />

      <IdleWarningDialog
        open={showIdleWarning}
        onStayLoggedIn={handleStayLoggedIn}
        onLogOut={handleIdleTimeout}
      />

      {endSessionOpen && (
        <EndSessionDialog
          open={endSessionOpen}
          onOpenChange={(open) => {
            if (!open) setEndSessionOpen(false);
          }}
          sessionEvent={sessionSnapshot.current}
          isProspectSession={
            !!sessionSnapshot.current?.prospect_id &&
            !sessionSnapshot.current?.household_id
          }
          onComplete={handleEndSessionConfirm}
        />
      )}
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
