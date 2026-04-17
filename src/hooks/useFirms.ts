import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Firm = Tables<"firms">;

export interface FirmWithCounts extends Firm {
  advisor_count: number;
}

export function useFirms() {
  return useQuery({
    queryKey: ["firms_with_counts"],
    queryFn: async () => {
      const { data: firms, error } = await supabase
        .from("firms")
        .select("*")
        .order("name");
      if (error) throw error;

      const { data: memberships, error: mErr } = await supabase
        .from("firm_memberships")
        .select("firm_id, role")
        .eq("role", "advisor");
      if (mErr) throw mErr;

      const counts = new Map<string, number>();
      memberships?.forEach((m) => {
        counts.set(m.firm_id, (counts.get(m.firm_id) || 0) + 1);
      });

      return (firms || []).map((f) => ({
        ...f,
        advisor_count: counts.get(f.id) || 0,
      })) as FirmWithCounts[];
    },
  });
}

export function useCreateFirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TablesInsert<"firms">) => {
      const { error } = await supabase.from("firms").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firms_with_counts"] });
      queryClient.invalidateQueries({ queryKey: ["firm_memberships"] });
    },
  });
}
