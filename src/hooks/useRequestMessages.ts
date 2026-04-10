import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RequestMessage {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

export function useRequestMessages(requestId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["request_messages", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_messages")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch sender names
      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", senderIds);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) ?? []);

      return data.map((m) => ({
        ...m,
        sender_name: nameMap.get(m.sender_id) || "Unknown",
      })) as RequestMessage[];
    },
    enabled: !!requestId,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`request-messages-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "service_request_messages",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["request_messages", requestId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("service_request_messages").insert({
        request_id: requestId,
        sender_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request_messages", requestId] });
    },
  });

  return { messages: query.data ?? [], isLoading: query.isLoading, sendMessage };
}
