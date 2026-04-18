import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LineChart, PieChart, Zap, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUpdateProspect } from "@/hooks/useProspects";
import { useCreateTask } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName: string;
  onLaneSelected: (lane: string) => void;
}

type LaneKey = "financial_planning" | "portfolio_construction" | "point_solution" | "handoff";

interface LaneDef {
  key: LaneKey;
  title: string;
  description: string;
  hint: string;
  icon: typeof LineChart;
  iconClass: string;
  selectedRing: string;
}

const LANES: LaneDef[] = [
  {
    key: "financial_planning",
    title: "Financial Planning",
    description: "Comprehensive plan covering retirement, estate, tax strategy, and cash flow",
    hint: "Creates planning intake task — prospect advances to Discovery Complete",
    icon: LineChart,
    iconClass: "text-blue-600 dark:text-blue-400",
    selectedRing: "border-primary",
  },
  {
    key: "portfolio_construction",
    title: "Portfolio Construction",
    description: "Asset management focus for investment solutions without deep planning",
    hint: "Creates portfolio proposal task — prospect advances to Discovery Complete",
    icon: PieChart,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    selectedRing: "border-primary",
  },
  {
    key: "point_solution",
    title: "Point / Product Solution",
    description: "Targeted solution for a specific need — 401k rollover, life insurance, or single product",
    hint: "Creates product recommendation task — prospect advances to Discovery Complete",
    icon: Zap,
    iconClass: "text-amber-600 dark:text-amber-400",
    selectedRing: "border-primary",
  },
  {
    key: "handoff",
    title: "Handoff",
    description: "Route to junior advisor or Compass desk for C-tier prospects",
    hint: "Creates handoff task and GL assistance request — prospect marked as lost",
    icon: ArrowRightLeft,
    iconClass: "text-purple-600 dark:text-purple-400",
    selectedRing: "border-primary",
  },
];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function buildTaskInput(
  lane: LaneKey,
  prospectId: string,
  prospectName: string,
  userId: string,
) {
  const base = {
    advisor_id: userId,
    assigned_to: userId,
    status: "todo" as const,
    metadata: { prospect_id: prospectId, lane } as Record<string, any>,
  };

  switch (lane) {
    case "financial_planning":
      return {
        ...base,
        title: `Financial planning intake — ${prospectName}`,
        description: "Complete financial planning intake. Prepare data request for planning software.",
        priority: "high" as const,
        task_type: "financial_planning",
        due_date: daysFromNow(7),
      };
    case "portfolio_construction":
      return {
        ...base,
        title: `Portfolio proposal — ${prospectName}`,
        description: "Prepare investment proposal and model portfolio.",
        priority: "high" as const,
        task_type: "portfolio_construction",
        due_date: daysFromNow(7),
      };
    case "point_solution":
      return {
        ...base,
        title: `Product recommendation — ${prospectName}`,
        description: "Identify and prepare point solution recommendation.",
        priority: "medium" as const,
        task_type: "point_solution",
        due_date: daysFromNow(5),
      };
    case "handoff":
      return {
        ...base,
        title: `Handoff — ${prospectName}`,
        description: "Route prospect to Compass desk or junior advisor.",
        priority: "medium" as const,
        task_type: "handoff",
        due_date: daysFromNow(2),
      };
  }
}

export default function ExecutionLaneDialog({
  open,
  onOpenChange,
  prospectId,
  prospectName,
  onLaneSelected,
}: Props) {
  const { user } = useAuth();
  const updateProspect = useUpdateProspect();
  const createTask = useCreateTask();
  const [selected, setSelected] = useState<LaneKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selected || !user) return;
    setSubmitting(true);
    try {
      if (selected === "handoff") {
        await updateProspect.mutateAsync({
          id: prospectId,
          updates: {
            pipeline_stage: "lost",
            lost_reason: "Routed to Compass desk / junior advisor",
          },
        });
      } else {
        await updateProspect.mutateAsync({
          id: prospectId,
          updates: { pipeline_stage: "discovery_complete" },
        });
      }

      const taskInput = buildTaskInput(selected, prospectId, prospectName, user.id);
      await createTask.mutateAsync(taskInput);

      const laneLabel = LANES.find((l) => l.key === selected)?.title ?? selected;
      toast.success(`${laneLabel} selected for ${prospectName}`, {
        description: "Task created · Prospect updated",
      });

      onLaneSelected(selected);
      setSelected(null);
    } catch (err: any) {
      console.error("Lane selection failed:", err);
      toast.error("Failed to set execution lane", {
        description: err?.message ?? "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setSelected(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Execution Lane</DialogTitle>
          <DialogDescription>
            Choose the path forward for {prospectName}
          </DialogDescription>
          <div className="pt-1">
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Digital Workforce Initiative · Procured Choice
            </span>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {LANES.map((lane) => {
            const Icon = lane.icon;
            const isSelected = selected === lane.key;
            return (
              <button
                key={lane.key}
                type="button"
                onClick={() => setSelected(lane.key)}
                className={cn(
                  "text-left rounded-lg p-4 cursor-pointer transition-all",
                  isSelected
                    ? "border-2 border-primary bg-primary/5"
                    : "border border-border bg-card hover:border-primary/40 hover:bg-secondary/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 shrink-0", lane.iconClass)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{lane.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {lane.description}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground/80 italic">
                      {lane.hint}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleSkip} disabled={submitting}>
            Skip for now
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || submitting}>
            {submitting ? "Saving..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
