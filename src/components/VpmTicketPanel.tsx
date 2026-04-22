import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, ExternalLink, User, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  REQUEST_TYPE_LABELS,
  STATUS_STYLES,
  TIMELINE_LABELS,
  type VpmRequestRow,
} from "@/components/vpm/vpmRequestMeta";
import { formatCurrency } from "@/data/sampleData";
import { cn } from "@/lib/utils";

interface VpmTicketPanelRecord extends VpmRequestRow {
  advisor_billing_type?: string | null;
}

const VPM_TICKET_ID_KEY = "vpm_ticket_id";

export default function VpmTicketPanel() {
  const { vpmAdvisor, stopVpmSession } = useImpersonation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const ticketId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return ((window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id ||
      window.localStorage.getItem(VPM_TICKET_ID_KEY) ||
      undefined);
  }, []);

  const { data: request } = useQuery({
    queryKey: ["vpm_ticket_panel", ticketId],
    queryFn: async (): Promise<VpmTicketPanelRecord | null> => {
      if (!ticketId) return null;

      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", ticketId)
        .single();

      if (error || !data) {
        throw error ?? new Error("Ticket not found");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("vpm_billing_type")
        .eq("user_id", data.advisor_id)
        .maybeSingle();

      return {
        ...data,
        advisor_billing_type: profile?.vpm_billing_type ?? null,
      } as VpmTicketPanelRecord;
    },
    enabled: !!ticketId,
    refetchInterval: 30000,
  });

  const [status, setStatus] = useState(request?.status || "open");
  const [hoursInput, setHoursInput] = useState("");

  useEffect(() => {
    if (request?.status) setStatus(request.status);
  }, [request?.status]);

  const clearActiveTicketId = () => {
    if (typeof window === "undefined") return;
    delete (window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id;
    window.localStorage.removeItem(VPM_TICKET_ID_KEY);
  };

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from("service_requests")
      .update({ status: newStatus })
      .eq("id", ticketId!);

    if (error) {
      toast.error(error.message || "Failed to update status");
      return;
    }

    setStatus(newStatus);
    queryClient.invalidateQueries({ queryKey: ["vpm_requests"] });
    queryClient.invalidateQueries({ queryKey: ["vpm_ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["vpm_ticket_panel", ticketId] });
    toast.success(`Status → ${newStatus}`);
  };

  const handleLogHours = async () => {
    const hrs = parseFloat(hoursInput);
    if (isNaN(hrs) || hrs <= 0) return;

    const current = request?.vpm_hours_logged || 0;
    const { error } = await supabase
      .from("service_requests")
      .update({ vpm_hours_logged: current + hrs })
      .eq("id", ticketId!);

    if (error) {
      toast.error(error.message || "Failed to log hours");
      return;
    }

    setHoursInput("");
    queryClient.invalidateQueries({ queryKey: ["vpm_ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["vpm_ticket_panel", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["vpm_requests"] });
    toast.success(`${hrs}h logged`);
  };

  const handleCloseTicket = async () => {
    await handleStatusChange("resolved");
    stopVpmSession();
    clearActiveTicketId();
    navigate("/admin/vpm-requests");
  };

  if (!ticketId || !request) {
    return (
      <div className="p-4 space-y-4">
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-foreground">VPM Session Active</span>
          </div>
          <p className="text-sm text-muted-foreground">Serving: {vpmAdvisor?.name}</p>
          <p className="text-sm text-muted-foreground">No ticket linked to this session.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              stopVpmSession();
              clearActiveTicketId();
              navigate("/admin/vpm-requests");
            }}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            End Session
          </Button>
        </div>
      </div>
    );
  }

  const isHourly = request.advisor_billing_type === "hourly";

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className={cn("capitalize", STATUS_STYLES[status] || "")}>{status}</Badge>
              <button
                onClick={() => navigate(`/admin/vpm-requests/${ticketId}`)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Full ticket
              </button>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">
                {REQUEST_TYPE_LABELS[request.vpm_request_type || ""] || "VPM Support Request"}
              </p>
              {request.household_name && (
                <p className="text-xs text-muted-foreground mt-1">
                  {request.household_name}
                  {request.household_aum ? ` · ${formatCurrency(request.household_aum)} AUM` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {request.vpm_timeline && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Requested by: {TIMELINE_LABELS[request.vpm_timeline]}</span>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request</p>
        <p className="text-sm text-foreground whitespace-pre-wrap">{request.description}</p>
      </div>

      <div className="rounded-md border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
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

      {isHourly && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hours</p>
            {(request.vpm_hours_logged || 0) > 0 && (
              <span className="text-xs font-medium text-foreground">{request.vpm_hours_logged}h</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={hoursInput}
              placeholder="0.25"
              onChange={(e) => setHoursInput(e.target.value)}
              className="h-8 text-xs w-20"
              step="0.25"
              min="0"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleLogHours}>
              Log
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{vpmAdvisor?.name}</span>
        </div>

        <div className="space-y-2">
          <Button size="sm" className="w-full" onClick={handleCloseTicket}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Close Ticket & End Session
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => {
              stopVpmSession();
              clearActiveTicketId();
            }}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            End Session Only
          </Button>
        </div>
      </div>
    </div>
  );
}