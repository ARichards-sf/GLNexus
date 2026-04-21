import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, parseISO } from "date-fns";
import {
  ArrowLeft,
  Link as LinkIcon,
  Calendar as CalendarIcon,
  Pencil,
  FileText,
  Clock,
  Zap,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCompleteTask,
  useUncompleteTask,
  useDeleteTask,
  type Task,
} from "@/hooks/useTasks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useComplianceNotes } from "@/hooks/useHouseholds";
import { useCalendarEvents, EVENT_TYPE_COLORS } from "@/hooks/useCalendarEvents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import CreateTaskDialog from "@/components/CreateTaskDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface HouseholdSummary {
  id: string;
  name: string;
  total_aum: number | null;
  risk_tolerance: string | null;
  status: string | null;
  next_action: string | null;
  annual_review_date: string | null;
}

interface TaskWithHousehold extends Task {
  households?: HouseholdSummary | null;
}

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const RISK_STYLES: Record<string, string> = {
  Conservative: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  Moderate: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  Aggressive: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};

function formatCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}

function fmtDateTime(d: string) {
  try {
    return format(parseISO(d), "EEE, MMM d 'at' h:mm a");
  } catch {
    return d;
  }
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const {
    data: task,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["task", id],
    enabled: !!id,
    queryFn: async (): Promise<TaskWithHousehold | null> => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select(
          `*, households:household_id ( id, name, total_aum, risk_tolerance, status, next_action, annual_review_date )`
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as TaskWithHousehold | null;
    },
  });

  const householdId = task?.household_id ?? undefined;
  const { data: notes = [] } = useComplianceNotes(householdId);
  const { data: allEvents = [] } = useCalendarEvents();

  const isJumpReview = task?.task_type === "jump_review";

  const { data: reviewItems = [], refetch: refetchItems } = useQuery({
    queryKey: ["jump_review_items", task?.id],
    enabled: !!isJumpReview && !!task?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("jump_review_items")
        .select("*")
        .eq("task_id", task!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {
      assets: [],
      retirement: [],
      estate: [],
      risk: [],
      other: [],
    };
    (reviewItems as any[]).forEach((item) => {
      const key = item.pillar || "other";
      if (groups[key]) groups[key].push(item);
      else groups.other.push(item);
    });
    return groups;
  }, [reviewItems]);

  const pendingCount = (reviewItems as any[]).filter(
    (i) => i.status === "pending"
  ).length;

  const upcomingEvents = useMemo(() => {
    if (!householdId) return [];
    const now = Date.now();
    return allEvents
      .filter(
        (e) =>
          e.household_id === householdId &&
          e.status === "scheduled" &&
          new Date(e.start_time).getTime() >= now
      )
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
      .slice(0, 2);
  }, [allEvents, householdId]);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/tasks">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Tasks
          </Link>
        </Button>
        <Card className="border-border shadow-none">
          <CardContent className="py-12 text-center">
            <h1 className="text-xl font-semibold text-foreground">Task not found</h1>
            <p className="text-sm text-muted-foreground mt-2">
              This task may have been deleted or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDone = task.status === "done";
  const isOverdue =
    !isDone && task.due_date && isPast(parseISO(task.due_date));
  const isAssignedToSelf = task.assigned_to === user?.id;
  const isCreatedByMe = task.created_by === user?.id;
  const household = task.households ?? null;

  const handleToggleComplete = async () => {
    try {
      if (isDone) {
        await uncompleteTask.mutateAsync(task.id);
        toast.success("Task marked as to-do");
      } else {
        await completeTask.mutateAsync(task.id);
        toast.success("Task completed");
      }
      queryClient.invalidateQueries({ queryKey: ["task", id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update task");
    }
  };

  const handleEditSubmit = async (values: {
    title: string;
    description: string | null;
    due_date: string | null;
    priority: Task["priority"];
    household_id: string | null;
    assigned_to: string;
  }) => {
    const { error } = await (supabase as any)
      .from("tasks")
      .update(values)
      .eq("id", task.id);
    if (error) throw error;
    toast.success("Task updated");
    queryClient.invalidateQueries({ queryKey: ["task", id] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const handleDelete = async () => {
    await deleteTask.mutateAsync(task.id);
    navigate("/tasks");
  };

  const handleApprove = async (item: any) => {
    const { error } = await (supabase as any)
      .from("jump_review_items")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) {
      toast.error("Failed to approve item");
      return;
    }
    refetchItems();
    toast.success("Item approved");
  };

  const handleDismiss = async (itemId: string) => {
    const { error } = await (supabase as any)
      .from("jump_review_items")
      .update({
        status: "dismissed",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", itemId);
    if (error) {
      toast.error("Failed to dismiss item");
      return;
    }
    refetchItems();
  };

  const handleAddItem = async () => {
    const summary = window.prompt("Describe the item to add:");
    if (!summary?.trim() || !user) return;
    const { error } = await (supabase as any)
      .from("jump_review_items")
      .insert({
        task_id: task.id,
        household_id: task.household_id || null,
        prospect_id: (task.metadata as any)?.prospect_id || null,
        advisor_id: user.id,
        item_type: "note",
        pillar: null,
        content: { summary: summary.trim() },
        source: "manual",
        status: "pending",
      });
    if (error) {
      toast.error("Failed to add item");
      return;
    }
    refetchItems();
    toast.success("Item added");
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/tasks">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Tasks
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Checkbox
          checked={isDone}
          onCheckedChange={handleToggleComplete}
          className="mt-2 h-5 w-5"
          aria-label={isDone ? "Mark as to-do" : "Mark as complete"}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h1
              className={cn(
                "text-2xl font-semibold text-foreground tracking-tight",
                isDone && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className={cn("capitalize border-0", PRIORITY_STYLES[task.priority])}>
              {task.priority}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                isDone
                  ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                  : "border-border text-muted-foreground"
              )}
            >
              {isDone ? "Done" : "To Do"}
            </Badge>
            {task.task_type && task.task_type !== "manual" && (
              <Badge variant="secondary" className="capitalize">
                {task.task_type.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Jump Review */}
      {isJumpReview && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Jump Review
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {pendingCount} pending
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Review and approve items extracted from your meeting. Approved
                  items will be saved to the CRM.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {reviewItems.length === 0 && (
              <div className="text-center py-8 border border-dashed border-border rounded-md">
                <Zap className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  No items to review yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Items will appear here when Jump is connected, or you can add them manually
                </p>
              </div>
            )}

            {Object.entries(grouped).map(([pillar, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={pillar} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide capitalize">
                    {pillar === "other" ? "General" : pillar}
                  </div>
                  <div className="space-y-2">
                    {items.map((item: any) => (
                      <ReviewItemRow
                        key={item.id}
                        item={item}
                        onApprove={() => handleApprove(item)}
                        onDismiss={() => handleDismiss(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {pendingCount === 0 && reviewItems.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 pt-2">
                <CheckCircle2 className="w-4 h-4" />
                All items reviewed
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 1 — Task Details */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" /> Task Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {task.description && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Description
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <DetailRow label="Due Date">
              {task.due_date ? (
                <span className={cn(isOverdue && "text-red-600 font-medium")}>
                  {fmtDate(task.due_date)}
                  {isOverdue && (
                    <Badge className="ml-2 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[10px] border-0">
                      Overdue
                    </Badge>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">No due date</span>
              )}
            </DetailRow>

            <DetailRow label="Priority">
              <Badge className={cn("capitalize border-0", PRIORITY_STYLES[task.priority])}>
                {task.priority}
              </Badge>
            </DetailRow>

            <DetailRow label="Assigned To">
              {isAssignedToSelf ? (
                <span className="font-medium">You</span>
              ) : (
                <span className="font-mono text-xs text-muted-foreground">
                  {task.assigned_to.slice(0, 8)}…
                </span>
              )}
            </DetailRow>

            <DetailRow label="Created By">
              {isCreatedByMe ? (
                <span className="font-medium">You</span>
              ) : (
                <span className="font-mono text-xs text-muted-foreground">
                  {task.created_by.slice(0, 8)}…
                </span>
              )}
            </DetailRow>

            <DetailRow label="Created">
              <span className="text-foreground">
                {fmtDate(task.created_at)}
              </span>
            </DetailRow>

            <DetailRow label="Task Type">
              <Badge variant="secondary" className="capitalize">
                {(task.task_type || "manual").replace(/_/g, " ")}
              </Badge>
            </DetailRow>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Linked Household */}
      {household && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-muted-foreground" /> Linked Household
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Link
              to={`/household/${household.id}`}
              className="text-lg font-semibold text-foreground hover:text-primary transition-colors inline-block"
            >
              {household.name}
            </Link>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Total AUM">
                <span className="font-medium tabular-nums">
                  {formatCurrency(household.total_aum)}
                </span>
              </DetailRow>

              <DetailRow label="Status">
                {household.status ? (
                  <Badge variant="secondary">{household.status}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailRow>

              <DetailRow label="Risk Tolerance">
                {household.risk_tolerance ? (
                  <Badge
                    className={cn(
                      "border-0",
                      RISK_STYLES[household.risk_tolerance] ?? "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {household.risk_tolerance}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailRow>

              <DetailRow label="Annual Review">
                {household.annual_review_date ? (
                  <span>Due {fmtDate(household.annual_review_date)}</span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </DetailRow>

              {household.next_action && (
                <DetailRow label="Next Action" wide>
                  <span className="text-foreground">{household.next_action}</span>
                </DetailRow>
              )}
            </div>

            <div className="pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/household/${household.id}`}>View Full Profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3 — Recent Activity */}
      {householdId && notes.length > 0 && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-border ml-2 space-y-5">
              {notes.slice(0, 3).map((note: any) => (
                <li key={note.id} className="pl-4 -ml-px">
                  <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary/80 border-2 border-background" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {note.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(note.date ?? note.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1.5 leading-relaxed">
                    {note.summary?.length > 150
                      ? `${note.summary.slice(0, 150)}…`
                      : note.summary}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Section 4 — Upcoming Meetings */}
      {householdId && upcomingEvents.length > 0 && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" /> Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.map((evt) => {
              const colors =
                EVENT_TYPE_COLORS[evt.event_type] ?? {
                  bg: "bg-secondary",
                  text: "text-secondary-foreground",
                  dot: "bg-muted-foreground",
                };
              return (
                <div
                  key={evt.id}
                  className="flex items-start justify-between gap-4 p-3 rounded-md border border-border bg-card hover:bg-secondary/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground text-sm">
                      {evt.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmtDateTime(evt.start_time)}
                    </div>
                  </div>
                  <Badge className={cn("border-0 shrink-0", colors.bg, colors.text)}>
                    {evt.event_type}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {editOpen && (
        <CreateTaskDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          initialTask={task}
          onSubmitEdit={handleEditSubmit}
        />
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? "Deleting..." : "Delete Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  account: "Account",
  note: "Note",
  planning_gap: "Planning Gap",
  commitment: "Commitment",
};

function ReviewItemRow({
  item,
  onApprove,
  onDismiss,
}: {
  item: any;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const isApproved = item.status === "approved";
  const isDismissed = item.status === "dismissed";

  const summary =
    item.content?.summary ||
    item.content?.description ||
    item.content?.name ||
    JSON.stringify(item.content);

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 p-3 rounded-md border bg-card transition-colors",
        isApproved && "border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/10",
        isDismissed && "border-border opacity-60",
        !isApproved && !isDismissed && "border-border hover:bg-secondary/30"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] capitalize">
            {TYPE_LABELS[item.item_type] || item.item_type}
          </Badge>
          {item.source === "jump_ai" && (
            <Badge className="text-[10px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <Zap className="w-2.5 h-2.5 mr-0.5" /> Jump
            </Badge>
          )}
        </div>
        <p className="text-sm text-foreground leading-relaxed break-words">
          {summary}
        </p>
        {item.content?.details && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.content.details}
          </p>
        )}
      </div>

      {!isApproved && !isDismissed && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" onClick={onApprove} className="h-8">
            <Check className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {isApproved && (
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
          Approved
        </div>
      )}

      {isDismissed && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <XCircle className="w-4 h-4" />
          Dismissed
        </div>
      )}
    </div>
  );
}
