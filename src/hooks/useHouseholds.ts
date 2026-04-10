import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

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
        .eq("household_id", householdId!);
      if (error) throw error;
      return data as MemberRow[];
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
