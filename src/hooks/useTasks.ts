import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Task {
  id: string;
  advisor_id: string;
  created_by: string;
  assigned_to: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "done";
  task_type: string;
  household_id: string | null;
  contact_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  completed_at: string | null;
  households?: { id: string; name: string } | null;
  assigned_profile?: { full_name: string | null; user_id: string } | null;
  created_profile?: { full_name: string | null; user_id: string } | null;
}

export type TaskFilter = "mine" | "created" | "all";

export interface CreateTaskInput {
  advisor_id: string;
  assigned_to: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: Task["priority"];
  status?: Task["status"];
  task_type?: string;
  household_id?: string | null;
  contact_id?: string | null;
  metadata?: Record<string, any> | null;
}

export function useTasks(filter: TaskFilter = "all") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tasks", filter],
    enabled: !!user,
    staleTime: 60 * 1000,     // 1 minute
    gcTime: 5 * 60 * 1000,    // 5 minutes
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Task[]> => {
      let query = (supabase as any)
        .from("tasks")
        .select(
          `
          *,
          households:household_id ( id, name ),
          assigned_profile:profiles!tasks_assigned_to_fkey ( full_name, user_id ),
          created_profile:profiles!tasks_created_by_fkey ( full_name, user_id )
        `
        );

      if (filter === "mine") {
        query = query.eq("assigned_to", user!.id);
      } else if (filter === "created") {
        query = query.eq("created_by", user!.id);
      }

      const { data, error } = await query
        .order("status", { ascending: true }) // 'done' > 'todo' alphabetically — 'done' last
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Defensive: ensure 'todo' comes before 'done' regardless of collation
      const rows = (data ?? []) as Task[];
      return rows.sort((a, b) => {
        if (a.status !== b.status) return a.status === "todo" ? -1 : 1;
        return 0;
      });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      if (!user) throw new Error("Not authenticated");

      const insertPayload = {
        ...input,
        created_by: user.id,
      };

      const { data: task, error } = await (supabase as any)
        .from("tasks")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) throw error;

      if (task.assigned_to && task.assigned_to !== user.id) {
        const { error: notifError } = await (supabase as any)
          .from("task_notifications")
          .insert({
            task_id: task.id,
            user_id: task.assigned_to,
          });
        if (notifError) throw notifError;
      }

      return task as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_notification_count"] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await (supabase as any)
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUncompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await (supabase as any)
        .from("tasks")
        .update({ status: "todo", completed_at: null })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("created_by", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useTaskNotificationCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["task_notification_count"],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("task_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("task_notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task_notification_count"] });
    },
  });
}
