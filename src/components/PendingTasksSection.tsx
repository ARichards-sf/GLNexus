import { Link } from "react-router-dom";
import { Check, CheckSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTasks, useCompleteTask, type Task } from "@/hooks/useTasks";

const PRIORITY_TONE: Record<Task["priority"], string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-amber-muted text-amber",
  low: "bg-secondary text-muted-foreground",
};

const SECTION_LIMIT = 5;

const isOverdue = (dueDate: string | null) =>
  !!dueDate && new Date(dueDate).getTime() < Date.now() - 24 * 60 * 60 * 1000;

const formatDue = (iso: string | null) => {
  if (!iso) return "No due date";
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ds = new Date(date);
  ds.setHours(0, 0, 0, 0);
  if (ds.getTime() === today.getTime()) return "Today";
  if (ds.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (ds < today) {
    const days = Math.floor((today.getTime() - ds.getTime()) / 86400000);
    return `${days}d overdue`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Top-priority pending tasks for the right sidebar. Shows the next handful
 * (urgent + overdue first), with one-click complete from any page. The
 * section header in CopilotSidebar provides the count badge; this body
 * just renders rows.
 */
export default function PendingTasksSection() {
  const { data: tasks = [], isLoading } = useTasks("mine");
  const completeTask = useCompleteTask();

  // Filter to incomplete, then sort by:
  // 1. Overdue first
  // 2. Priority (urgent → low)
  // 3. Due date ascending (nulls last)
  const PRIORITY_RANK: Record<Task["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const open = tasks.filter((t) => t.status === "todo");
  const sorted = [...open].sort((a, b) => {
    const ao = isOverdue(a.due_date) ? 0 : 1;
    const bo = isOverdue(b.due_date) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const ap = PRIORITY_RANK[a.priority] ?? 4;
    const bp = PRIORITY_RANK[b.priority] ?? 4;
    if (ap !== bp) return ap - bp;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });
  const visible = sorted.slice(0, SECTION_LIMIT);

  const handleComplete = async (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await completeTask.mutateAsync(task.id);
      toast.success(`Completed "${task.title}"`);
    } catch (err: any) {
      toast.error(`Couldn't complete task: ${err.message}`);
    }
  };

  return (
    <div className="px-3 py-2 space-y-1.5">
      {isLoading ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 mx-auto mb-1 animate-spin" />
          Loading tasks…
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-4">
          <CheckSquare className="w-5 h-5 mx-auto mb-1 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">All caught up — no open tasks.</p>
        </div>
      ) : (
        <>
          {visible.map((t) => {
            const overdue = isOverdue(t.due_date);
            return (
              <Link
                key={t.id}
                to={`/tasks/${t.id}`}
                className="group flex items-start gap-2 p-2 rounded-md border border-border bg-card hover:bg-secondary/40 hover:border-primary/30 transition-colors"
              >
                <button
                  type="button"
                  onClick={(e) => handleComplete(e, t)}
                  disabled={completeTask.isPending}
                  className="shrink-0 mt-0.5 w-4 h-4 rounded border border-muted-foreground/40 hover:border-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                  aria-label="Mark task complete"
                >
                  <Check className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100" strokeWidth={3} />
                </button>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-foreground leading-snug line-clamp-1">
                    {t.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span
                      className={cn(
                        "px-1.5 py-0 rounded text-[9px] font-medium uppercase tracking-wide",
                        PRIORITY_TONE[t.priority],
                      )}
                    >
                      {t.priority}
                    </span>
                    <span className={cn("text-muted-foreground", overdue && "text-destructive font-medium")}>
                      {formatDue(t.due_date)}
                    </span>
                    {t.households?.name && (
                      <span className="text-muted-foreground truncate">· {t.households.name}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
          {sorted.length > SECTION_LIMIT && (
            <Link
              to="/tasks"
              className="block text-center text-[11px] text-muted-foreground hover:text-foreground py-1"
            >
              View all {sorted.length} open tasks →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
