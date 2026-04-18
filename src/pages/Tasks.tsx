import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckSquare, Plus, AlertCircle, MoreHorizontal, ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
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
  useTasks, useCompleteTask, useUncompleteTask, useDeleteTask,
  useMarkNotificationsRead,
  type Task, type TaskFilter,
} from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import CreateTaskDialog, { type EditableValues } from "@/components/CreateTaskDialog";
import ReassignTaskDialog from "@/components/ReassignTaskDialog";

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

function initialsOf(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}
      </div>
    );
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 px-1">
          To Do · {todoTasks.length}
        </p>
        {todoTasks.length === 0 ? (
          <Card className="border-border shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nothing to do here.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border shadow-none overflow-hidden">
            {todoTasks.map((t) => (
              <TaskRow key={t.id} task={t} showAdvisor={showAdvisor} currentUserId={currentUserId}
                onEdit={onEdit} onReassign={onReassign} onDelete={onDelete} />
            ))}
          </Card>
        )}
      </div>

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
      <div className="mb-8 flex items-center justify-between">
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TaskFilter)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="mine">Assigned to Me</TabsTrigger>
          <TabsTrigger value="created">Created by Me</TabsTrigger>
          {showFirmView && <TabsTrigger value="all">Firm View</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine">
          <TaskList tasks={activeTab === "mine" ? tasks : []} isLoading={activeTab === "mine" && isLoading} currentUserId={user.id}
            onEdit={setEditTask} onReassign={setReassignTask} onDelete={setDeleteCandidate} />
        </TabsContent>
        <TabsContent value="created">
          <TaskList tasks={activeTab === "created" ? tasks : []} isLoading={activeTab === "created" && isLoading} currentUserId={user.id}
            onEdit={setEditTask} onReassign={setReassignTask} onDelete={setDeleteCandidate} />
        </TabsContent>
        {showFirmView && (
          <TabsContent value="all">
            <TaskList tasks={activeTab === "all" ? tasks : []} isLoading={activeTab === "all" && isLoading} showAdvisor currentUserId={user.id}
              onEdit={setEditTask} onReassign={setReassignTask} onDelete={setDeleteCandidate} />
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
