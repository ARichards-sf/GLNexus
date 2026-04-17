import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type FirmMembership = Tables<"firm_memberships">;
type Firm = Tables<"firms">;

type FirmMembershipWithFirm = FirmMembership & {
  firms: Firm | null;
};

export interface FirmContextResult {
  currentFirm: Firm | null;
  allFirms: Firm[];
  membershipRole: string | null;
  isLoading: boolean;
}

export function useFirmContext(): FirmContextResult {
  const { user } = useAuth();

  const { data: memberships, isLoading } = useQuery({
    queryKey: ["firm_memberships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firm_memberships")
        .select(`
          *,
          firms(*)
        `)
        .eq("user_id", user!.id)
        .order("created_at");
      
      if (error) throw error;
      return data as FirmMembershipWithFirm[];
    },
    enabled: !!user,
  });

  const allFirms: Firm[] =
    memberships?.map((m) => m.firms).filter((f): f is Firm => f !== null) ?? [];

  const currentMembership = memberships?.[0] ?? null;
  const currentFirm = currentMembership?.firms ?? null;
  const membershipRole = currentMembership?.role ?? null;

  return {
    currentFirm,
    allFirms,
    membershipRole,
    isLoading,
  };
}
