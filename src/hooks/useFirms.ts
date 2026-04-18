import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Firm = Tables<"firms">;

export interface FirmWithCounts extends Firm {
  advisor_count: number;
  total_aum: number;
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
        .select("firm_id, user_id, role")
        .eq("role", "advisor");
      if (mErr) throw mErr;

      // advisor counts + advisor->firm mapping
      const counts = new Map<string, number>();
      const advisorsByFirm = new Map<string, string[]>();
      memberships?.forEach((m) => {
        counts.set(m.firm_id, (counts.get(m.firm_id) || 0) + 1);
        const arr = advisorsByFirm.get(m.firm_id) || [];
        arr.push(m.user_id);
        advisorsByFirm.set(m.firm_id, arr);
      });

      // Fetch all relevant households once
      const allAdvisorIds = Array.from(
        new Set((memberships || []).map((m) => m.user_id)),
      );

      let householdsByAdvisor = new Map<string, number>();
      if (allAdvisorIds.length > 0) {
        const { data: households, error: hErr } = await supabase
          .from("households")
          .select("advisor_id, total_aum")
          .in("advisor_id", allAdvisorIds)
          .is("archived_at", null);
        if (hErr) throw hErr;

        households?.forEach((h) => {
          householdsByAdvisor.set(
            h.advisor_id,
            (householdsByAdvisor.get(h.advisor_id) || 0) + Number(h.total_aum),
          );
        });
      }

      return (firms || []).map((f) => {
        const advisorIds = advisorsByFirm.get(f.id) || [];
        const total_aum = advisorIds.reduce(
          (sum, aid) => sum + (householdsByAdvisor.get(aid) || 0),
          0,
        );
        return {
          ...f,
          advisor_count: counts.get(f.id) || 0,
          total_aum,
        };
      }) as FirmWithCounts[];
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
