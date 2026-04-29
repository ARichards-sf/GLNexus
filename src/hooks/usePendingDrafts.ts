import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export type PendingDraftReason =
  | "annual_review_due"
  | "aum_drop"
  | "overdue_touchpoint"
  | "stalled_prospect";

export interface PendingDraft {
  id: string;
  advisor_id: string;
  household_id: string | null;
  prospect_id: string | null;
  trigger_reason: PendingDraftReason;
  trigger_context: string | null;
  kind: "email" | "text";
  subject: string | null;
  body: string;
  recipient_contact_id: string | null;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: "pending" | "sent" | "dismissed";
  source_key: string;
  /**
   * Deep-link path for the booking button (e.g.
   * `/book/joe-tester/annual-review`). Set by the edge function based on
   * the trigger reason; null = no booking link / generic /book/:slug.
   */
  booking_url_path: string | null;
  created_at: string;
  sent_at: string | null;
  dismissed_at: string | null;
}

function useAdvisorId() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  return { userId: user?.id, advisorId: user ? targetAdvisorId(user.id) : undefined };
}

export function usePendingDrafts() {
  const { userId, advisorId } = useAdvisorId();
  return useQuery({
    queryKey: ["pending_drafts", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_drafts" as any)
        .select("*")
        .eq("advisor_id", advisorId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingDraft[];
    },
    enabled: !!userId && !!advisorId,
  });
}

/**
 * Triggers the edge function that scans an advisor's trigger conditions and
 * fills the pending_drafts table. Idempotent — already-pending drafts are
 * skipped on the server side via source_key dedupe.
 */
export function useGeneratePendingDrafts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-pending-drafts", {
        body: {},
      });
      if (error) {
        // Surface the function's response body — supabase-js wraps it in
        // a generic "non-2xx status code" message that hides the real
        // failure. Read the FunctionsHttpError context if present.
        let detail = "";
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            detail = body?.error || JSON.stringify(body);
          } else if (ctx && typeof ctx.text === "function") {
            detail = await ctx.text();
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(detail ? `${error.message}: ${detail}` : error.message);
      }
      return data as {
        generated: number;
        skipped: number;
        skipped_pending: number;
        skipped_cooldown: number;
        triggers: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_drafts"] });
    },
  });
}

export function useDismissPendingDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("pending_drafts" as any)
        .update({ status: "dismissed", dismissed_at: new Date().toISOString() } as any)
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_drafts"] });
    },
  });
}

/**
 * Marks a draft as sent. The compliance-note write is the caller's job
 * (lives in MessageDraftPanel via useCreateComplianceNote) so the existing
 * note-logging path stays the system of record.
 */
export function useMarkDraftSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("pending_drafts" as any)
        .update({ status: "sent", sent_at: new Date().toISOString() } as any)
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_drafts"] });
    },
  });
}
