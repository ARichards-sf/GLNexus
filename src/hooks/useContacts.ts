import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { calculateTierScore } from "@/lib/tierScoring";
import { MEMBER_SAFE_COLUMNS } from "@/lib/memberColumns";

// Check if AUM change warrants tier reassessment
// Only runs if no recent assessment and no review already pending
async function checkTierAfterAumChange(householdId: string) {
  try {
    const { data: hh } = await supabase
      .from("households")
      .select(`
        *,
        household_members(
          date_of_birth,
          relationship
        )
      `)
      .eq("id", householdId)
      .single();

    if (!hh) return;

    // Skip if assessed in last 30 days (avoid noise from minor changes)
    if ((hh as any).tier_last_assessed) {
      const daysSince =
        (Date.now() - new Date((hh as any).tier_last_assessed).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSince < 30) return;
    }

    // Skip if review already pending
    if ((hh as any).tier_pending_review) return;

    const { data: allHouseholds } = await supabase
      .from("households")
      .select("total_aum")
      .eq("advisor_id", hh.advisor_id)
      .is("archived_at", null);

    const bookAverage =
      allHouseholds && allHouseholds.length > 0
        ? allHouseholds.reduce((s, h) => s + Number(h.total_aum || 0), 0) /
          allHouseholds.length
        : 0;

    const { count: referralCount } = await supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("referred_by_household_id", householdId);

    const primary = (hh as any).household_members?.find(
      (m: any) => m.relationship === "Primary"
    );
    const age = primary?.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(primary.date_of_birth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : null;

    const scoreResult = calculateTierScore({
      householdAum: Number(hh.total_aum || 0),
      bookAverageAum: bookAverage,
      annualIncome: (hh as any).annual_income ?? null,
      primaryMemberAge: age,
      referralsSent: referralCount || 0,
      referredByTier: null,
    });

    const currentTier = hh.wealth_tier;
    const suggestedTier = scoreResult.recommendedTier;

    if (!currentTier || currentTier.toLowerCase() !== suggestedTier) {
      await supabase
        .from("households")
        .update({
          tier_score: scoreResult.total,
          tier_pending_review: suggestedTier,
          tier_pending_score: scoreResult.total,
          tier_pending_reason: `AUM change detected. Score ${scoreResult.total}/100 suggests ${suggestedTier}${currentTier ? ` (currently ${currentTier})` : ""}.`,
          tier_last_assessed: new Date().toISOString(),
        } as any)
        .eq("id", householdId);

      await supabase.from("tasks").insert({
        advisor_id: hh.advisor_id,
        created_by: hh.advisor_id,
        assigned_to: hh.advisor_id,
        title: `Review tier for ${hh.name} — ${suggestedTier.charAt(0).toUpperCase() + suggestedTier.slice(1)} recommended`,
        description: `AUM change detected. Score ${scoreResult.total}/100 recommends ${suggestedTier}.`,
        priority: "medium",
        status: "todo",
        task_type: "tier_review",
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        household_id: householdId,
        metadata: {
          current_tier: currentTier,
          suggested_tier: suggestedTier,
          score: scoreResult.total,
          trigger: "aum_change",
        },
      });
    }
  } catch (err) {
    console.error("Tier check failed:", err);
  }
}

async function getHouseholdIdForMember(memberId: string): Promise<string | null> {
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("id", memberId)
    .single();
  return data?.household_id ?? null;
}

async function getHouseholdIdForAccount(accountId: string): Promise<string | null> {
  const { data } = await supabase
    .from("contact_accounts")
    .select("member_id, household_members(household_id)")
    .eq("id", accountId)
    .single();
  const hm: any = (data as any)?.household_members;
  return hm?.household_id ?? null;
}

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

export function useAccount(id: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["contact_account", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_accounts")
        .select("*, household_members(id, first_name, last_name, household_id)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as AccountRow & {
        household_members: { id: string; first_name: string; last_name: string; household_id: string | null } | null;
      };
    },
    enabled: !!userId && !!id,
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TablesUpdate<"contact_accounts"> }) => {
      const { error } = await supabase
        .from("contact_accounts")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contact_account", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["contact_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["household_accounts"] });
      const householdId = await getHouseholdIdForAccount(vars.id);
      if (householdId) await checkTierAfterAumChange(householdId);
    },
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
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AccountRow[];
    },
    enabled: !!userId && !!memberId,
  });
}

export function useAllContactAccounts(memberId: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["all_contact_accounts", memberId],
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

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { user } = useTargetAdvisorId();
  return useMutation({
    mutationFn: async (data: Omit<TablesInsert<"contact_accounts">, "advisor_id">) => {
      const { error } = await supabase
        .from("contact_accounts")
        .insert({ ...data, advisor_id: user!.id });
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contact_accounts", vars.member_id] });
      queryClient.invalidateQueries({ queryKey: ["household_accounts"] });
      const householdId = await getHouseholdIdForMember(vars.member_id);
      if (householdId) await checkTierAfterAumChange(householdId);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      action,
      reason,
    }: {
      accountId: string;
      action: "close" | "archive" | "delete";
      reason?: string;
    }) => {
      if (action === "close") {
        const { error } = await supabase
          .from("contact_accounts")
          .update({
            status: "closed",
            closed_at: new Date().toISOString(),
            closed_reason: reason || "Closed by advisor",
          })
          .eq("id", accountId);
        if (error) throw error;
      } else if (action === "archive") {
        const { error } = await supabase
          .from("contact_accounts")
          .update({
            status: "archived",
            archived_at: new Date().toISOString(),
          })
          .eq("id", accountId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contact_accounts")
          .delete()
          .eq("id", accountId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["contact_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["all_contact_accounts"] });
    },
  });
}
