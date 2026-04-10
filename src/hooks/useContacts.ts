import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type MemberRow = Tables<"household_members">;
export type AccountRow = Tables<"contact_accounts">;

export type ContactWithHousehold = MemberRow & {
  households: { name: string } | null;
};

export function useAllContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all_contacts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("*, households(name)")
        .order("last_name");
      if (error) throw error;
      return data as ContactWithHousehold[];
    },
    enabled: !!user,
  });
}

export function useContact(id: string | undefined) {
  const { user } = useAuth();
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
    enabled: !!user && !!id,
  });
}

export function useContactAccounts(memberId: string | undefined) {
  const { user } = useAuth();
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
    enabled: !!user && !!memberId,
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
  const { user } = useAuth();
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
