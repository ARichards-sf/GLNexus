import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, Users, Activity, Search, UserPlus, Eye, ShieldCheck, Play, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { useAdminStats, useAdminAdvisors, useToggleAdvisorStatus, useAutomationLogs, useRunSnapshots, type AdvisorRecord } from "@/hooks/useAdmin";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
import InviteAdvisorDialog from "@/components/InviteAdvisorDialog";
import { useToast } from "@/hooks/use-toast";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useSelectedFirm } from "@/contexts/FirmContext";

export default function AdminAdvisors() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: advisors = [], isLoading } = useAdminAdvisors();
  const { data: logs = [] } = useAutomationLogs();
  const toggleStatus = useToggleAdvisorStatus();
  const runSnapshots = useRunSnapshots();
  const { toast } = useToast();
  const { startImpersonating } = useImpersonation();
  const { selectedFirmId } = useSelectedFirm();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  // Fetch firm memberships when scoping to a firm
  const { data: firmAdvisorIds } = useQuery({
    queryKey: ["firm_advisor_ids", selectedFirmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firm_memberships")
        .select("user_id")
        .eq("firm_id", selectedFirmId!)
        .eq("role", "advisor");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id));
    },
    enabled: !!selectedFirmId,
  });

  const filtered = useMemo(() => {
    let list = advisors;
    if (selectedFirmId && firmAdvisorIds) {
      list = list.filter((a) => firmAdvisorIds.has(a.user_id));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (a: any) =>
        (a.full_name || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q)
    );
  }, [advisors, search, selectedFirmId, firmAdvisorIds]);

  const handleToggle = async (advisor: AdvisorRecord) => {
    const newStatus = advisor.status === "active" ? "inactive" : "active";
    try {
      await toggleStatus.mutateAsync({ user_id: advisor.user_id, status: newStatus });
      toast({ title: `Advisor ${newStatus === "active" ? "activated" : "deactivated"}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-secondary rounded-lg" />)}
          </div>
          <div className="h-64 bg-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Manage advisors and monitor platform health.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Add Advisor
        </Button>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Total Firm AUM</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {stats ? formatFullCurrency(stats.total_aum) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Total Advisors</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {stats?.advisor_count ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Active Today</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {stats?.active_today ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search advisors by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      {/* Advisor Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Advisor</TableHead>
              <TableHead>Staff Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Book of Business</TableHead>
              <TableHead>Households</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((advisor) => (
              <TableRow key={advisor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/advisors/${advisor.user_id}`)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                      {(advisor.full_name || "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">{advisor.full_name || "Unnamed"}</span>
                      {advisor.roles.includes("admin") && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 bg-amber-muted text-amber font-medium">
                          <ShieldCheck className="w-3 h-3 mr-0.5" /> Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {(advisor as any).is_internal ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[11px] font-medium">GL Corporate</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] font-medium">Field Advisor</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{advisor.email}</TableCell>
                <TableCell className="text-right text-sm font-semibold text-foreground">
                  {formatCurrency(advisor.total_aum)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{advisor.household_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {advisor.last_sign_in_at
                    ? new Date(advisor.last_sign_in_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "Never"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={advisor.status === "active"}
                      onCheckedChange={() => handleToggle(advisor)}
                      disabled={toggleStatus.isPending || advisor.roles.includes("admin")}
                    />
                    <span className={`text-xs font-medium ${advisor.status === "active" ? "text-emerald" : "text-muted-foreground"}`}>
                      {advisor.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      startImpersonating({ id: advisor.user_id, name: advisor.full_name || "Unnamed" });
                      navigate("/");
                    }}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> View As
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                  No advisors found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Automation Logs */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Automation Logs</h2>
            <p className="text-sm text-muted-foreground">Nightly snapshot job runs at 12:00 AM UTC.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={runSnapshots.isPending}
            onClick={async () => {
              try {
                await runSnapshots.mutateAsync();
                toast({ title: "Snapshots generated successfully" });
              } catch (e: any) {
                toast({ title: "Snapshot failed", description: e.message, variant: "destructive" });
              }
            }}
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            {runSnapshots.isPending ? "Running…" : "Run Now"}
          </Button>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Function</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Advisors Processed</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const duration = log.completed_at
                  ? `${((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000).toFixed(1)}s`
                  : "—";
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.status === "success" ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[11px]">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Success
                        </Badge>
                      ) : log.status === "error" ? (
                        <Badge variant="destructive" className="text-[11px]">
                          <XCircle className="w-3 h-3 mr-1" /> Error
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px]">
                          <Clock className="w-3 h-3 mr-1" /> Running
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{log.function_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{log.message || "—"}</TableCell>
                    <TableCell className="text-sm text-foreground">{log.records_processed}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{duration}</TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                    No automation logs yet. Click "Run Now" to trigger the first snapshot.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <InviteAdvisorDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
