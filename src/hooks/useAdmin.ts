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

export function useIsInternal() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_internal", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_internal")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data?.is_internal;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGlProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["gl_profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_gl_internal, platform_role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        is_gl_internal: !!data?.is_gl_internal,
        platform_role: (data?.platform_role ?? null) as string | null,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsGlInternal() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_gl_internal", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_gl_internal")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data?.is_gl_internal;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVpmStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["vpm_status", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("vpm_enabled, vpm_billing_type")
        .eq("user_id", user!.id)
        .maybeSingle();
      return {
        isVpm: !!(data as any)?.vpm_enabled,
        isPrimePartner: (data as any)?.vpm_billing_type === "prime_partner",
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsAdmin() {
  const { data: glProfile, isLoading } = useGlProfile();
  const platformRole = glProfile?.platform_role || "user";

  const isSuperAdmin =
    !!glProfile?.is_gl_internal && platformRole === "super_admin";

  const isDeveloper =
    !!glProfile?.is_gl_internal &&
    (platformRole === "developer" || isSuperAdmin);

  const isAdmin =
    !!glProfile?.is_gl_internal &&
    (platformRole === "admin" || isDeveloper);

  const isManager =
    !!glProfile?.is_gl_internal &&
    (platformRole === "manager" || isAdmin);

  // isAdmin check for AdminRoute — any GL internal user can access
  // admin routes, individual pages handle their own visibility
  const canAccessAdmin = !!glProfile?.is_gl_internal;

  return {
    isAdmin,
    isManager,
    isSuperAdmin,
    isDeveloper,
    canAccessAdmin,
    isGLInternal: !!glProfile?.is_gl_internal,
    isLoading,
  };
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
  is_internal?: boolean;
  office_location?: string | null;
  households?: { id: string; name: string; total_aum: number }[];
  is_prime_partner?: boolean;
  vpm_enabled?: boolean;
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

export function useAdvisorDetail(userId: string | undefined) {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["admin_advisor_detail", userId],
    queryFn: async () => {
      const data = await callAdmin("get_advisor", { user_id: userId });
      return data.advisor as AdvisorRecord;
    },
    enabled: isAdmin && !!userId,
  });
}

export function useInviteAdvisor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; password: string; full_name?: string; office_location?: string; firm_id?: string }) =>
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
      queryClient.invalidateQueries({ queryKey: ["admin_advisor_detail"] });
    },
  });
}

export function useUpdateAdvisorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      user_id: string;
      full_name?: string;
      office_location?: string;
      vpm_enabled?: boolean;
      vpm_billing_type?: string | null;
      vpm_hourly_rate?: number | null;
      vpm_notes?: string | null;
    }) => callAdmin("update_advisor_profile", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_advisors"] });
      queryClient.invalidateQueries({ queryKey: ["admin_advisor_detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
    },
  });
}

export function useResetAdvisorPassword() {
  return useMutation({
    mutationFn: (payload: { user_id: string; new_password: string }) =>
      callAdmin("reset_advisor_password", payload),
  });
}

export function useUpdateAdvisorRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: string; role: string }) =>
      callAdmin("update_advisor_role", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_advisors"] });
      queryClient.invalidateQueries({ queryKey: ["admin_advisor_detail"] });
    },
  });
}

export function useToggleInternal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: string; is_internal: boolean }) =>
      callAdmin("toggle_internal", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_advisors"] });
      queryClient.invalidateQueries({ queryKey: ["admin_advisor_detail"] });
    },
  });
}

export interface AutomationLog {
  id: string;
  function_name: string;
  status: string;
  message: string | null;
  records_processed: number;
  started_at: string;
  completed_at: string | null;
}

export function useAutomationLogs() {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["automation_logs"],
    queryFn: async () => {
      const data = await callAdmin("get_automation_logs");
      return data.logs as AutomationLog[];
    },
    enabled: isAdmin,
  });
}

export function useRunSnapshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => callAdmin("run_snapshots"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
    },
  });
}

export interface InternalUserRecord {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  platform_role: string | null;
  department: string | null;
  office_location: string | null;
  is_gl_internal: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  firm_assignments: { firm_id: string; firm: { id: string; name: string; accent_color: string | null } | null }[];
}

export function useInternalUsers() {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["internal_users"],
    queryFn: async () => {
      const data = await callAdmin("list_internal_users");
      return data.internal_users as InternalUserRecord[];
    },
    enabled: isAdmin,
  });
}

export function useInviteInternalUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; password: string; full_name: string; platform_role: string; department?: string }) =>
      callAdmin("invite_internal_user", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal_users"] });
    },
  });
}

export function useUpdateInternalUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: string; platform_role?: string; department?: string; full_name?: string; office_location?: string }) =>
      callAdmin("update_internal_user", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal_users"] });
    },
  });
}

export function useAssignInternalUserFirms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: string; firm_ids: string[] }) =>
      callAdmin("assign_internal_user_firms", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal_users"] });
    },
  });
}
