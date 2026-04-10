import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export interface CalendarEvent {
  id: string;
  advisor_id: string;
  household_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  households?: { name: string } | null;
}

function useTargetAdvisorId() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const id = user ? targetAdvisorId(user.id) : undefined;
  return { userId: user?.id, advisorId: id };
}

export function useCalendarEvents(month?: Date) {
  const { userId, advisorId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["calendar_events", advisorId, month?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("calendar_events")
        .select("*, households(name)")
        .eq("advisor_id", advisorId!)
        .order("start_time", { ascending: true });

      if (month) {
        const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
        const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59).toISOString();
        query = query.gte("start_time", start).lte("start_time", end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!userId && !!advisorId,
  });
}

export function useUpcomingEvents(limit = 5) {
  const { userId, advisorId } = useTargetAdvisorId();
  return useQuery({
    queryKey: ["upcoming_events", advisorId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*, households(name)")
        .eq("advisor_id", advisorId!)
        .eq("status", "scheduled")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!userId && !!advisorId,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();

  return useMutation({
    mutationFn: async (event: {
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      event_type: string;
      household_id?: string;
    }) => {
      const advisorId = user ? targetAdvisorId(user.id) : user!.id;

      const { data, error } = await supabase
        .from("calendar_events")
        .insert({ ...event, advisor_id: advisorId })
        .select()
        .single();
      if (error) throw error;

      // If Annual Review, update household status
      if (event.event_type === "Annual Review" && event.household_id) {
        await supabase
          .from("households")
          .update({ status: "Review Scheduled" })
          .eq("id", event.household_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming_events"] });
      queryClient.invalidateQueries({ queryKey: ["households"] });
    },
  });
}

export function useCompleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, householdId }: { eventId: string; householdId: string | null }) => {
      const { error } = await supabase
        .from("calendar_events")
        .update({ status: "completed" })
        .eq("id", eventId);
      if (error) throw error;

      // Update household last_review_date
      if (householdId) {
        await supabase
          .from("households")
          .update({
            last_review_date: new Date().toISOString().split("T")[0],
            status: "Active",
          })
          .eq("id", householdId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming_events"] });
      queryClient.invalidateQueries({ queryKey: ["households"] });
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming_events"] });
    },
  });
}

export const EVENT_TYPES = [
  "Annual Review",
  "Discovery Call",
  "Portfolio Update",
  "Prospecting",
] as const;

export const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Annual Review": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
  "Discovery Call": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  "Portfolio Update": { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "Prospecting": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
};
