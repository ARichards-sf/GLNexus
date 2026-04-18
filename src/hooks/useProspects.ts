import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export interface Prospect {
  id: string;
  advisor_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  pipeline_stage:
    | "lead"
    | "contacted"
    | "meeting_scheduled"
    | "discovery_complete"
    | "proposal_sent"
    | "converted"
    | "lost";
  estimated_aum: number | null;
  source: string | null;
  referred_by: string | null;
  notes: string | null;
  converted_household_id: string | null;
  converted_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const PIPELINE_STAGES = [
  {
    key: "lead",
    label: "Lead",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  {
    key: "contacted",
    label: "Contacted",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  },
  {
    key: "meeting_scheduled",
    label: "Meeting Scheduled",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  },
  {
    key: "discovery_complete",
    label: "Discovery Complete",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
  {
    key: "proposal_sent",
    label: "Proposal Sent",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  },
  {
    key: "converted",
    label: "Converted",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  {
    key: "lost",
    label: "Lost",
    color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  },
] as const;

export const PROSPECT_SOURCES = [
  "referral",
  "event",
  "cold_outreach",
  "social_media",
  "existing_client",
  "other",
] as const;

function useTargetAdvisorId() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const id = user ? targetAdvisorId(user.id) : undefined;
  return { userId: user?.id, advisorId: id };
}

export function useProspects(includeAll: boolean = false) {
  const { userId, advisorId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["prospects", advisorId, includeAll],
    queryFn: async () => {
      let query = supabase
        .from("prospects")
        .select("*")
        .eq("advisor_id", advisorId!)
        .order("created_at", { ascending: false });

      if (!includeAll) {
        query = query.not("pipeline_stage", "in", "(converted,lost)");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Prospect[];
    },
    enabled: !!userId && !!advisorId,
    staleTime: 60 * 1000,
  });
}

export function useProspect(id: string | undefined) {
  const { userId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["prospect", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Prospect;
    },
    enabled: !!userId && !!id,
  });
}

export function useCreateProspect() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();

  return useMutation({
    mutationFn: async (
      input: Partial<Omit<Prospect, "id" | "advisor_id" | "created_at" | "updated_at">> & {
        first_name: string;
        last_name: string;
      }
    ) => {
      const advisorId = user ? targetAdvisorId(user.id) : user!.id;
      const { data, error } = await supabase
        .from("prospects")
        .insert({
          ...input,
          advisor_id: advisorId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Prospect;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
  });
}

export function useUpdateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Prospect> }) => {
      const { data, error } = await supabase
        .from("prospects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Prospect;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["prospect", vars.id] });
    },
  });
}

export function useDeleteProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
  });
}

export function useConvertProspect() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();

  return useMutation({
    mutationFn: async (prospect: Prospect): Promise<{ householdId: string }> => {
      const advisorId = user ? targetAdvisorId(user.id) : user!.id;

      // 1. Create new household from prospect data
      const { data: household, error: hhErr } = await supabase
        .from("households")
        .insert({
          name: `${prospect.first_name} ${prospect.last_name} Family`,
          advisor_id: advisorId,
          total_aum: prospect.estimated_aum || 0,
          status: "Onboarding",
          risk_tolerance: "Moderate",
        })
        .select()
        .single();
      if (hhErr) throw hhErr;

      // 2. Update the prospect
      const { error: updErr } = await supabase
        .from("prospects")
        .update({
          pipeline_stage: "converted",
          converted_household_id: household.id,
          converted_at: new Date().toISOString(),
        })
        .eq("id", prospect.id);
      if (updErr) throw updErr;

      return { householdId: household.id };
    },
    onSuccess: (_, prospect) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["households"] });
      queryClient.invalidateQueries({ queryKey: ["prospect", prospect.id] });
    },
  });
}
