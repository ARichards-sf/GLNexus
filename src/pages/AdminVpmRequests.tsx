import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlProfile } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Zap, Star, Clock, Search, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/data/sampleData";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  financial_planning_review: "Financial Planning Review",
  portfolio_analysis: "Portfolio Analysis",
  client_meeting_prep: "Client Meeting Prep",
  proposal_preparation: "Proposal Preparation",
  tax_planning_support: "Tax Planning Support",
  estate_planning_support: "Estate Planning Support",
  general_advisory_support: "General Advisory Support",
  other: "Other",
};

const TIMELINE_LABELS: Record<string, string> = {
  asap: "ASAP",
  "24_hours": "24 hours",
  "3_days": "3 days",
  this_week: "This week",
  no_rush: "No rush",
};

const TIMELINE_STYLES: Record<string, string> = {
  asap: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "24_hours": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "3_days": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  this_week: "bg-secondary text-muted-foreground",
  no_rush: "bg-secondary text-muted-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-secondary text-muted-foreground",
};

interface VpmRequestRow {
  id: string;
  advisor_id: string;
  category: string;
  description: string;
  status: string;
  is_vpm: boolean;
  vpm_request_type: string | null;
  vpm_timeline: string | null;
  vpm_hours_logged: number | null;
  vpm_hours_notes: string | null;
  household_id: string | null;
  household_name: string | null;
  household_aum: number | null;
  created_at: string;
  // joined
  advisor_name?: string | null;
  advisor_billing_type?: string | null;
}

function useVpmRequests() {
  return useQuery({
    queryKey: ["vpm_requests"],
    queryFn: async (): Promise<VpmRequestRow[]> => {
      const { data: requests, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("is_vpm", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const advisorIds = Array.from(new Set((requests ?? []).map((r) => r.advisor_id)));
      let profilesById: Record<string, { full_name: string | null; vpm_billing_type: string | null }> = {};
      if (advisorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, vpm_billing_type")
          .in("user_id", advisorIds);
        profilesById = Object.fromEntries(
          (profiles ?? []).map((p: any) => [p.user_id, { full_name: p.full_name, vpm_billing_type: p.vpm_billing_type }])
        );
      }

      return (requests ?? []).map((r: any) => ({
        ...r,
        advisor_name: profilesById[r.advisor_id]?.full_name ?? null,
        advisor_billing_type: profilesById[r.advisor_id]?.vpm_billing_type ?? null,
      }));
    },
  });
}

function getSubject(description: string) {
  const firstLine = description.split("\n")[0];
  return firstLine.length > 100 ? firstLine.slice(0, 100) + "…" : firstLine;
}

function HoursLogger({
  request,
  onSaved,
}: {
  request: VpmRequestRow;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const h = Number(hours);
    if (!h || h <= 0) {
      toast.error("Enter a valid number of hours.");
      return;
    }
    setSaving(true);
    const newTotal = Number(request.vpm_hours_logged ?? 0) + h;
    const newNotes = notes.trim()
      ? request.vpm_hours_notes
        ? `${request.vpm_hours_notes}\n${new Date().toISOString().slice(0, 10)}: +${h}h — ${notes.trim()}`
        : `${new Date().toISOString().slice(0, 10)}: +${h}h — ${notes.trim()}`
      : request.vpm_hours_notes;

    const { error } = await supabase
      .from("service_requests")
      .update({ vpm_hours_logged: newTotal, vpm_hours_notes: newNotes })
      .eq("id", request.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to log hours.");
      return;
    }
    toast.success(`Logged ${h}h. Total: ${newTotal}h`);
    setHours("");
    setNotes("");
    setOpen(false);
    onSaved();
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Clock className="w-3.5 h-3.5 mr-1.5" />
        Log Hours
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        step="0.25"
        placeholder="Hrs"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="w-20 h-8 text-xs"
      />
      <Input
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-40 h-8 text-xs"
      />
      <Button size="sm" onClick={handleSave} disabled={saving} className="h-8">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8">
        ✕
      </Button>
    </div>
  );
}

export default function AdminVpmRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: glProfile } = useGlProfile();
  const { data: requests = [], isLoading, refetch } = useVpmRequests();

  const isVpmStaff =
    !!glProfile?.is_gl_internal &&
    ((glProfile as any)?.department === "vpm" ||
      glProfile?.platform_role === "super_admin" ||
      glProfile?.platform_role === "developer");

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Redirect if not authorized once profile loads
  useEffect(() => {
    if (glProfile && !isVpmStaff) {
      toast.error("You don't have access to VPM Requests.");
      navigate("/");
    }
  }, [glProfile, isVpmStaff, navigate]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      open: requests.filter((r) => r.status === "open").length,
      inProgress: requests.filter((r) => r.status === "in-progress").length,
      thisWeek: requests.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length,
    };
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.vpm_request_type !== typeFilter) return false;
      if (timelineFilter !== "all" && r.vpm_timeline !== timelineFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const subject = getSubject(r.description).toLowerCase();
        const advisor = (r.advisor_name ?? "").toLowerCase();
        if (!subject.includes(q) && !advisor.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, timelineFilter, search]);

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["vpm_requests"] });
    refetch();
  };

  if (!glProfile || (glProfile && !isVpmStaff)) {
    return null;
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">VPM Requests</h1>
          <p className="text-muted-foreground mt-0.5">
            Virtual Practice Management support queue.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Open</p>
            <p className="text-3xl font-semibold mt-1 text-amber-600">{stats.open}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">In Progress</p>
            <p className="text-3xl font-semibold mt-1 text-blue-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">This Week</p>
            <p className="text-3xl font-semibold mt-1 text-foreground">{stats.thisWeek}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search advisor or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={timelineFilter} onValueChange={setTimelineFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Timelines</SelectItem>
            {Object.entries(TIMELINE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border shadow-none">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Loading VPM requests...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Zap className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
              No VPM requests match your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isPrime = r.advisor_billing_type === "prime_partner";
                  const isHourly = r.advisor_billing_type === "hourly";
                  const showLog = r.status === "in-progress" || r.status === "resolved" || r.status === "open";
                  return (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="max-w-[280px]">
                        <p className="font-semibold text-foreground text-sm leading-snug">
                          {getSubject(r.description)}
                        </p>
                        {r.household_id && r.household_name && (
                          <Link
                            to={`/household/${r.household_id}`}
                            className="text-xs text-primary hover:underline mt-0.5 inline-block"
                          >
                            {r.household_name}
                            {r.household_aum ? ` · ${formatCurrency(Number(r.household_aum))}` : ""}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-foreground">
                          {r.advisor_name || "—"}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isPrime && (
                            <Badge variant="secondary" className="h-5 text-[10px] gap-1 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200/60">
                              <Star className="w-2.5 h-2.5 fill-current" /> Prime
                            </Badge>
                          )}
                          {isHourly && (
                            <Badge variant="secondary" className="h-5 text-[10px] gap-1">
                              <Clock className="w-2.5 h-2.5" /> Hourly
                            </Badge>
                          )}
                          {!isPrime && !isHourly && (
                            <span className="text-[10px] text-muted-foreground">Custom</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {r.vpm_request_type ? REQUEST_TYPE_LABELS[r.vpm_request_type] ?? r.vpm_request_type : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.vpm_timeline ? (
                          <Badge className={`text-[11px] ${TIMELINE_STYLES[r.vpm_timeline] ?? ""}`}>
                            {r.vpm_timeline === "asap" && <AlertCircle className="w-3 h-3 mr-1" />}
                            {TIMELINE_LABELS[r.vpm_timeline] ?? r.vpm_timeline}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`capitalize text-[11px] ${STATUS_STYLES[r.status] ?? ""}`}>
                          {r.status.replace("-", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {Number(r.vpm_hours_logged ?? 0)}h
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {showLog && <HoursLogger request={r} onSaved={onSaved} />}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/requests/${r.id}`)}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
