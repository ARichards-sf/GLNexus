import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import type { Task } from "@/hooks/useTasks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onReassign: (newAssigneeId: string) => Promise<void> | void;
}

export default function ReassignTaskDialog({ open, onOpenChange, task, onReassign }: Props) {
  const { user } = useAuth();
  const [assignee, setAssignee] = useState<string>("");

  useEffect(() => {
    if (open) setAssignee(task?.assigned_to ?? user?.id ?? "");
  }, [open, task, user?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Reassign task</DialogTitle>
          <DialogDescription>Pick who should own this task.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Assign to</Label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={user?.id ?? ""}>Myself</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Team-member assignment will become available once firm staff are onboarded.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => { await onReassign(assignee); onOpenChange(false); }}>Reassign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
