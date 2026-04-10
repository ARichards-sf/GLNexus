import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AccountRow } from "@/hooks/useContacts";

export function useHouseholdAccounts(householdId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["household_accounts", householdId, user?.id],
    queryFn: async () => {
      // Get all members of this household, then get their accounts
      const { data: members, error: mErr } = await supabase
        .from("household_members")
        .select("id, first_name, last_name")
        .eq("household_id", householdId!);
      if (mErr) throw mErr;
      if (!members || members.length === 0) return [];

      const memberIds = members.map((m) => m.id);
      const { data: accounts, error: aErr } = await supabase
        .from("contact_accounts")
        .select("*")
        .in("member_id", memberIds)
        .order("balance", { ascending: false });
      if (aErr) throw aErr;

      const memberMap: Record<string, string> = {};
      members.forEach((m) => { memberMap[m.id] = `${m.first_name} ${m.last_name}`; });

      return (accounts || []).map((a) => ({
        ...a,
        owner_name: memberMap[a.member_id] || "Unknown",
      }));
    },
    enabled: !!user && !!householdId,
  });
}
