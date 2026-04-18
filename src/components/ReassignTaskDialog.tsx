import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlProfile } from "@/hooks/useAdmin";
import type { Task } from "@/hooks/useTasks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}

interface AssigneeOption {
  user_id: string;
  full_name: string;
  email: string | null;
}

function useAssignableUsers() {
  const { user } = useAuth();
  const { data: glProfile } = useGlProfile();

  return useQuery({
    queryKey: ["assignable_users", user?.id, glProfile?.is_gl_internal],
    enabled: !!user,
    queryFn: async (): Promise<AssigneeOption[]> => {
      const me: AssigneeOption = {
        user_id: user!.id,
        full_name: user!.user_metadata?.full_name || user!.email || "Me",
        email: user!.email ?? null,
      };

      // GL internal: only self.
      if (glProfile?.is_gl_internal) return [me];

      // Look up the user's firm_id from their profile.
      const { data: myProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("firm_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (profileErr) throw profileErr;

      if (!myProfile?.firm_id) return [me];

      // All firm members in the same firm.
      const { data: memberships, error: memErr } = await supabase
        .from("firm_memberships")
        .select("user_id")
        .eq("firm_id", myProfile.firm_id);
      if (memErr) throw memErr;

      const userIds = Array.from(
        new Set([user!.id, ...(memberships ?? []).map((m) => m.user_id)])
      );

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (profErr) throw profErr;

      const list: AssigneeOption[] = (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name || p.email || "Unknown",
        email: p.email,
      }));

      // Ensure current user is in the list
      if (!list.some((u) => u.user_id === user!.id)) list.unshift(me);
      // Sort: self first, then alpha
      list.sort((a, b) => {
        if (a.user_id === user!.id) return -1;
        if (b.user_id === user!.id) return 1;
        return a.full_name.localeCompare(b.full_name);
      });
      return list;
    },
  });
}

export default function ReassignTaskDialog({
  open,
  onOpenChange,
  task,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: assignees = [] } = useAssignableUsers();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset selected user when dialog opens with a new task
  useEffect(() => {
    if (open && task) {
      setSelectedUserId(task.assigned_to);
    }
  }, [open, task]);

  const handleSave = async () => {
    if (!task || !selectedUserId) return;

    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("tasks")
        .update({ assigned_to: selectedUserId })
        .eq("id", task.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task reassigned");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reassign task");
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = !!selectedUserId && selectedUserId !== task?.assigned_to && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {task && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{task.title}</span>
              <p className="mt-1">
                Currently assigned to: {task.assigned_profile?.full_name || "Unknown"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.user_id === user?.id ? `${a.full_name} (Me)` : a.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
