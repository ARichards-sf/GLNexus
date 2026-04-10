import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns a Set of request IDs that have unread messages for the current user.
 */
export function useUnreadRequests(requestIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread_requests", user?.id, requestIds],
    queryFn: async () => {
      if (!requestIds.length) return new Set<string>();

      // Get user's read status for these requests
      const { data: readStatuses } = await supabase
        .from("service_request_read_status")
        .select("request_id, last_read_at")
        .eq("user_id", user!.id)
        .in("request_id", requestIds);

      const readMap = new Map(
        readStatuses?.map((rs) => [rs.request_id, rs.last_read_at]) ?? []
      );

      // Get latest message timestamp per request
      const { data: messages } = await supabase
        .from("service_request_messages")
        .select("request_id, created_at")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });

      // Group by request_id, get latest
      const latestMsg = new Map<string, string>();
      for (const msg of messages ?? []) {
        if (!latestMsg.has(msg.request_id)) {
          latestMsg.set(msg.request_id, msg.created_at);
        }
      }

      const unread = new Set<string>();
      for (const reqId of requestIds) {
        const lastMsg = latestMsg.get(reqId);
        if (!lastMsg) continue; // no messages = not unread
        const lastRead = readMap.get(reqId);
        // Also exclude messages sent by the current user
        if (!lastRead || new Date(lastMsg) > new Date(lastRead)) {
          // Check if latest message is from someone else
          const latestFromOther = messages?.find(
            (m) => m.request_id === reqId && m.created_at === lastMsg
          );
          if (latestFromOther) {
            unread.add(reqId);
          }
        }
      }

      return unread;
    },
    enabled: !!user && requestIds.length > 0,
  });
}

/**
 * Mark a request as read for the current user.
 */
export async function markRequestAsRead(requestId: string, userId: string) {
  await supabase
    .from("service_request_read_status")
    .upsert(
      { request_id: requestId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "request_id,user_id" }
    );
}
