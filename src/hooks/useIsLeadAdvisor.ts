import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true when the current user has at least one firm membership
 * with is_lead_advisor = true.
 */
export function useIsLeadAdvisor() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_lead_advisor", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firm_memberships")
        .select("id")
        .eq("user_id", user!.id)
        .eq("is_lead_advisor", true)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
}
