import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Clock, Send, Paperclip, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useRequestMessages } from "@/hooks/useRequestMessages";
import { toast } from "sonner";
import type { ServiceRequest } from "@/hooks/useServiceRequests";

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const STATUSES = ["open", "in-progress", "resolved"] as const;

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAdminRoute = location.pathname.startsWith("/admin");

  const { data: request, isLoading } = useQuery({
    queryKey: ["service_request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;

      // Fetch advisor profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", data.advisor_id)
        .single();

      return {
        ...data,
        file_paths: data.file_paths ?? [],
        advisor_name: profile?.full_name || "Unknown",
        advisor_email: profile?.email || undefined,
      } as ServiceRequest;
    },
    enabled: !!id,
  });

  const { messages, isLoading: messagesLoading, sendMessage } = useRequestMessages(id!);

  // Auto-scroll on new messages
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

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("service_requests").update({ status }).eq("id", id!);
    if (error) {
      toast.error("Failed to update status.");
    } else {
      toast.success(`Request marked as ${status}.`);
      queryClient.invalidateQueries({ queryKey: ["service_request", id] });
      queryClient.invalidateQueries({ queryKey: ["service_requests"] });
    }
  };

  const backPath = isAdminRoute ? "/admin/requests" : "/my-requests";

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-48" />
          <div className="h-40 bg-secondary rounded" />
          <div className="h-64 bg-secondary rounded" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <p className="mt-6 text-muted-foreground">Request not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      {/* Header */}
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(backPath)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to {isAdminRoute ? "All Requests" : "My Requests"}
      </Button>

      {/* Request Info */}
      <Card className="border-border shadow-none mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                  {request.category}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-xs px-2 py-0.5 font-medium ${statusStyles[request.status] || ""}`}
                >
                  {request.status}
                </Badge>
              </div>
              <CardTitle className="text-lg">{request.category} Request</CardTitle>
            </div>
            {isAdmin && (
              <Select value={request.status} onValueChange={updateStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground">{request.description}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {request.household_name && (
              <span>
                <strong className="text-foreground">Household:</strong> {request.household_name}
              </span>
            )}
            {request.household_aum != null && (
              <span>
                <strong className="text-foreground">AUM:</strong> ${Number(request.household_aum).toLocaleString()}
              </span>
            )}
            {request.account_type && (
              <span>
                <strong className="text-foreground">Account:</strong> {request.account_type}
                {request.account_institution ? ` @ ${request.account_institution}` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Clock className="w-3 h-3" />
            {new Date(request.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {request.file_paths && request.file_paths.length > 0 && (
              <span className="ml-3">
                <Paperclip className="w-3 h-3 inline mr-1" />
                {request.file_paths.length} file{request.file_paths.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="h-[360px] overflow-y-auto px-4 py-3 space-y-3"
          >
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
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
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

          {/* Input */}
          <div className="border-t p-3 flex items-center gap-2">
            <Input
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!messageText.trim() || sendMessage.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
