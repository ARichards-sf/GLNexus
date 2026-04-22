import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { ShieldAlert, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ImpersonationBar() {
  const { impersonatedUser, stopImpersonating, vpmAdvisor, stopVpmSession, isVpmSession } = useImpersonation();
  const navigate = useNavigate();

  if (!impersonatedUser && !isVpmSession) return null;

  return (
    <>
      {impersonatedUser && (
        <div className="bg-amber-400 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Viewing as <strong>{impersonatedUser.name}</strong></span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-amber-950 hover:bg-amber-500 hover:text-amber-950 gap-1"
            onClick={() => {
              stopImpersonating();
              navigate("/admin/advisors");
            }}
          >
            <X className="w-3.5 h-3.5" />
            Stop Viewing
          </Button>
        </div>
      )}

      {isVpmSession && vpmAdvisor && (
        <div className="w-full bg-blue-600 dark:bg-blue-700 text-white text-xs px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-blue-200" />
            <span className="font-medium">VPM Session</span>
            <span className="text-blue-200">·</span>
            <span>Serving: {vpmAdvisor.name}</span>
            {vpmAdvisor.firmName && (
              <>
                <span className="text-blue-200">·</span>
                <span className="text-blue-200">{vpmAdvisor.firmName}</span>
              </>
            )}
            {vpmAdvisor.isPrime && (
              <span className="bg-amber-400 text-amber-900 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                ⭐ Prime
              </span>
            )}
          </div>
          <button
            onClick={() => {
              const ticketId = (window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id;
              stopVpmSession();
              delete (window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id;
              window.localStorage.removeItem("vpm_ticket_id");
              if (ticketId) {
                navigate(`/admin/vpm-requests/${ticketId}`);
              } else {
                navigate("/admin/vpm-requests");
              }
            }}
            className="flex items-center gap-1 text-blue-200 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            End VPM Session
          </button>
        </div>
      )}
    </>
  );
}
