import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckSquare, Plus, MoreHorizontal, ChevronDown, ChevronRight, Filter, X,
  Search, AlarmClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StickyTabsBar } from "@/components/ui/sticky-tabs-bar";
import { StickyPageHeader } from "@/components/ui/sticky-page-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useIsLeadAdvisor } from "@/hooks/useIsLeadAdvisor";
import {
  useTasks, useCompleteTask, useUncompleteTask, useDeleteTask, useSnoozeTask,
  useMarkNotificationsRead,
  type Task, type TaskFilter,
} from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import CreateTaskDialog, { type EditableValues } from "@/components/CreateTaskDialog";
import ReassignTaskDialog from "@/components/ReassignTaskDialog";
import PageLoader from "@/components/PageLoader";

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200/60",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/60",
  low: "bg-secondary text-muted-foreground border-border",
};

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(dueDate: string | null, status: Task["status"]) {
  if (!dueDate || status === "done") return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dueDate + "T00:00:00");
  return d < today;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(from: Date): Date {
  // Treat "this week" as today + 6 days (rolling 7-day window). Calendar
  // weeks wrap awkwardly on weekends; rolling is more useful for planning.
  const d = new Date(from);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function nextMondayIso(): string {
  const d = new Date();
  const day = d.getDay(); // 0 Sun .. 6 Sat
  // Days until next Monday — never 0, bumps at least to next week.
  const add = ((1 - day + 7) % 7) || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().split("T")[0];
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatTaskType(t: string): string {
  return t.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TaskRowProps {
  task: Task;
  showAdvisor?: boolean;
  currentUserId: string;
  onEdit: (t: Task) => void;
  onReassign: (t: Task) => void;
  onDelete: (t: Task) => void;
}

function TaskRow({ task, showAdvisor, currentUserId, onEdit, onReassign, onDelete }: TaskRowProps) {
  const navigate = useNavigate();
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const snoozeTask = useSnoozeTask();
  const { toast } = useToast();
  const isDone = task.status === "done";
  const overdue = isOverdue(task.due_date, task.status);
  const isAssignedToSelf = task.assigned_to === currentUserId;
  const assigneeInitials = isAssignedToSelf
    ? "Me"
    : task.assigned_to.slice(0, 2).toUpperCase();
  const isCreator = task.created_by === currentUserId;

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[role="checkbox"]') ||
      target.closest('[data-no-nav]')
    ) {
      return;
    }
    navigate(`/tasks/${task.id}`);
  };

  const handleSnooze = async (dueDate: string, label: string) => {
    try {
      await snoozeTask.mutateAsync({ taskId: task.id, dueDate });
      toast({ title: `Snoozed to ${label}` });
    } catch (e: any) {
      toast({ title: "Couldn't snooze task", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        "flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-secondary/30 cursor-pointer",
        isDone && "opacity-60"
      )}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={() => isDone ? uncompleteTask.mutate(task.id) : completeTask.mutate(task.id)}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        {showAdvisor && (
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">Task</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn("text-sm font-medium text-foreground", isDone && "line-through text-muted-foreground")}>
            {task.title}
          </p>
          {task.task_type && task.task_type !== "manual" && (
            <Badge variant="secondary" className="text-[10px] capitalize">
              {task.task_type.replace(/[-_]/g, " ")}
            </Badge>
          )}
        </div>
        {task.households && (
          <Link
            to={`/household/${task.households.id}`}
            data-no-nav
            onClick={(e) => e.stopPropagation()}
            className="inline-block mt-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {task.households.name}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={cn("text-[10px] capitalize border", PRIORITY_STYLES[task.priority])}>
          {task.priority}
        </Badge>

        {task.due_date && (
          <div className="flex items-center gap-1.5">
            {overdue && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[10px] border-0 hover:bg-red-100">
                Overdue
              </Badge>
            )}
            <span className={cn(
              "text-xs",
              overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
            )}>
              {formatDate(task.due_date)}
            </span>
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                isAssignedToSelf
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-foreground"
              )}
            >
              {assigneeInitials}
            </div>
          </TooltipTrigger>
          <TooltipContent>{isAssignedToSelf ? "Assigned to you" : "Assigned"}</TooltipContent>
        </Tooltip>

        <div data-no-nav onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReassign(task)}>Reassign</DropdownMenuItem>
              {!isDone && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Snooze
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleSnooze(plusDaysIso(1), "tomorrow")}>
                    <AlarmClock className="w-3.5 h-3.5 mr-2" />
                    1 day
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSnooze(plusDaysIso(7), "next week")}>
                    <AlarmClock className="w-3.5 h-3.5 mr-2" />
                    1 week
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSnooze(nextMondayIso(), "next Monday")}>
                    <AlarmClock className="w-3.5 h-3.5 mr-2" />
                    Next Monday
                  </DropdownMenuItem>
                </>
              )}
              {(isCreator || task.advisor_id === currentUserId) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(task)}>
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

type Bucket = "overdue" | "today" | "week" | "later";

interface BucketConfig {
  key: Bucket;
  label: string;
  emptyHint?: string;
  tone?: string;
}

const BUCKETS: BucketConfig[] = [
  { key: "overdue", label: "Overdue", tone: "text-red-600 dark:text-red-400" },
  { key: "today",   label: "Today" },
  { key: "week",    label: "This Week" },
  { key: "later",   label: "Later" },
];

function bucketFor(task: Task): Bucket {
  // Done tasks are never bucketed (rendered separately at the bottom).
  if (task.status === "done") return "later";
  const today = startOfToday();
  const weekEnd = endOfWeek(today);
  if (!task.due_date) return "later";
  const due = new Date(task.due_date + "T00:00:00");
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  if (due <= weekEnd) return "week";
  return "later";
}

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  showAdvisor?: boolean;
  currentUserId: string;
  onEdit: (t: Task) => void;
  onReassign: (t: Task) => void;
  onDelete: (t: Task) => void;
  onClearFilters?: () => void;
  isFiltered?: boolean;
}

function TaskList({ tasks, isLoading, showAdvisor, currentUserId, onEdit, onReassign, onDelete, onClearFilters, isFiltered }: TaskListProps) {
  const [showDone, setShowDone] = useState(false);

  const todoTasks = useMemo(() => tasks.filter((t) => t.status === "todo"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  const grouped = useMemo(() => {
    const map: Record<Bucket, Task[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
    };
    for (const t of todoTasks) {
      map[bucketFor(t)].push(t);
    }
    // Sort within each bucket: priority then due_date asc.
    const PRIORITY_RANK: Record<Task["priority"], number> = {
      urgent: 0, high: 1, medium: 2, low: 3,
    };
    for (const k of Object.keys(map) as Bucket[]) {
      map[k].sort((a, b) => {
        const ap = PRIORITY_RANK[a.priority] ?? 4;
        const bp = PRIORITY_RANK[b.priority] ?? 4;
        if (ap !== bp) return ap - bp;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
    }
    return map;
  }, [todoTasks]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (tasks.length === 0) {
    if (isFiltered && onClearFilters) {
      return (
        <Card className="border-border shadow-none">
          <CardContent className="py-16 text-center">
            <Filter className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-base font-semibold text-foreground">No tasks match the current filters</h3>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-border shadow-none">
        <CardContent className="py-16 text-center">
          <CheckSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-base font-semibold text-foreground">You're all caught up</h3>
          <p className="text-sm text-muted-foreground mt-1">No pending tasks</p>
        </CardContent>
      </Card>
    );
  }

  const visibleBuckets = BUCKETS.filter((b) => grouped[b.key].length > 0);

  return (
    <div className="space-y-6">
      {visibleBuckets.length === 0 && (
        <Card className="border-border shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing open in your queue.
          </CardContent>
        </Card>
      )}

      {visibleBuckets.map((bucket) => (
        <div key={bucket.key}>
          <p className={cn(
            "text-[11px] uppercase tracking-wider font-semibold mb-2 px-1",
            bucket.tone ?? "text-muted-foreground",
          )}>
            {bucket.label} · {grouped[bucket.key].length}
          </p>
          <Card className="border-border shadow-none overflow-hidden">
            {grouped[bucket.key].map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                showAdvisor={showAdvisor}
                currentUserId={currentUserId}
                onEdit={onEdit}
                onReassign={onReassign}
                onDelete={onDelete}
              />
            ))}
          </Card>
        </div>
      ))}

      {doneTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2 px-1"
          >
            {showDone ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {showDone ? "Hide" : "Show"} {doneTasks.length} completed task{doneTasks.length === 1 ? "" : "s"}
          </button>
          {showDone && (
            <Card className="border-border shadow-none overflow-hidden">
              {doneTasks.map((t) => (
                <TaskRow key={t.id} task={t} showAdvisor={showAdvisor} currentUserId={currentUserId}
                  onEdit={onEdit} onReassign={onReassign} onDelete={onDelete} />
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const { isAdmin, isGLInternal } = useIsAdmin();
  const { data: isLead = false } = useIsLeadAdvisor();
  const showFirmView = isLead || isAdmin || isGLInternal;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteTask = useDeleteTask();
  const [activeTab, setActiveTab] = useState<TaskFilter>("mine");
  const { data: tasks = [], isLoading } = useTasks(activeTab);
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Task | null>(null);

  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  // Reset firm-only filters when leaving the firm view; search and type
  // chips persist across tabs because they're useful everywhere.
  useEffect(() => {
    if (activeTab !== "all") {
      setAssigneeFilter("all");
      setDueDateFilter("all");
    }
  }, [activeTab]);

  const uniqueAssignees = useMemo(() => {
    if (activeTab !== "all") return [];
    return Array.from(new Set(tasks.map((t) => t.assigned_to)));
  }, [tasks, activeTab]);

  // Surface every task_type currently present in the loaded tasks. We
  // dynamically render chips for whatever shows up so we don't need to
  // maintain a hard-coded enum here.
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.task_type) set.add(t.task_type);
    }
    return Array.from(set).sort();
  }, [tasks]);

  // Drop type filters that no longer match any visible task (e.g. after
  // switching tabs) — otherwise the chip stays "active" with no effect.
  useEffect(() => {
    setActiveTypes((prev) => {
      const next = new Set<string>();
      for (const v of prev) {
        if (availableTypes.includes(v)) next.add(v);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [availableTypes]);

  const activeFilterCount =
    [assigneeFilter !== "all", dueDateFilter !== "all"].filter(Boolean).length +
    (search.trim() ? 1 : 0) +
    activeTypes.size;

  const clearAllFilters = () => {
    setAssigneeFilter("all");
    setDueDateFilter("all");
    setSearch("");
    setActiveTypes(new Set());
  };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search across title + household name
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        if (t.households?.name && t.households.name.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    // Task-type chip filter
    if (activeTypes.size > 0) {
      result = result.filter((t) => t.task_type && activeTypes.has(t.task_type));
    }

    // Firm-view-only filters
    if (activeTab === "all") {
      if (assigneeFilter !== "all") {
        result = result.filter((t) => t.assigned_to === assigneeFilter);
      }
      if (dueDateFilter !== "all") {
        const today = startOfToday();
        const weekEnd = endOfWeek(today);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        result = result.filter((t) => {
          if (dueDateFilter === "overdue") {
            if (!t.due_date || t.status === "done") return false;
            return new Date(t.due_date + "T00:00:00") < today;
          }
          if (dueDateFilter === "today") {
            if (!t.due_date) return false;
            const d = new Date(t.due_date + "T00:00:00");
            return d.getTime() === today.getTime();
          }
          if (dueDateFilter === "week") {
            if (!t.due_date) return false;
            const d = new Date(t.due_date + "T00:00:00");
            return d >= today && d <= weekEnd;
          }
          if (dueDateFilter === "month") {
            if (!t.due_date) return false;
            const d = new Date(t.due_date + "T00:00:00");
            return d >= today && d <= endOfMonth;
          }
          if (dueDateFilter === "none") {
            return !t.due_date;
          }
          return true;
        });
      }
    }

    return result;
  }, [tasks, search, activeTypes, activeTab, assigneeFilter, dueDateFilter]);

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleEditSubmit = async (values: EditableValues) => {
    if (!editTask) return;
    const { error } = await (supabase as any)
      .from("tasks")
      .update({
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        priority: values.priority,
        household_id: values.household_id,
        assigned_to: values.assigned_to,
      })
      .eq("id", editTask.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      throw error;
    }
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast({ title: "Task updated" });
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteTask.mutateAsync(deleteCandidate.id);
      toast({ title: "Task deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeleteCandidate(null);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <StickyPageHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
              <p className="text-muted-foreground mt-1 text-sm">Track follow-ups, reviews, and assignments.</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Task
          </Button>
        </div>
      </StickyPageHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TaskFilter)} className="space-y-4">
        <StickyTabsBar>
          <TabsList>
            <TabsTrigger value="mine">Assigned to Me</TabsTrigger>
            <TabsTrigger value="created">Created by Me</TabsTrigger>
            {showFirmView && <TabsTrigger value="all">Firm View</TabsTrigger>}
          </TabsList>
        </StickyTabsBar>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks or households…"
                className="pl-8 h-9 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-xs">
                <X className="w-3.5 h-3.5 mr-1" />
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </Button>
            )}
          </div>

          {availableTypes.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mr-1">
                Type
              </span>
              {availableTypes.map((type) => {
                const active = activeTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={cn(
                      "px-2 py-1 rounded-full border text-[11px] transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {formatTaskType(type)}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "all" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Assigned to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {uniqueAssignees.map((uid) => (
                    <SelectItem key={uid} value={uid}>
                      {uid === user.id ? "Me" : uid.slice(0, 8) + "..."}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Due date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="week">Due This Week</SelectItem>
                  <SelectItem value="month">Due This Month</SelectItem>
                  <SelectItem value="none">No Due Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="mine">
          <TaskList
            tasks={activeTab === "mine" ? filteredTasks : []}
            isLoading={activeTab === "mine" && isLoading}
            currentUserId={user.id}
            onEdit={setEditTask}
            onReassign={setReassignTask}
            onDelete={setDeleteCandidate}
            onClearFilters={clearAllFilters}
            isFiltered={activeFilterCount > 0}
          />
        </TabsContent>
        <TabsContent value="created">
          <TaskList
            tasks={activeTab === "created" ? filteredTasks : []}
            isLoading={activeTab === "created" && isLoading}
            currentUserId={user.id}
            onEdit={setEditTask}
            onReassign={setReassignTask}
            onDelete={setDeleteCandidate}
            onClearFilters={clearAllFilters}
            isFiltered={activeFilterCount > 0}
          />
        </TabsContent>
        {showFirmView && (
          <TabsContent value="all">
            <TaskList
              tasks={activeTab === "all" ? filteredTasks : []}
              isLoading={activeTab === "all" && isLoading}
              showAdvisor
              currentUserId={user.id}
              onEdit={setEditTask}
              onReassign={setReassignTask}
              onDelete={setDeleteCandidate}
              onClearFilters={clearAllFilters}
              isFiltered={activeFilterCount > 0}
            />
          </TabsContent>
        )}
      </Tabs>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />

      <CreateTaskDialog
        open={!!editTask}
        onOpenChange={(o) => !o && setEditTask(null)}
        mode="edit"
        initialTask={editTask}
        onSubmitEdit={handleEditSubmit}
      />

      <ReassignTaskDialog
        open={!!reassignTask}
        onOpenChange={(o) => !o && setReassignTask(null)}
        task={reassignTask}
      />

      <AlertDialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{deleteCandidate?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
