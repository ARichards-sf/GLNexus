import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Paperclip, Send, User, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRequestMessages } from "@/hooks/useRequestMessages";
import { markRequestAsRead } from "@/hooks/useUnreadRequests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  REQUEST_TYPE_LABELS,
  STATUS_STYLES,
  TIMELINE_LABELS,
  TIMELINE_STYLES,
  type VpmRequestRow,
} from "@/components/vpm/vpmRequestMeta";

interface VpmRequestDetail extends VpmRequestRow {
  file_paths: string[];
  advisor_email?: string | null;
}

export default function VpmTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: request, isLoading } = useQuery({
    queryKey: ["vpm_request", id],
    queryFn: async (): Promise<VpmRequestDetail> => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", id!)
        .eq("is_vpm", true)
        .single();
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, vpm_billing_type")
        .eq("user_id", data.advisor_id)
        .maybeSingle();

      return {
        ...data,
        file_paths: data.file_paths ?? [],
        advisor_name: profile?.full_name ?? null,
        advisor_email: profile?.email ?? null,
        advisor_billing_type: profile?.vpm_billing_type ?? null,
      };
    },
    enabled: !!id,
  });

  const { messages, isLoading: messagesLoading, sendMessage } = useRequestMessages(id || "");

  useEffect(() => {
    if (id && user) {
      markRequestAsRead(id, user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread_requests"] });
        queryClient.invalidateQueries({ queryKey: ["unread_request_counts"] });
      });
    }
  }, [id, user, queryClient]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = messageText.trim();
    if (!text) return;
    setMessageText("");
    sendMessage.mutate(text, {
      onError: () => toast.error("Failed to send message."),
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-40 rounded bg-secondary" />
          <div className="h-72 rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/vpm-requests")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to VPM Requests
        </Button>
        <p className="mt-6 text-muted-foreground">Request not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/vpm-requests")}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to VPM Requests
      </Button>

      <Card className="border-border shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">{request.description?.split("\n")[0] || "VPM Support Request"}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Created {new Date(request.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={TIMELINE_STYLES[request.vpm_timeline || ""] || "bg-secondary text-muted-foreground"}>
                  {TIMELINE_LABELS[request.vpm_timeline || ""] || "No timeline"}
                </Badge>
                <Badge variant="outline">
                  {REQUEST_TYPE_LABELS[request.vpm_request_type || ""] || request.category}
                </Badge>
                <Badge className={STATUS_STYLES[request.status] || ""}>{request.status}</Badge>
              </div>
            </div>
            {request.advisor_billing_type === "prime_partner" && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold h-fit">
                ⭐ Prime
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground whitespace-pre-wrap">{request.description}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {request.advisor_name || "Unknown"}
              {request.advisor_email ? ` (${request.advisor_email})` : ""}
            </span>
            {request.household_name && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {request.household_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {Number(request.vpm_hours_logged ?? 0)}h logged
            </span>
            {request.household_aum != null && (
              <span>Household AUM: ${Number(request.household_aum).toLocaleString()}</span>
            )}
          </div>

          {request.vpm_hours_notes && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs font-medium text-foreground mb-1">Hours Notes</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{request.vpm_hours_notes}</p>
            </div>
          )}

          {request.file_paths.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Paperclip className="w-3.5 h-3.5" />
              {request.file_paths.length} file{request.file_paths.length > 1 ? "s" : ""} attached
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={scrollRef} className="h-[360px] overflow-y-auto px-4 py-3 space-y-3">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      {!isMe && (
                        <p className="text-[10px] font-medium mb-0.5 opacity-70 flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {msg.sender_name}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t p-3 flex items-center gap-2">
            <Input
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={!messageText.trim() || sendMessage.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
