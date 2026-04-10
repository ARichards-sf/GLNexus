import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HouseholdRow {
  id: string;
  name: string;
  total_aum: number;
  risk_tolerance: string;
  investment_objective: string | null;
  status: string;
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

export function useHouseholds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["households", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as HouseholdRow[];
    },
    enabled: !!user,
  });
}

export function useHousehold(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["household", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as HouseholdRow;
    },
    enabled: !!user && !!id,
  });
}

export function useHouseholdMembers(householdId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["household_members", householdId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", householdId!);
      if (error) throw error;
      return data as MemberRow[];
    },
    enabled: !!user && !!householdId,
  });
}

export function useComplianceNotes(householdId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["compliance_notes", householdId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_notes")
        .select("*")
        .eq("household_id", householdId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as NoteRow[];
    },
    enabled: !!user && !!householdId,
  });
}

export function useAllComplianceNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all_compliance_notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_notes")
        .select("*, households(name)")
        .order("date", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
