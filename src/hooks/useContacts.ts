import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type MemberRow = Tables<"household_members">;
export type AccountRow = Tables<"contact_accounts">;

export type ContactWithHousehold = MemberRow & {
  households: { name: string } | null;
};

function useTargetAdvisorId() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const id = user ? targetAdvisorId(user.id) : undefined;
  return { userId: user?.id, advisorId: id, user };
}

export function useAllContacts() {
  const { userId, advisorId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["all_contacts", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("*, households(name)")
        .eq("advisor_id", advisorId!)
        .order("last_name");
      if (error) throw error;
      return data as ContactWithHousehold[];
    },
    enabled: !!userId && !!advisorId,
  });
}

export function useContact(id: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("*, households(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!id,
  });
}

export function useContactAccounts(memberId: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["contact_accounts", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_accounts")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AccountRow[];
    },
    enabled: !!userId && !!memberId,
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TablesUpdate<"household_members"> }) => {
      const { error } = await supabase
        .from("household_members")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contact", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["household_members"] });
    },
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  const { user } = useTargetAdvisorId();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<"household_members">, "advisor_id">) => {
      const { error } = await supabase
        .from("household_members")
        .insert({ ...data, advisor_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household_members"] });
      queryClient.invalidateQueries({ queryKey: ["all_contacts"] });
    },
  });
}
