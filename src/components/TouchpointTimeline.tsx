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
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateComplianceNote } from "@/hooks/useHouseholds";

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
  householdId: string;
  primaryContactId: string | null;
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

/**
 * Maps a touchpoint_type to the compliance_notes.type value we'll write
 * when "Log Note" is clicked. Restricted to the canonical set the rest of
 * the app uses (Phone Call / Email / Annual Review / Meeting / Service).
 */
const NOTE_TYPE_FROM_TOUCHPOINT: Record<string, string> = {
  meeting: "Meeting",
  call: "Phone Call",
  letter: "Email",
  annual_review: "Annual Review",
  market_assessment: "Phone Call",
  newsletter: "Email",
  birthday: "Email",
  holiday: "Email",
  appreciation_event: "Meeting",
  task: "Service",
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

function TouchpointDetail({
  touchpoint,
  householdId,
  primaryContactId,
  onClose,
  onComplete,
  onSkip,
  onNotesSave,
}: TouchpointDetailProps) {
  const [notes, setNotes] = useState(touchpoint.notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [loggingNote, setLoggingNote] = useState(false);
  const createNote = useCreateComplianceNote();

  useEffect(() => {
    setNotes(touchpoint.notes ?? "");
  }, [touchpoint]);

  // Logs a real compliance_notes row tied to the household + Primary
  // contact, derived from this touchpoint. Auto-marks the touchpoint
  // complete in the same flow since "I'm logging a note about it" almost
  // always means "this happened."
  const handleLogNote = async () => {
    setLoggingNote(true);
    try {
      const noteType =
        NOTE_TYPE_FROM_TOUCHPOINT[touchpoint.touchpoint_type] ?? "Service";
      const dateLabel = new Date(touchpoint.scheduled_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const advisorNotes = (notes ?? "").trim();
      const summary = advisorNotes
        ? `${touchpoint.name} (${dateLabel})\n\n${advisorNotes}`
        : `${touchpoint.name} (${dateLabel}) — completed.`;

      await createNote.mutateAsync({
        householdId,
        type: noteType,
        summary,
        contactIds: primaryContactId ? [primaryContactId] : [],
      });

      if (touchpoint.status !== "completed") {
        await onComplete(touchpoint.id);
      }

      // Persist any unsaved touchpoint notes too so the timeline detail
      // matches what got logged.
      if ((touchpoint.notes ?? "") !== notes) {
        await onNotesSave(touchpoint.id, notes);
      }

      toast.success("Logged compliance note and marked touchpoint complete.");
      onClose();
    } catch (e: any) {
      toast.error(`Couldn't log note: ${e.message}`);
    } finally {
      setLoggingNote(false);
    }
  };

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
          <Button
            variant="secondary"
            onClick={handleLogNote}
            disabled={loggingNote || createNote.isPending}
            title="Create a compliance note from this touchpoint and tag the Primary contact."
          >
            {loggingNote ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 mr-1.5" />
            )}
            Log Note
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

/**
 * Vertical, month-grouped timeline of touchpoints. Replaces the previous
 * horizontal scrolling strip — easier to scan when there are 8–13 touches
 * per year, and matches the layout the generator preview shows.
 *
 * Color comes from `TOUCHPOINT_ICON_STYLES`, applied to a small icon tile
 * on the left of each row so type is visible at a glance.
 */
function VerticalTouchpointList({
  touchpoints,
  selectedId,
  onSelect,
}: {
  touchpoints: TouchpointRow[];
  selectedId: string | null;
  onSelect: (tp: TouchpointRow) => void;
}) {
  // Group by year-month bucket while preserving the parent's date ordering.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: TouchpointRow[] }>();
    for (const tp of touchpoints) {
      const d = new Date(tp.scheduled_date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!map.has(key)) {
        map.set(key, { label, rows: [] });
      }
      map.get(key)!.rows.push(tp);
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [touchpoints]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              {group.label}
            </p>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {group.rows.length} {group.rows.length === 1 ? "touch" : "touches"}
            </span>
          </div>

          <div className="space-y-1.5">
            {group.rows.map((tp) => {
              const isCompleted = tp.status === "completed";
              const isSkipped = tp.status === "skipped";
              const due = new Date(tp.scheduled_date + "T00:00:00");
              const isOverdue = !isCompleted && !isSkipped && due < today;
              const Icon = TOUCHPOINT_ICONS[tp.touchpoint_type] ?? CheckSquare;
              const iconStyle =
                TOUCHPOINT_ICON_STYLES[tp.touchpoint_type] ??
                "border-border bg-secondary text-muted-foreground";
              const isSelected = selectedId === tp.id;

              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => onSelect(tp)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all duration-200",
                    "hover:border-primary/30 hover:bg-secondary/30 hover:-translate-y-0.5 hover:shadow-sm",
                    isSelected ? "border-primary/50 bg-secondary/30" : "border-border",
                    isSkipped && "opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
                      isCompleted
                        ? "border-emerald/20 bg-emerald-muted text-emerald"
                        : iconStyle,
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium text-foreground line-clamp-1",
                        isCompleted && "line-through text-muted-foreground",
                      )}
                    >
                      {tp.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {TOUCHPOINT_TYPE_LABELS[tp.touchpoint_type] ?? tp.touchpoint_type}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOverdue && (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        Overdue
                      </span>
                    )}
                    {isSkipped && (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Skipped
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        isOverdue ? "text-destructive font-medium" : "text-muted-foreground",
                      )}
                    >
                      {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TouchpointTimeline({ householdId }: Props) {
  const queryClient = useQueryClient();
  const [selectedTp, setSelectedTp] = useState<TouchpointRow | null>(null);

  // Primary contact for the household — used by the Log Note action so the
  // resulting compliance_note rolls up onto the right contact's activity.
  const { data: primaryContactId = null } = useQuery({
    queryKey: ["touchpoints_primary_contact", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .eq("relationship", "Primary")
        .is("archived_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data?.id ?? null) as string | null;
    },
    enabled: !!householdId,
  });

  const { data: touchpoints = [] } = useQuery({
    queryKey: ["touchpoints", householdId],
    queryFn: async () => {
      // Two queries instead of an embedded join. The touchpoints table
      // doesn't have a declared FK on linked_task_id, so postgrest can't
      // resolve the embedded `tasks:linked_task_id(...)` syntax — it
      // returned rows with most columns dropped, surfacing as "Invalid
      // Date" + blank names. We hand-stitch the join client-side instead.
      const { data: tps, error } = await supabase
        .from("touchpoints")
        .select("*")
        .eq("household_id", householdId)
        .order("scheduled_date");
      if (error) throw error;
      const rows = (tps || []) as Array<Tables<"touchpoints">>;

      const taskIds = rows
        .map((r) => r.linked_task_id)
        .filter((id): id is string => !!id);
      let tasksById = new Map<string, Pick<Tables<"tasks">, "id" | "status" | "completed_at">>();
      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, status, completed_at")
          .in("id", taskIds);
        tasksById = new Map((tasks ?? []).map((t: any) => [t.id, t]));
      }

      return rows.map((r) => ({
        ...r,
        tasks: r.linked_task_id ? tasksById.get(r.linked_task_id) ?? null : null,
      })) as TouchpointRow[];
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] }),
        queryClient.invalidateQueries({ queryKey: ["touchpoint_stats", householdId] }),
      ]);
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

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] }),
      queryClient.invalidateQueries({ queryKey: ["touchpoint_stats", householdId] }),
    ]);
  };

  const handleSkipTouchpoint = async (touchpointId: string) => {
    await supabase.from("touchpoints").update({ status: "skipped" }).eq("id", touchpointId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] }),
      queryClient.invalidateQueries({ queryKey: ["touchpoint_stats", householdId] }),
    ]);
  };

  const handleSaveNotes = async (touchpointId: string, notes: string) => {
    await supabase.from("touchpoints").update({ notes }).eq("id", touchpointId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["touchpoints", householdId] }),
      queryClient.invalidateQueries({ queryKey: ["touchpoint_stats", householdId] }),
    ]);
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

      {touchpoints.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-8 text-sm text-muted-foreground text-center">
          No touchpoints scheduled yet.
        </div>
      ) : (
        <VerticalTouchpointList
          touchpoints={touchpoints}
          selectedId={selectedTp?.id ?? null}
          onSelect={setSelectedTp}
        />
      )}

      {selectedTp && (
        <TouchpointDetail
          touchpoint={selectedTp}
          householdId={householdId}
          primaryContactId={primaryContactId}
          onClose={() => setSelectedTp(null)}
          onComplete={handleCompleteTouchpoint}
          onSkip={handleSkipTouchpoint}
          onNotesSave={handleSaveNotes}
        />
      )}
    </div>
  );
}