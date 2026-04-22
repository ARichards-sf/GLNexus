import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlProfile } from "@/hooks/useAdmin";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import VpmRequestCard from "@/components/vpm/VpmRequestCard";
import {
  REQUEST_TYPE_LABELS,
  TIMELINE_LABELS,
  type VpmRequestRow,
  getSubject,
} from "@/components/vpm/vpmRequestMeta";

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

export default function AdminVpmRequests() {
  const navigate = useNavigate();
  const { data: glProfile } = useGlProfile();
  const { data: requests = [], isLoading } = useVpmRequests();

  const isVpmStaff =
    !!glProfile?.is_gl_internal &&
    ((glProfile as any)?.department === "vpm" ||
      glProfile?.platform_role === "super_admin" ||
      glProfile?.platform_role === "developer");

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [search, setSearch] = useState("");

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

  if (!glProfile || (glProfile && !isVpmStaff)) {
    return null;
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">VPM Requests</h1>
            <p className="text-muted-foreground mt-0.5">Virtual Practice Management support queue.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
            Open: {stats.open}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
            In Progress: {stats.inProgress}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
            This Week: {stats.thisWeek}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
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
        <Select value={timelineFilter} onValueChange={setTimelineFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Timelines</SelectItem>
            {Object.entries(TIMELINE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
          Loading VPM requests...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
          No VPM requests match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => (
            <VpmRequestCard
              key={request.id}
              request={request}
              onClick={() => navigate(`/admin/vpm-requests/${request.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
