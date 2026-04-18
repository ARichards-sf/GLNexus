import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHouseholds } from "@/hooks/useHouseholds";
import { useGlProfile } from "@/hooks/useAdmin";
import { useCreateTask, type Task } from "@/hooks/useTasks";

const PRIORITIES: Task["priority"][] = ["low", "medium", "high", "urgent"];

export interface EditableValues {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: Task["priority"];
  household_id: string | null;
  assigned_to: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultHouseholdId?: string;
  defaultHouseholdName?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultAssignedTo?: string;
  defaultTaskType?: string;
  // Optional edit-mode hooks (used by Tasks page; create-mode ignores these)
  mode?: "create" | "edit";
  initialTask?: Partial<Task> | null;
  onSubmitEdit?: (values: EditableValues) => Promise<void> | void;
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

export default function CreateTaskDialog({
  open,
  onOpenChange,
  defaultHouseholdId,
  defaultHouseholdName,
  defaultTitle,
  defaultDescription,
  defaultAssignedTo,
  defaultTaskType,
  mode = "create",
  initialTask,
  onSubmitEdit,
}: Props) {
  const { user } = useAuth();
  const { data: households = [] } = useHouseholds();
  const { data: assignees = [] } = useAssignableUsers();
  const createTask = useCreateTask();

  const isEdit = mode === "edit";
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Pre-selected household (lock when defaultHouseholdId provided in create mode)
  const preSelected = useMemo(() => {
    const id = isEdit ? initialTask?.household_id ?? null : defaultHouseholdId ?? null;
    if (!id) return null;
    const name =
      (isEdit ? initialTask?.households?.name : defaultHouseholdName) ??
      households.find((h) => h.id === id)?.name ??
      "Selected household";
    return { id, name };
  }, [isEdit, initialTask, defaultHouseholdId, defaultHouseholdName, households]);

  const householdLocked = !isEdit && !!defaultHouseholdId;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [selectedHousehold, setSelectedHousehold] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Reset / hydrate when dialog opens
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setTitle(initialTask?.title ?? "");
      setDescription(initialTask?.description ?? "");
      setDueDate(initialTask?.due_date ?? "");
      setPriority((initialTask?.priority as Task["priority"]) ?? "medium");
      setAssignedTo(initialTask?.assigned_to ?? user?.id ?? "");
    } else {
      setTitle(defaultTitle ?? "");
      setDescription(defaultDescription ?? "");
      setDueDate("");
      setPriority("medium");
      setAssignedTo(defaultAssignedTo ?? user?.id ?? "");
    }
    setSelectedHousehold(preSelected);
    setSearch("");
    setShowResults(false);
  }, [open, isEdit, initialTask, defaultTitle, defaultDescription, defaultAssignedTo, preSelected, user?.id]);

  // Fallback: ensure assignedTo is set once assignees load
  useEffect(() => {
    if (assignees.length > 0 && !assignedTo) {
      setAssignedTo(defaultAssignedTo ?? user?.id ?? "");
    }
  }, [assignees, assignedTo, defaultAssignedTo, user?.id]);

  // Click-outside to close household search dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filteredHouseholds = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return households.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 8);
  }, [search, households]);

  const canSubmit = !!title.trim() && !!assignedTo && !createTask.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;

    const householdId = selectedHousehold?.id ?? null;

    try {
      if (isEdit && onSubmitEdit) {
        await onSubmitEdit({
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          priority,
          household_id: householdId,
          assigned_to: assignedTo,
        });
      } else {
        await createTask.mutateAsync({
          advisor_id: user.id,
          assigned_to: assignedTo,
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          priority,
          household_id: householdId,
          task_type: defaultTaskType ?? "manual",
        });
        toast.success("Task created");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save task");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                min={isEdit ? undefined : todayStr}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
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

          <div className="space-y-2" ref={wrapRef}>
            <Label>Linked Household</Label>
            {selectedHousehold ? (
              <Badge variant="secondary" className="text-sm py-1.5 pl-3 pr-1.5 gap-1.5">
                {selectedHousehold.name}
                {!householdLocked && (
                  <button
                    type="button"
                    onClick={() => { setSelectedHousehold(null); setSearch(""); }}
                    className="rounded-full hover:bg-background/60 p-0.5"
                    aria-label="Clear household"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search households..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  className="pl-8"
                />
                {showResults && filteredHouseholds.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-auto">
                    {filteredHouseholds.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setSelectedHousehold({ id: h.id, name: h.name });
                          setShowResults(false);
                          setSearch("");
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 transition-colors"
                      >
                        {h.name}
                      </button>
                    ))}
                  </div>
                )}
                {showResults && search.trim() && filteredHouseholds.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md p-3 text-sm text-muted-foreground">
                    No households found.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>
              {isEdit ? "Save changes" : createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
