import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { ShieldAlert, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ImpersonationBar() {
  const { impersonatedUser, stopImpersonating } = useImpersonation();
  const navigate = useNavigate();

  if (!impersonatedUser) return null;

  return (
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
  );
}
