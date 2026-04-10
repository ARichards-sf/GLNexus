import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";

/**
 * Returns the total count of requests with unread messages for the current user,
 * plus a count of brand-new requests the admin hasn't opened yet.
 */
export function useUnreadRequestCounts() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["unread_request_counts", user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return { myRequests: 0, allRequests: 0, newRequests: 0 };

      // Get all relevant requests
      let allRequestData: { id: string; advisor_id: string; created_at: string }[] = [];

      if (isAdmin) {
        const { data } = await supabase
          .from("service_requests")
          .select("id, advisor_id, created_at");
        allRequestData = data ?? [];
      } else {
        const { data } = await supabase
          .from("service_requests")
          .select("id, advisor_id, created_at")
          .eq("advisor_id", user.id);
        allRequestData = data ?? [];
      }

      const requestIds = allRequestData.map(r => r.id);
      if (requestIds.length === 0) return { myRequests: 0, allRequests: 0, newRequests: 0 };

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

      const latestMsg = new Map<string, string>();
      for (const msg of messages ?? []) {
        if (!latestMsg.has(msg.request_id)) {
          latestMsg.set(msg.request_id, msg.created_at);
        }
      }

      // Count unread messages per category
      let myUnreadCount = 0;
      let allUnreadCount = 0;

      const myRequestIds = new Set<string>();
      if (isAdmin) {
        const { data: myReqs } = await supabase
          .from("service_requests")
          .select("id")
          .eq("advisor_id", user.id);
        myReqs?.forEach(r => myRequestIds.add(r.id));
      } else {
        requestIds.forEach(id => myRequestIds.add(id));
      }

      for (const reqId of requestIds) {
        const lastMsg = latestMsg.get(reqId);
        if (!lastMsg) continue;

        const lastRead = readMap.get(reqId);
        if (!lastRead || new Date(lastMsg) > new Date(lastRead)) {
          allUnreadCount++;
          if (myRequestIds.has(reqId)) {
            myUnreadCount++;
          }
        }
      }

      // Count NEW requests (never opened by this admin)
      let newRequests = 0;
      if (isAdmin) {
        for (const req of allRequestData) {
          // A request is "new" if the admin has never opened it (no read status entry)
          if (!readMap.has(req.id)) {
            newRequests++;
          }
        }
      }

      return {
        myRequests: isAdmin ? myUnreadCount : allUnreadCount,
        allRequests: isAdmin ? allUnreadCount : 0,
        newRequests,
      };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}
