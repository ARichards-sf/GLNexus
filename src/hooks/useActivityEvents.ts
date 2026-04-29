import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export type ActivityEventKind =
  | "draft_generated"
  | "draft_sent"
  | "draft_dismissed"
  | "aum_drop_detected"
  | "tier_changed"
  | "pipeline_changed"
  | "meeting_completed"
  | "task_due_soon"
  | "cooldown_ending"
  | "system";

export interface ActivityEvent {
  id: string;
  advisor_id: string;
  kind: ActivityEventKind;
  title: string;
  body: string | null;
  household_id: string | null;
  prospect_id: string | null;
  related_record_id: string | null;
  related_record_type: string | null;
  read_at: string | null;
  created_at: string;
}

function useAdvisorId() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  return { userId: user?.id, advisorId: user ? targetAdvisorId(user.id) : undefined };
}

const RECENT_LIMIT = 25;

export function useActivityEvents() {
  const { userId, advisorId } = useAdvisorId();
  return useQuery({
    queryKey: ["activity_events", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_events" as any)
        .select("*")
        .eq("advisor_id", advisorId!)
        .order("created_at", { ascending: false })
        .limit(RECENT_LIMIT);
      if (error) throw error;
      return (data ?? []) as unknown as ActivityEvent[];
    },
    enabled: !!userId && !!advisorId,
  });
}

/**
 * Lightweight client-side emitter for activity events. Used from places we
 * already have a mutation in flight (sending a draft, completing a meeting,
 * moving a prospect through the pipeline). Errors are swallowed — the event
 * stream is informational, never block the underlying action on it.
 */
export async function emitActivityEvent(input: {
  advisorId: string;
  kind: ActivityEventKind;
  title: string;
  body?: string | null;
  household_id?: string | null;
  prospect_id?: string | null;
  related_record_id?: string | null;
  related_record_type?: string | null;
}): Promise<void> {
  try {
    await supabase.from("activity_events" as any).insert({
      advisor_id: input.advisorId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      household_id: input.household_id ?? null,
      prospect_id: input.prospect_id ?? null,
      related_record_id: input.related_record_id ?? null,
      related_record_type: input.related_record_type ?? null,
    } as any);
  } catch (e) {
    console.warn("emitActivityEvent failed:", e);
  }
}

export function useMarkActivityRead() {
  const queryClient = useQueryClient();
  const { advisorId } = useAdvisorId();
  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      if (eventIds.length === 0 || !advisorId) return;
      const { error } = await supabase
        .from("activity_events" as any)
        .update({ read_at: new Date().toISOString() } as any)
        .in("id", eventIds)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_events"] });
    },
  });
}
