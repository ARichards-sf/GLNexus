import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";

/**
 * Returns the total count of requests with unread messages for the current user.
 * Used for sidebar badge indicators.
 */
export function useUnreadRequestCounts() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["unread_request_counts", user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return { myRequests: 0, allRequests: 0 };

      // Get all relevant request IDs
      let requestIds: string[] = [];

      if (isAdmin) {
        // Admins need counts for both their own requests and all requests
        const { data: allRequests } = await supabase
          .from("service_requests")
          .select("id, advisor_id");
        requestIds = allRequests?.map(r => r.id) ?? [];
      } else {
        // Regular advisors only need their own requests
        const { data: myRequests } = await supabase
          .from("service_requests")
          .select("id")
          .eq("advisor_id", user.id);
        requestIds = myRequests?.map(r => r.id) ?? [];
      }

      if (requestIds.length === 0) return { myRequests: 0, allRequests: 0 };

      // Get user's read status for these requests
      const { data: readStatuses } = await supabase
        .from("service_request_read_status")
        .select("request_id, last_read_at")
        .eq("user_id", user.id)
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

      // Count unread per category
      let myUnreadCount = 0;
      let allUnreadCount = 0;

      // Need to know which requests are mine vs others (for admins)
      const myRequestIds = new Set<string>();
      if (isAdmin) {
        const { data: myRequests } = await supabase
          .from("service_requests")
          .select("id")
          .eq("advisor_id", user.id);
        myRequests?.forEach(r => myRequestIds.add(r.id));
      } else {
        // For non-admins, all visible requests are "mine"
        requestIds.forEach(id => myRequestIds.add(id));
      }

      for (const reqId of requestIds) {
        const lastMsg = latestMsg.get(reqId);
        if (!lastMsg) continue; // no messages = not unread

        const lastRead = readMap.get(reqId);
        // Unread if no last_read or last message is newer than last read
        if (!lastRead || new Date(lastMsg) > new Date(lastRead)) {
          allUnreadCount++;
          if (myRequestIds.has(reqId)) {
            myUnreadCount++;
          }
        }
      }

      return {
        myRequests: isAdmin ? myUnreadCount : allUnreadCount, // For non-admins, all are "mine"
        allRequests: isAdmin ? allUnreadCount : 0, // Only admins see "all"
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds to keep badge updated
  });
}
