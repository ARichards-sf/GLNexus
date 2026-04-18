import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useIsAdmin } from "@/hooks/useAdmin";

export interface HouseholdRow {
  id: string;
  name: string;
  total_aum: number;
  risk_tolerance: string;
  investment_objective: string | null;
  status: string;
  wealth_tier: string | null;
  next_action: string | null;
  next_action_date: string | null;
  annual_review_date: string | null;
  last_review_date: string | null;
  advisor_id: string;
}

export interface MemberRow {
  id: string;
  household_id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
}

export interface NoteRow {
  id: string;
  household_id: string;
  date: string;
  type: string;
  summary: string;
  advisor_name: string | null;
  created_at: string;
}

function useTargetAdvisorId() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const id = user ? targetAdvisorId(user.id) : undefined;
  return { userId: user?.id, advisorId: id };
}

export function useHouseholds() {
  const { userId, advisorId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["households", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .eq("advisor_id", advisorId!)
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data as HouseholdRow[];
    },
    enabled: !!userId && !!advisorId,
  });
}

export function useHousehold(id: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["household", id, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as HouseholdRow;
    },
    enabled: !!userId && !!id,
  });
}

export function useHouseholdMembers(householdId: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["household_members", householdId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", householdId!)
        .is("archived_at", null);
      if (error) throw error;
      return data as MemberRow[];
    },
    enabled: !!userId && !!householdId,
  });
}

export function useArchivedHouseholdMembers(householdId: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["archived_members", householdId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", householdId!)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data as (MemberRow & { archived_at: string; archived_reason: string | null })[];
    },
    enabled: !!userId && !!householdId,
  });
}

export function useComplianceNotes(householdId: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["compliance_notes", householdId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_notes")
        .select("*")
        .eq("household_id", householdId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as NoteRow[];
    },
    enabled: !!userId && !!householdId,
  });
}

export function useCreateComplianceNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();

  return useMutation({
    mutationFn: async ({ householdId, type, summary }: { householdId: string; type: string; summary: string }) => {
      const advisorId = user ? targetAdvisorId(user.id) : user!.id;
      const { error } = await supabase.from("compliance_notes").insert({
        household_id: householdId,
        advisor_id: advisorId,
        type,
        summary,
        date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;

      // If Annual Review, update household's annual_review_date
      if (type === "Annual Review") {
        await supabase
          .from("households")
          .update({ annual_review_date: new Date().toISOString().split("T")[0] })
          .eq("id", householdId);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["compliance_notes"] });
      queryClient.invalidateQueries({ queryKey: ["all_compliance_notes"] });
      queryClient.invalidateQueries({ queryKey: ["household", vars.householdId] });
    },
  });
}

export function useAllComplianceNotes() {
  const { userId, advisorId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["all_compliance_notes", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_notes")
        .select("*, households(name)")
        .eq("advisor_id", advisorId!)
        .order("date", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!advisorId,
  });
}

export function useSnapshots() {
  const { userId, advisorId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["daily_snapshots", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_snapshots")
        .select("*")
        .eq("advisor_id", advisorId!)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!advisorId,
  });
}

export function useHouseholdSnapshots(householdId: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["household_snapshots", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_snapshots")
        .select("*")
        .eq("household_id", householdId!)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!householdId,
  });
}

export function useAccountSnapshots(accountIds: string[]) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["account_snapshots", accountIds],
    queryFn: async () => {
      if (accountIds.length === 0) return [];
      const { data, error } = await supabase
        .from("account_snapshots")
        .select("*")
        .in("account_id", accountIds)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && accountIds.length > 0,
  });
}

export function useGenerateSnapshot() {
  const { userId, advisorId } = useTargetAdvisorId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const targetId = advisorId || userId;
      if (!targetId) throw new Error("Not authenticated");
      const today = new Date().toISOString().split("T")[0];

      // 1. Fetch all households with their members
      const { data: households, error: hhErr } = await supabase
        .from("households")
        .select("id, total_aum")
        .eq("advisor_id", targetId);
      if (hhErr) throw hhErr;

      // 2. Fetch all accounts for this advisor
      const { data: accounts, error: accErr } = await supabase
        .from("contact_accounts")
        .select("id, balance, member_id")
        .eq("advisor_id", targetId);
      if (accErr) throw accErr;

      // 3. Fetch members to map account → household
      const { data: members, error: memErr } = await supabase
        .from("household_members")
        .select("id, household_id")
        .eq("advisor_id", targetId);
      if (memErr) throw memErr;

      const memberHousehold = new Map<string, string>();
      for (const m of members || []) {
        if (m.household_id) memberHousehold.set(m.id, m.household_id);
      }

      // 4. Account snapshots (upsert each)
      const accountRows = (accounts || []).map((a) => ({
        account_id: a.id,
        advisor_id: targetId,
        balance: Number(a.balance),
        snapshot_date: today,
      }));

      if (accountRows.length > 0) {
        const { error: accSnapErr } = await supabase
          .from("account_snapshots")
          .upsert(accountRows, { onConflict: "account_id,snapshot_date" });
        if (accSnapErr) throw accSnapErr;
      }

      // 5. Household snapshots — sum accounts per household
      const hhAum = new Map<string, number>();
      for (const a of accounts || []) {
        const hhId = memberHousehold.get(a.member_id);
        if (hhId) hhAum.set(hhId, (hhAum.get(hhId) || 0) + Number(a.balance));
      }

      const householdRows = (households || []).map((h) => ({
        household_id: h.id,
        advisor_id: targetId,
        total_aum: hhAum.get(h.id) || Number(h.total_aum),
        snapshot_date: today,
      }));

      if (householdRows.length > 0) {
        const { error: hhSnapErr } = await supabase
          .from("household_snapshots")
          .upsert(householdRows, { onConflict: "household_id,snapshot_date" });
        if (hhSnapErr) throw hhSnapErr;
      }

      // 6. Advisor-level daily snapshot
      const total_aum = householdRows.reduce((s, r) => s + r.total_aum, 0);
      const household_count = (households || []).length;

      const { error: upsertErr } = await supabase
        .from("daily_snapshots")
        .upsert(
          { advisor_id: targetId, snapshot_date: today, total_aum, household_count },
          { onConflict: "advisor_id,snapshot_date" }
        );
      if (upsertErr) throw upsertErr;

      return { total_aum, household_count, snapshot_date: today };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["household_snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["account_snapshots"] });
    },
  });
}

export function useArchiveHousehold() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();

  return useMutation({
    mutationFn: async ({ householdId, reason }: { householdId: string; reason?: string }) => {
      const advisorId = user ? targetAdvisorId(user.id) : user!.id;
      const { error } = await supabase
        .from("households")
        .update({
          archived_at: new Date().toISOString(),
          archived_reason: reason || "Archived by advisor",
          status: "Inactive",
        })
        .eq("id", householdId)
        .eq("advisor_id", advisorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["households"] });
      queryClient.invalidateQueries({ queryKey: ["households_archived"] });
      queryClient.invalidateQueries({ queryKey: ["all_compliance_notes"] });
    },
  });
}

export function useDeleteHouseholdAdmin() {
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();

  return useMutation({
    mutationFn: async (householdId: string) => {
      if (!isAdmin) throw new Error("Unauthorized");
      const { error } = await supabase
        .from("households")
        .delete()
        .eq("id", householdId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["households"] });
      queryClient.invalidateQueries({ queryKey: ["households_archived"] });
    },
  });
}

export function useArchivedHouseholds() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const advisorId = user ? targetAdvisorId(user.id) : undefined;

  return useQuery({
    queryKey: ["households_archived", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .eq("advisor_id", advisorId!)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data as HouseholdRow[];
    },
    enabled: !!advisorId,
  });
}

export function useDeleteHouseholdMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      force = false,
    }: {
      memberId: string;
      force?: boolean;
    }) => {
      // Check for active accounts
      const { data: activeAccounts } = await supabase
        .from("contact_accounts")
        .select("id")
        .eq("member_id", memberId)
        .eq("status", "active")
        .limit(1);

      if (activeAccounts && activeAccounts.length > 0 && !force) {
        throw new Error("HAS_ACTIVE_ACCOUNTS");
      }

      // Check for any account history (including closed/archived)
      const { data: allAccounts } = await supabase
        .from("contact_accounts")
        .select("id")
        .eq("member_id", memberId)
        .limit(1);

      const hasHistory = allAccounts && allAccounts.length > 0;

      if (hasHistory && !force) {
        // Archive instead of hard delete to preserve history
        const { error } = await supabase
          .from("household_members")
          .update({
            archived_at: new Date().toISOString(),
            archived_reason: "Archived by advisor",
          })
          .eq("id", memberId);
        if (error) throw error;
        return { action: "archived" as const };
      } else {
        // Hard delete — no account history
        const { error } = await supabase
          .from("household_members")
          .delete()
          .eq("id", memberId);
        if (error) throw error;
        return { action: "deleted" as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household_members"] });
      queryClient.invalidateQueries({ queryKey: ["archived_members"] });
      queryClient.invalidateQueries({ queryKey: ["household_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["all_contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useArchiveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      reason,
    }: {
      memberId: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("household_members")
        .update({
          archived_at: new Date().toISOString(),
          archived_reason: reason || "Archived by advisor",
        })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household_members"] });
      queryClient.invalidateQueries({ queryKey: ["archived_members"] });
      queryClient.invalidateQueries({ queryKey: ["all_contacts"] });
    },
  });
}
