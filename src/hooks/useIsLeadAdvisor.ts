import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsLeadAdvisor() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_lead_advisor", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firm_memberships")
        .select("is_lead_advisor")
        .eq("user_id", user!.id)
        .eq("is_lead_advisor", true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}
