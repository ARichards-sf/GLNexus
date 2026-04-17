import { Outlet } from "react-router-dom";
import { Bot, X } from "lucide-react";
import AppSidebar from "./AppSidebar";
import ImpersonationBar from "./ImpersonationBar";
import AiAssistant from "./AiAssistant";
import PreMeetingBriefPanel from "./PreMeetingBriefPanel";
import { Button } from "@/components/ui/button";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { BriefProvider, useBrief } from "@/contexts/BriefContext";
import { cn } from "@/lib/utils";

function LayoutInner() {
  const { briefEvent, isBriefOpen, closeBrief } = useBrief();
  const showPanel = isBriefOpen && briefEvent && briefEvent.household_id;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ImpersonationBar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main
          className={cn(
            "flex-1 overflow-y-auto transition-all duration-300",
            showPanel && "lg:mr-[480px]"
          )}
        >
          <Outlet />
        </main>
        {showPanel && (
          <aside className="hidden lg:flex fixed right-0 top-0 bottom-0 w-[480px] border-l border-border bg-background shadow-lg z-40 flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-sm font-semibold">Pre-Meeting Brief</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={closeBrief} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <PreMeetingBriefPanel
                event={briefEvent}
                householdId={briefEvent.household_id!}
              />
            </div>
          </aside>
        )}
      </div>
      <AiAssistant />
    </div>
  );
}

export default function AppLayout() {
  useRealtimeRefresh();
  return (
    <BriefProvider>
      <LayoutInner />
    </BriefProvider>
  );
}
