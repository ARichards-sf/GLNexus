import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Send,
  User,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useRequestMessages } from "@/hooks/useRequestMessages";
import { markRequestAsRead } from "@/hooks/useUnreadRequests";
import { formatCurrency } from "@/data/sampleData";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TierBadge from "@/components/TierBadge";
import { Textarea } from "@/components/ui/textarea";
import {
  REQUEST_TYPE_LABELS,
  STATUS_STYLES,
  TIMELINE_LABELS,
  TIMELINE_STYLES,
  type VpmRequestRow,
} from "@/components/vpm/vpmRequestMeta";

interface VpmTicketDetailRecord extends VpmRequestRow {
  advisor_name: string;
  advisor_email?: string | null;
  advisor_hourly_rate?: number | null;
  is_prime_partner?: boolean;
  firm_name?: string | null;
}

export default function VpmTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { startVpmSession, stopVpmSession, isVpmSession, vpmAdvisor } = useImpersonation();

  const { data: request, isLoading } = useQuery({
    queryKey: ["vpm_ticket", id],
    queryFn: async (): Promise<VpmTicketDetailRecord> => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", id!)
        .single();

      if (error || !data) throw error ?? new Error("Ticket not found");

      const { data: profile } = await supabase
        .from("profiles")
        .select(`
          full_name,
          email,
          vpm_billing_type,
          vpm_hourly_rate,
          is_prime_partner,
          firm_id,
          firms(name)
        `)
        .eq("user_id", data.advisor_id)
        .single();

      return {
        ...data,
        advisor_name: profile?.full_name || "Unknown",
        advisor_email: profile?.email,
        advisor_billing_type: (profile as any)?.vpm_billing_type,
        advisor_hourly_rate: (profile as any)?.vpm_hourly_rate,
        is_prime_partner: (profile as any)?.is_prime_partner,
        firm_name: (profile as any)?.firms?.name,
      };
    },
    enabled: !!id,
  });

  const { data: household } = useQuery({
    queryKey: ["vpm_ticket_household", request?.household_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("households")
        .select(`
          id, name, total_aum,
          risk_tolerance, wealth_tier,
          investment_objective, status,
          annual_review_date,
          last_review_date,
          tier_score, tier_pending_review
        `)
        .eq("id", request!.household_id!)
        .single();
      return data;
    },
    enabled: !!request?.household_id,
  });

  const { messages, sendMessage, isLoading: messagesLoading } = useRequestMessages(id!);
  const isSending = sendMessage.isPending;
  const [messageText, setMessageText] = useState("");
  const [status, setStatus] = useState(request?.status || "open");
  const [hoursInput, setHoursInput] = useState("");
  const [hoursNote, setHoursNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  void internalNote;
  void setInternalNote;

  useEffect(() => {
    if (request?.status) setStatus(request.status);
  }, [request?.status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (id && user) {
      markRequestAsRead(id, user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread_requests"] });
        queryClient.invalidateQueries({ queryKey: ["unread_request_counts"] });
      });
    }
  }, [id, user, queryClient]);

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from("service_requests")
      .update({ status: newStatus })
      .eq("id", id!);

    if (error) {
      toast.error(error.message || "Failed to update status");
      return;
    }

    setStatus(newStatus);
    queryClient.invalidateQueries({ queryKey: ["vpm_requests"] });
    queryClient.invalidateQueries({ queryKey: ["vpm_ticket", id] });
    toast.success(`Status updated to ${newStatus}`);
  };

  const handleLogHours = async () => {
    const hrs = parseFloat(hoursInput);
    if (isNaN(hrs) || hrs <= 0) return;

    const current = request?.vpm_hours_logged || 0;
    const { error } = await supabase
      .from("service_requests")
      .update({
        vpm_hours_logged: current + hrs,
        vpm_hours_notes: hoursNote || null,
      })
      .eq("id", id!);

    if (error) {
      toast.error(error.message || "Failed to log hours");
      return;
    }

    setHoursInput("");
    setHoursNote("");
    queryClient.invalidateQueries({ queryKey: ["vpm_ticket", id] });
    queryClient.invalidateQueries({ queryKey: ["vpm_requests"] });
    toast.success(`${hrs}h logged`);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      await sendMessage.mutateAsync(messageText);
      setMessageText("");
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleEnterSession = () => {
    if (!request) return;

    (window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id = id;
    window.localStorage.setItem("vpm_ticket_id", id!);
    startVpmSession({
      id: request.advisor_id,
      name: request.advisor_name || "Advisor",
      firmName: request.firm_name || null,
      isPrime: !!request.is_prime_partner,
    });
    navigate(request.household_id ? `/household/${request.household_id}` : "/households");
  };

  const handleExitSession = () => {
    stopVpmSession();
    delete (window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id;
    window.localStorage.removeItem("vpm_ticket_id");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-64 rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/vpm-requests")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to VPM Requests
        </Button>
      </div>
    );
  }

  const isActiveSession = isVpmSession && vpmAdvisor?.id === request.advisor_id;

  return (
    <div className="flex gap-6 items-start px-6 pb-6 pt-8">
      <div className="flex-1 min-w-0 space-y-4">
        <button
          onClick={() => navigate("/admin/vpm-requests")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          VPM Requests
        </button>

        <Card className="border-border shadow-none">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn("capitalize", STATUS_STYLES[status] || "")}>{status}</Badge>
                  {request?.vpm_request_type && (
                    <Badge variant="outline">
                      {REQUEST_TYPE_LABELS[request.vpm_request_type] || request.vpm_request_type}
                    </Badge>
                  )}
                  {request?.is_prime_partner && (
                    <Badge className="bg-amber-100 text-amber-700">⭐ Prime Partner</Badge>
                  )}
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {REQUEST_TYPE_LABELS[request?.vpm_request_type || ""] || "VPM Support Request"}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {request?.advisor_name}
                    {request?.firm_name && ` · ${request.firm_name}`}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isActiveSession && (
          <Card className="border-border shadow-none bg-secondary/30">
            <CardContent className="pt-4 flex items-start gap-3 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
              <p>
                VPM Session active — {request?.advisor_name}'s data is open in a new tab. Navigate
                their book freely and return here to close the ticket when done.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground whitespace-pre-wrap">{request?.description}</p>

            {request?.household_name && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Related to: </span>
                <span>{request.household_name}</span>
                {request.household_aum && (
                  <span> · {formatCurrency(request.household_aum)} AUM</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-none min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div ref={scrollRef} className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
              {messagesLoading ? (
                <div className="text-sm text-muted-foreground py-10 text-center">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground py-10 text-center">No messages yet</div>
              ) : (
                messages.map((msg: any) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm border",
                          isMe
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-foreground border-border"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content ?? msg.message}</p>
                        <p
                          className={cn(
                            "mt-1 text-[11px]",
                            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {msg.sender_name || "Unknown"} · {new Date(msg.created_at).toLocaleTimeString("en-US", {
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

            <div className="flex flex-col gap-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Send a message to the advisor..."
                rows={2}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!messageText.trim() || isSending}
                className="self-end"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-80 shrink-0 space-y-4 mt-9">
        <Card className="border-border shadow-none">
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                Status
              </label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              size="sm"
              variant={status === "resolved" ? "outline" : "default"}
              onClick={() => handleStatusChange(status === "resolved" ? "open" : "resolved")}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {status === "resolved" ? "Reopen Ticket" : "Close Ticket"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Advisor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold shrink-0">
                {request?.advisor_name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("") || "?"}
              </div>
              <div>
                <p className="font-medium text-foreground">{request?.advisor_name}</p>
                {request?.firm_name && (
                  <p className="text-xs text-muted-foreground">{request.firm_name}</p>
                )}
              </div>
            </div>

            <div className="pt-2 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <span>Billing</span>
                <span className="font-medium text-foreground capitalize text-right">
                  {request?.advisor_billing_type === "prime_partner"
                    ? "⭐ Prime (Included)"
                    : request?.advisor_billing_type === "hourly"
                      ? `$${request.advisor_hourly_rate}/hr`
                      : "—"}
                </span>
              </div>
              {request?.vpm_timeline && (
                <div className="flex justify-between gap-3">
                  <span>Requested by</span>
                  <span className={cn("font-medium text-right", TIMELINE_STYLES[request.vpm_timeline] || "text-foreground")}>
                    {TIMELINE_LABELS[request.vpm_timeline]}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span>Submitted</span>
                <span className="font-medium text-foreground text-right">
                  {request?.created_at &&
                    new Date(request.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {request?.household_id && household && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Household
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{household.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{household.status}</p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <TierBadge
                    tier={household.wealth_tier}
                    showUnassigned
                    pending={!!household.tier_pending_review}
                  />
                  <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                    <Link to={`/households/${household.id}`}>Open</Link>
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <span>AUM</span>
                  <span className="font-medium text-foreground text-right">
                    {formatCurrency(household.total_aum)}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span>Risk</span>
                  <span className="font-medium text-foreground text-right">
                    {household.risk_tolerance}
                  </span>
                </div>

                {household.investment_objective && (
                  <div className="flex justify-between gap-3">
                    <span>Objective</span>
                    <span className="font-medium text-foreground text-right">
                      {household.investment_objective}
                    </span>
                  </div>
                )}

                {household.annual_review_date && (
                  <div className="flex justify-between gap-3">
                    <span>Next Review</span>
                    <span className="font-medium text-foreground text-right">
                      {new Date(household.annual_review_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}

                {household.last_review_date && (
                  <div className="flex justify-between gap-3">
                    <span>Last Review</span>
                    <span className="font-medium text-foreground text-right">
                      {new Date(household.last_review_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {request?.advisor_billing_type === "hourly" && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                Hours
                {(request?.vpm_hours_logged || 0) > 0 && (
                  <span className="font-semibold text-foreground normal-case">
                    {request.vpm_hours_logged}h logged
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Hours"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                  className="h-8 text-xs w-24"
                  step="0.25"
                  min="0"
                />
                <Input
                  placeholder="Note (optional)"
                  value={hoursNote}
                  onChange={(e) => setHoursNote(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs h-8"
                onClick={handleLogHours}
                disabled={!hoursInput}
              >
                <Clock className="w-3 h-3 mr-1.5" />
                Log Hours
              </Button>
              {request?.vpm_hours_notes && (
                <p className="text-xs text-muted-foreground italic">"{request.vpm_hours_notes}"</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-none">
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Quick Actions
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs justify-start"
              onClick={() => navigate(`/admin/advisors/${request?.advisor_id}`)}
            >
              <User className="w-3.5 h-3.5 mr-2" />
              View Advisor Profile
            </Button>
            <Button
              size="sm"
              className="w-full text-xs justify-start gap-2"
              onClick={isActiveSession ? handleExitSession : handleEnterSession}
            >
              <Zap className="w-3.5 h-3.5" />
              {isActiveSession ? "Exit VPM Session" : "Enter VPM Session"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardContent className="pt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>Session changes and ticket updates sync back into the shared VPM request queue.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
