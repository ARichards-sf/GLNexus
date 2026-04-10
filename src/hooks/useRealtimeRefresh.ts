import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on key tables so the UI
 * refreshes automatically after AI agent actions.
 */
export function useRealtimeRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("ai-agent-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "households" }, () => {
        queryClient.invalidateQueries({ queryKey: ["households"] });
        queryClient.invalidateQueries({ queryKey: ["household"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "compliance_notes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["compliance_notes"] });
        queryClient.invalidateQueries({ queryKey: ["all_compliance_notes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => {
        queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
        queryClient.invalidateQueries({ queryKey: ["upcoming_events"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_accounts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["household_accounts"] });
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
