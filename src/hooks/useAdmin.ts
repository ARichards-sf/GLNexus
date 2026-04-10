import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r) => r.role);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsAdmin() {
  const { data: roles = [], isLoading } = useUserRole();
  return { isAdmin: roles.includes("admin"), isLoading };
}

async function callAdmin(action: string, payload: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await supabase.functions.invoke("admin-operations", {
    body: { action, ...payload },
  });
  if (res.error) throw new Error(res.error.message || "Admin operation failed");
  return res.data;
}

export function useAdminStats() {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["admin_stats"],
    queryFn: () => callAdmin("system_stats"),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
}

export interface AdvisorRecord {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  total_aum: number;
  household_count: number;
  roles: string[];
  last_sign_in_at: string | null;
  created_at: string;
}

export function useAdminAdvisors() {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["admin_advisors"],
    queryFn: async () => {
      const data = await callAdmin("list_advisors");
      return data.advisors as AdvisorRecord[];
    },
    enabled: isAdmin,
  });
}

export function useInviteAdvisor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; full_name?: string; office_location?: string }) =>
      callAdmin("invite_advisor", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_advisors"] });
      queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
    },
  });
}

export function useToggleAdvisorStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: string; status: string }) =>
      callAdmin("toggle_status", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_advisors"] });
    },
  });
}
