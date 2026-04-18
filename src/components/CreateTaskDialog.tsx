import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useHouseholds } from "@/hooks/useHouseholds";
import { useCreateTask, type Task } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTask?: Partial<Task> | null;
  mode?: "create" | "edit";
  onSubmitEdit?: (values: EditableValues) => Promise<void> | void;
}

export interface EditableValues {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: Task["priority"];
  household_id: string | null;
  assigned_to: string;
}

const PRIORITIES: Task["priority"][] = ["low", "medium", "high", "urgent"];

export default function CreateTaskDialog({ open, onOpenChange, initialTask, mode = "create", onSubmitEdit }: Props) {
  const { user } = useAuth();
  const { data: households = [] } = useHouseholds();
  const createTask = useCreateTask();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [householdId, setHouseholdId] = useState<string>("none");
  const [assignedTo, setAssignedTo] = useState<string>(user?.id ?? "");

  useEffect(() => {
    if (open) {
      setTitle(initialTask?.title ?? "");
      setDescription(initialTask?.description ?? "");
      setDueDate(initialTask?.due_date ?? "");
      setPriority((initialTask?.priority as Task["priority"]) ?? "medium");
      setHouseholdId(initialTask?.household_id ?? "none");
      setAssignedTo(initialTask?.assigned_to ?? user?.id ?? "");
    }
  }, [open, initialTask, user?.id]);

  const isEdit = mode === "edit";

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    try {
      if (isEdit && onSubmitEdit) {
        await onSubmitEdit({
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          priority,
          household_id: householdId === "none" ? null : householdId,
          assigned_to: assignedTo || user.id,
        });
      } else {
        await createTask.mutateAsync({
          advisor_id: user.id,
          assigned_to: assignedTo || user.id,
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          priority,
          household_id: householdId === "none" ? null : householdId,
        });
        toast({ title: "Task created" });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the task details." : "Create a task and optionally assign it to someone."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional details..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Household (optional)</Label>
            <Select value={householdId} onValueChange={setHouseholdId}>
              <SelectTrigger><SelectValue placeholder="No household" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No household</SelectItem>
                {households.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={user?.id ?? ""}>Myself</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">For now tasks can only be assigned to yourself. Reassign from the task menu to delegate.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createTask.isPending}>
            {isEdit ? "Save changes" : createTask.isPending ? "Creating..." : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
