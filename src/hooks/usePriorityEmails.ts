import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PriorityEmail = {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  body_preview: string | null;
  received_at: string | null;
  web_link: string | null;
  is_read: boolean;
  contact_id: string | null;
  household_id: string | null;
  ai_priority: "urgent" | "high" | "normal" | "low" | null;
  ai_sentiment: "positive" | "neutral" | "negative" | "frustrated" | null;
  ai_summary: string | null;
  ai_intent: string | null;
  ai_suggested_action: string | null;
  households?: {
    name: string;
    wealth_tier: string | null;
  } | null;
};

const TIER_RANK: Record<string, number> = {
  platinum: 0,
  gold: 1,
  silver: 2,
};

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
};

/**
 * Top urgent + high priority emails from known contacts. Sorted urgent
 * first, then by tier (platinum → silver), then by recency. Limit 15 — the
 * sidebar surface is small and stale priority items should age out anyway.
 */
export function usePriorityEmails() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["priority-emails", user?.id],
    queryFn: async (): Promise<PriorityEmail[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("email_messages")
        .select(`
          id, subject, from_email, from_name, body_preview, received_at,
          web_link, is_read, contact_id, household_id,
          ai_priority, ai_sentiment, ai_summary, ai_intent, ai_suggested_action,
          households(name, wealth_tier)
        `)
        .eq("advisor_id", user.id)
        .eq("folder", "inbox")
        .in("ai_priority", ["urgent", "high"])
        .not("contact_id", "is", null)
        .order("received_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const rows = (data ?? []) as unknown as PriorityEmail[];
      rows.sort((a, b) => {
        const pa = PRIORITY_RANK[a.ai_priority ?? ""] ?? 9;
        const pb = PRIORITY_RANK[b.ai_priority ?? ""] ?? 9;
        if (pa !== pb) return pa - pb;
        const ta = TIER_RANK[a.households?.wealth_tier ?? ""] ?? 9;
        const tb = TIER_RANK[b.households?.wealth_tier ?? ""] ?? 9;
        if (ta !== tb) return ta - tb;
        const da = a.received_at ? new Date(a.received_at).getTime() : 0;
        const db = b.received_at ? new Date(b.received_at).getTime() : 0;
        return db - da;
      });
      return rows.slice(0, 15);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
