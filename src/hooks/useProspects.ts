import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { calculateTierScore, scoreToTier } from "@/lib/tierScoring";
import { embedRecord } from "@/lib/embedRecord";
import { emitActivityEvent } from "@/hooks/useActivityEvents";

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
  referred_by_household_id: string | null;
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
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Prospect> }) => {
      // Snapshot the previous stage so we can emit a "moved from X to Y"
      // activity event when the stage actually changes.
      let previousStage: string | undefined;
      if ("pipeline_stage" in updates) {
        const { data: prev } = await supabase
          .from("prospects")
          .select("pipeline_stage")
          .eq("id", id)
          .maybeSingle();
        previousStage = (prev as any)?.pipeline_stage;
      }

      const { data, error } = await supabase
        .from("prospects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Emit pipeline_changed event when the stage actually moved.
      if (
        user &&
        previousStage &&
        updates.pipeline_stage &&
        previousStage !== updates.pipeline_stage
      ) {
        const advisorId = targetAdvisorId(user.id);
        const fullName = `${(data as any).first_name ?? ""} ${(data as any).last_name ?? ""}`.trim() || "Prospect";
        const fmt = (s: string) => s.replace(/_/g, " ");
        void emitActivityEvent({
          advisorId,
          kind: "pipeline_changed",
          title: `${fullName} moved to ${fmt(updates.pipeline_stage)}`,
          body: `From ${fmt(previousStage)}`,
          prospect_id: id,
          related_record_id: id,
          related_record_type: "prospect",
        });
      }

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

      if (household && advisorId) {
        embedRecord("households", household, advisorId);
      }

      // 1b. Create household member from prospect data
      const { error: memberErr } = await supabase
        .from("household_members")
        .insert({
          household_id: household.id,
          advisor_id: advisorId,
          first_name: prospect.first_name,
          last_name: prospect.last_name,
          relationship: "Primary",
          email: prospect.email || null,
          phone: prospect.phone || null,
        });
      if (memberErr) throw memberErr;

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

      // 3. Magic Moment thank-you task — only when referred by an existing household
      if (prospect.referred_by_household_id) {
        const referrerName = prospect.referred_by || "your client";
        const convertedName = `${prospect.first_name} ${prospect.last_name}`;

        await supabase.from("tasks").insert({
          advisor_id: advisorId,
          assigned_to: advisorId,
          created_by: advisorId,
          title: `Send thank-you to ${referrerName} — referral converted! 🎉`,
          description: `${convertedName} has just become a client. ${referrerName} referred them — reach out to acknowledge this referral and strengthen the relationship.`,
          priority: "high",
          status: "todo",
          task_type: "magic_moment",
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          household_id: prospect.referred_by_household_id,
          metadata: {
            magic_moment_type: "referral_converted",
            converted_prospect_id: prospect.id,
            converted_household_id: household.id,
            converted_name: convertedName,
            referrer_household_id: prospect.referred_by_household_id,
            referrer_name: referrerName,
          },
        });

        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }

      // Step 4 — Initial tier assessment
      try {
        const { data: allHouseholds } = await supabase
          .from("households")
          .select("total_aum")
          .eq("advisor_id", advisorId)
          .is("archived_at", null);

        const bookAverage = allHouseholds?.length
          ? allHouseholds.reduce(
              (s, h) => s + Number(h.total_aum || 0), 0
            ) / allHouseholds.length
          : 0;

        const { count: referralCount } = await supabase
          .from("prospects")
          .select("id", { count: "exact" })
          .eq("referred_by_household_id", household.id);

        const { data: newHousehold } = await supabase
          .from("households")
          .select(`
            *,
            household_members(
              date_of_birth,
              relationship
            )
          `)
          .eq("id", household.id)
          .single();

        if (!newHousehold) throw new Error();

        const primary = (newHousehold as any).household_members?.find(
          (m: any) => m.relationship === "Primary"
        );

        const age = primary?.date_of_birth
          ? Math.floor(
              (Date.now() - new Date(primary.date_of_birth).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000)
            )
          : null;

        let referredByTier: string | null = null;
        if (prospect.referred_by_household_id) {
          const { data: referrer } = await supabase
            .from("households")
            .select("wealth_tier")
            .eq("id", prospect.referred_by_household_id)
            .single();
          referredByTier = referrer?.wealth_tier || null;
        }

        const scoreResult = calculateTierScore({
          householdAum: Number(newHousehold.total_aum || 0),
          bookAverageAum: bookAverage,
          annualIncome: (newHousehold as any).annual_income || null,
          primaryMemberAge: age,
          referralsSent: referralCount || 0,
          referredByTier,
        });

        const suggestedTier = scoreResult.recommendedTier;
        const reason =
          `Initial tier assessment: ` +
          `score ${scoreResult.total}/100 ` +
          `recommends ${suggestedTier}. ` +
          `${scoreResult.flags[0] || ""}`;

        await supabase
          .from("households")
          .update({
            tier_score: scoreResult.total,
            tier_pending_review: suggestedTier,
            tier_pending_score: scoreResult.total,
            tier_pending_reason: reason.trim(),
            tier_last_assessed: new Date().toISOString(),
          })
          .eq("id", household.id);

        await supabase.from("tasks").insert({
          advisor_id: advisorId,
          assigned_to: advisorId,
          created_by: advisorId,
          title:
            `Assign tier — ` +
            `${prospect.first_name} ` +
            `${prospect.last_name} ` +
            `(${suggestedTier.charAt(0).toUpperCase() + suggestedTier.slice(1)} ` +
            `recommended)`,
          description: reason.trim(),
          priority: "medium",
          status: "todo",
          task_type: "tier_review",
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          household_id: household.id,
          metadata: {
            current_tier: null,
            suggested_tier: suggestedTier,
            score: scoreResult.total,
            trigger: "prospect_converted",
            score_breakdown: {
              aum: scoreResult.aumScore,
              income: scoreResult.incomeScore,
              age: scoreResult.ageScore,
              referral: scoreResult.referralScore,
            },
          },
        });

        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["households"] });
      } catch (err) {
        console.error("Tier check failed:", err);
      }

      return { householdId: household.id };
    },
    onSuccess: (_, prospect) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["households"] });
      queryClient.invalidateQueries({ queryKey: ["prospect", prospect.id] });
    },
  });
}
