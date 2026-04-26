import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, Send, Paperclip, User, Building2, Wallet, DollarSign, UserRound, Briefcase, Calendar } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useRequestMessages } from "@/hooks/useRequestMessages";
import { markRequestAsRead } from "@/hooks/useUnreadRequests";
import { toast } from "sonner";
import type { ServiceRequest } from "@/hooks/useServiceRequests";
import { MEMBER_SAFE_COLUMNS } from "@/lib/memberColumns";

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const STATUSES = ["open", "in-progress", "resolved"] as const;

// Categories that should show the financial context sidebar
const CONTEXT_CATEGORIES = ["NIGO Resolution", "Account Opening Assist"];

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

  const showContextSidebar = request && CONTEXT_CATEGORIES.includes(request.category);

  // Fetch household details when relevant
  const { data: household } = useQuery({
    queryKey: ["request_household", request?.household_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .eq("id", request!.household_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!showContextSidebar && !!request?.household_id,
  });

  // Fetch household members
  const { data: members = [] } = useQuery({
    queryKey: ["request_household_members", request?.household_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select(MEMBER_SAFE_COLUMNS)
        .eq("household_id", request!.household_id!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!showContextSidebar && !!request?.household_id,
  });

  // Fetch accounts for household members
  const { data: accounts = [] } = useQuery({
    queryKey: ["request_household_accounts", members.map((m) => m.id)],
    queryFn: async () => {
      const memberIds = members.map((m) => m.id);
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("contact_accounts")
        .select("*")
        .in("member_id", memberIds);
      if (error) throw error;
      return data;
    },
    enabled: !!showContextSidebar && members.length > 0,
  });

  const { messages, isLoading: messagesLoading, sendMessage } = useRequestMessages(id!);

  // Mark as read immediately when opening the request
  useEffect(() => {
    if (id && user) {
      markRequestAsRead(id, user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread_requests"] });
        queryClient.invalidateQueries({ queryKey: ["unread_request_counts"] });
      });
    }
  }, [id, user, queryClient]);

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
      <div className="p-6 lg:p-10 max-w-6xl">
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
      <div className="p-6 lg:p-10 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <p className="mt-6 text-muted-foreground">Request not found.</p>
      </div>
    );
  }

  const totalAccountBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      {/* Header */}
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(backPath)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to {isAdminRoute ? "All Requests" : "My Requests"}
      </Button>

      <div className={`flex gap-6 ${showContextSidebar ? "" : "max-w-4xl"}`}>
        {/* Main Content */}
        <div className="flex-1 min-w-0">
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
                {/* Only admins on admin route can change status */}
                {isAdmin && isAdminRoute && (
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
              {isAdminRoute && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{request.advisor_name}</span>
                  {request.advisor_email && <span className="text-muted-foreground">({request.advisor_email})</span>}
                </div>
              )}
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

        {/* Context Sidebar — NIGO / Account Opening only */}
        {showContextSidebar && (
          <div className="hidden lg:block w-80 shrink-0 space-y-4">
            {/* Household Info */}
            {household && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Household
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{household.name}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1">{household.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Total AUM</p>
                      <p className="font-semibold text-foreground">${Number(household.total_aum).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk Tolerance</p>
                      <p className="font-medium text-foreground">{household.risk_tolerance}</p>
                    </div>
                    {household.wealth_tier && (
                      <div>
                        <p className="text-muted-foreground">Wealth Tier</p>
                        <p className="font-medium text-foreground">{household.wealth_tier}</p>
                      </div>
                    )}
                    {household.investment_objective && (
                      <div>
                        <p className="text-muted-foreground">Objective</p>
                        <p className="font-medium text-foreground">{household.investment_objective}</p>
                      </div>
                    )}
                  </div>
                  {household.last_review_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
                      <Calendar className="w-3 h-3" />
                      Last review: {new Date(household.last_review_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                  {household.annual_review_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      Next review: {new Date(household.annual_review_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Members */}
            {members.length > 0 && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-muted-foreground" />
                    Members ({members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.map((m) => (
                    <div key={m.id} className="text-xs">
                      <p className="font-semibold text-foreground">{m.first_name} {m.last_name}</p>
                      <p className="text-muted-foreground capitalize">{m.relationship}</p>
                      {m.email && <p className="text-muted-foreground truncate">{m.email}</p>}
                      {m.phone && <p className="text-muted-foreground">{m.phone}</p>}
                      {m.date_of_birth && (
                        <p className="text-muted-foreground">DOB: {new Date(m.date_of_birth).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Accounts */}
            {accounts.length > 0 && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                      Accounts ({accounts.length})
                    </CardTitle>
                    <span className="text-xs font-semibold text-foreground">
                      ${totalAccountBalance.toLocaleString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accounts.map((a) => (
                    <div key={a.id} className="text-xs border-b border-border pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-semibold text-foreground truncate">{a.account_name}</p>
                        <p className="font-semibold text-foreground shrink-0">${Number(a.balance).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">{a.account_type}</Badge>
                        {a.institution && <span>{a.institution}</span>}
                      </div>
                      {a.account_number && (
                        <p className="text-muted-foreground mt-0.5">Acct: •••{a.account_number.slice(-4)}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* No context data */}
            {!household && members.length === 0 && accounts.length === 0 && (
              <Card className="border-border shadow-none">
                <CardContent className="py-8 text-center">
                  <Briefcase className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No linked household or account data for this request.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
