import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Phone,
  Mail,
  FileCheck,
  TrendingUp,
  Star,
  CheckSquare,
  Gift,
  Cake,
  Newspaper,
  Check,
  Route,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  householdId: string;
  advisorId: string;
}

type TouchpointRow = Tables<"touchpoints"> & {
  tasks:
    | Pick<Tables<"tasks">, "id" | "status" | "completed_at">
    | null;
};

interface TouchpointDetailProps {
  touchpoint: TouchpointRow;
  onClose: () => void;
  onComplete: (touchpointId: string) => Promise<void>;
  onSkip: (touchpointId: string) => Promise<void>;
  onNotesSave: (touchpointId: string, notes: string) => Promise<void>;
}

const TOUCHPOINT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  meeting: CalendarDays,
  call: Phone,
  letter: Mail,
  annual_review: FileCheck,
  market_assessment: TrendingUp,
  newsletter: Newspaper,
  birthday: Cake,
  holiday: Gift,
  appreciation_event: Star,
  task: CheckSquare,
};

const TOUCHPOINT_TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  call: "Phone Call",
  letter: "Letter",
  annual_review: "Annual Review",
  market_assessment: "Market Update",
  newsletter: "Newsletter",
  birthday: "Birthday",
  holiday: "Holiday",
  appreciation_event: "Event",
  task: "Task",
};

const TOUCHPOINT_ICON_STYLES: Record<string, string> = {
  meeting: "border-primary/20 bg-primary/10 text-primary",
  call: "border-emerald/20 bg-emerald-muted text-emerald",
  letter: "border-accent/20 bg-accent/10 text-accent",
  annual_review: "border-amber/20 bg-amber-muted text-amber",
  market_assessment: "border-border bg-secondary text-muted-foreground",
  newsletter: "border-border bg-secondary text-muted-foreground",
  birthday: "border-destructive/20 bg-destructive/10 text-destructive",
  holiday: "border-destructive/20 bg-destructive/10 text-destructive",
  appreciation_event: "border-amber/20 bg-amber-muted text-amber",
  task: "border-border bg-secondary text-muted-foreground",
};

function TouchpointDetail({ touchpoint, onClose, onComplete, onSkip, onNotesSave }: TouchpointDetailProps) {
  const [notes, setNotes] = useState(touchpoint.notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(touchpoint.notes ?? "");
  }, [touchpoint]);

  const statusLabel = touchpoint.status === "completed"
    ? "Completed"
    : touchpoint.status === "skipped"
      ? "Skipped"
      : "Upcoming";

  const saveNotesIfNeeded = async () => {
    if ((touchpoint.notes ?? "") === notes) return;
    try {
      setIsSavingNotes(true);
      await onNotesSave(touchpoint.id, notes);
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{touchpoint.name}</p>
          <p className="text-sm text-muted-foreground">
            {TOUCHPOINT_TYPE_LABELS[touchpoint.touchpoint_type] ?? touchpoint.touchpoint_type} ·{" "}
            {new Date(touchpoint.scheduled_date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
              touchpoint.status === "completed" && "bg-emerald-muted text-emerald",
              touchpoint.status === "skipped" && "bg-secondary text-muted-foreground",
              touchpoint.status === "upcoming" && "bg-primary/10 text-primary",
            )}
          >
            {statusLabel}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked task</p>
            <p className="mt-1 text-sm text-foreground">
              {touchpoint.tasks
                ? touchpoint.tasks.status === "done"
                  ? "Completed"
                  : touchpoint.tasks.status
                : "No linked task"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={saveNotesIfNeeded}
              placeholder="Add advisor notes"
              className="mt-1 min-h-24"
            />
            <p className="mt-1 text-xs text-muted-foreground">{isSavingNotes ? "Saving…" : "Notes save automatically."}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:w-44">
          <Button onClick={() => onComplete(touchpoint.id)} disabled={touchpoint.status === "completed"}>
            Mark Complete
          </Button>
          <Button variant="outline" onClick={() => onSkip(touchpoint.id)} disabled={touchpoint.status === "skipped"}>
            Skip
          </Button>
          {touchpoint.linked_task_id && (
            <Button asChild variant="ghost">
              <Link to={`/tasks/${touchpoint.linked_task_id}`}>View Task</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TouchpointTimeline({ householdId }: Props) {
  const queryClient = useQueryClient();
  const [selectedTp, setSelectedTp] = useState<TouchpointRow | null>(null);

  const { data: touchpoints = [] } = useQuery({
    queryKey: ["touchpoints", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("touchpoints")
        .select(
          `
            *,
            tasks:linked_task_id(
              id, status, completed_at
            )
          `,
        )
        .eq("household_id", householdId)
        .order("scheduled_date");

      if (error) throw error;
      return (data || []) as TouchpointRow[];
    },
  });

  useEffect(() => {
    const autoAdvanceTouchpoints = async () => {
      const ready = touchpoints.filter(
        (tp) => tp.status === "upcoming" && tp.tasks?.status === "done",
      );

      if (!ready.length) return;

      await Promise.all(
        ready.map((tp) =>
          supabase
            .from("touchpoints")
            .update({
              status: "completed",
              completed_date: tp.tasks?.completed_at?.split("T")[0] || new Date().toISOString().split("T")[0],
            })
            .eq("id", tp.id),
        ),
      );

      queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] });
    };

    void autoAdvanceTouchpoints();
  }, [touchpoints, householdId, queryClient]);

  const completedCount = useMemo(
    () => touchpoints.filter((tp) => tp.status === "completed").length,
    [touchpoints],
  );

  const progress = touchpoints.length ? (completedCount / touchpoints.length) * 100 : 0;

  const handleCompleteTouchpoint = async (touchpointId: string) => {
    await supabase
      .from("touchpoints")
      .update({
        status: "completed",
        completed_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", touchpointId);

    await queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] });
  };

  const handleSkipTouchpoint = async (touchpointId: string) => {
    await supabase.from("touchpoints").update({ status: "skipped" }).eq("id", touchpointId);
    await queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] });
  };

  const handleSaveNotes = async (touchpointId: string, notes: string) => {
    await supabase.from("touchpoints").update({ notes }).eq("id", touchpointId);
    await queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] });
  };

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Route className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Client Experience</h2>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {completedCount}/{touchpoints.length} complete
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-start py-2">
          {touchpoints.map((tp, index) => {
            const isCompleted = tp.status === "completed";
            const isActive = !isCompleted && new Date(tp.scheduled_date) <= new Date() && tp.status !== "skipped";
            const isUpcoming = !isCompleted && !isActive;
            const Icon = TOUCHPOINT_ICONS[tp.touchpoint_type] ?? CheckSquare;

            return (
              <div key={tp.id} className="flex items-start">
                <button
                  type="button"
                  className="group flex w-32 shrink-0 flex-col items-center gap-2 text-center"
                  onClick={() => setSelectedTp(tp)}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border text-sm transition-colors",
                      isCompleted && "border-emerald/20 bg-emerald-muted text-emerald",
                      isActive && "border-primary/20 bg-primary/10 text-primary",
                      isUpcoming && "border-border bg-secondary text-muted-foreground",
                      tp.status === "skipped" && "border-border bg-background text-muted-foreground/70",
                    )}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>

                  <div className="space-y-1">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{tp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tp.scheduled_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </button>

                {index < touchpoints.length - 1 && (
                  <div className="mt-6 h-0.5 w-20 shrink-0 bg-border">
                    <div
                      className={cn("h-full bg-primary/20", isCompleted && "bg-primary")}
                      style={{ width: isCompleted ? "100%" : "40%" }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {touchpoints.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-8 text-sm text-muted-foreground">
              No touchpoints scheduled yet.
            </div>
          )}
        </div>
      </div>

      {selectedTp && (
        <TouchpointDetail
          touchpoint={selectedTp}
          onClose={() => setSelectedTp(null)}
          onComplete={handleCompleteTouchpoint}
          onSkip={handleSkipTouchpoint}
          onNotesSave={handleSaveNotes}
        />
      )}
    </div>
  );
}