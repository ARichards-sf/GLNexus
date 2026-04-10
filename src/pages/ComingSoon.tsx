import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <Construction className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Coming Soon</h1>
      <p className="text-muted-foreground text-sm mb-6">This feature is currently under development.</p>
      <Button variant="outline" onClick={() => navigate("/")}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
      </Button>
    </div>
  );
}
