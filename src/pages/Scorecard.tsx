import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Lock, Search, ClipboardList, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTargetAdvisorId, useHouseholds } from "@/hooks/useHouseholds";
import { useTasks } from "@/hooks/useTasks";
import { useProspects } from "@/hooks/useProspects";
import { formatCurrency } from "@/data/sampleData";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import TierBadge from "@/components/TierBadge";

type AlertLevel = "critical" | "warning" | "info";

interface HouseholdSnapshotRow {
  household_id: string;
  snapshot_date: string;
  total_aum: number;
}

interface TouchpointRow {
  id: string;
  household_id: string;
  name: string;
  scheduled_date: string;
  households?: {
    id: string;
    name: string;
    wealth_tier: string | null;
  } | null;
}

interface RecentNoteRow {
  household_id: string;
  date: string;
}

function getAlertLevel(
  currentAum: number,
  previousAum: number
): "critical" | "warning" | "info" | null {
  const dollarDrop = previousAum - currentAum;
  const percentDrop = previousAum > 0 ? (dollarDrop / previousAum) * 100 : 0;

  if (dollarDrop <= 0) return null;

  const isLarge = currentAum >= 1000000;
  const isMedium = currentAum >= 250000;

  if (isLarge) {
    if (dollarDrop >= 500000 || percentDrop >= 15) return "critical";
    if (dollarDrop >= 100000 || percentDrop >= 8) return "warning";
    if (dollarDrop >= 50000 || percentDrop >= 4) return "info";
  } else if (isMedium) {
    if (dollarDrop >= 100000 || percentDrop >= 12) return "critical";
    if (dollarDrop >= 25000 || percentDrop >= 7) return "warning";
    if (dollarDrop >= 10000 || percentDrop >= 3) return "info";
  } else {
    if (dollarDrop >= 25000 || percentDrop >= 10) return "critical";
    if (dollarDrop >= 10000 || percentDrop >= 6) return "warning";
    if (dollarDrop >= 3000 || percentDrop >= 3) return "info";
  }

  return null;
}

const levelBadgeClassNames: Record<AlertLevel, string> = {
  critical: "border-destructive/20 bg-destructive/10 text-destructive",
  warning: "border-amber/20 bg-amber-muted text-amber",
  info: "border-primary/20 bg-primary/10 text-primary",
};

export default function Scorecard() {
  const { user } = useAuth();
  const { advisorId } = useTargetAdvisorId();

  const { data: householdSnapshots = [] } = useQuery({
    queryKey: ["scorecard_snapshots", advisorId],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data } = await supabase
        .from("household_snapshots")
        .select("*")
        .eq("advisor_id", advisorId!)
        .gte("snapshot_date", sevenDaysAgo.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true });
      return (data || []) as HouseholdSnapshotRow[];
    },
    enabled: !!advisorId && !!user,
  });

  const { data: allTouchpoints = [] } = useQuery({
    queryKey: ["scorecard_touchpoints", advisorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("touchpoints")
        .select(`
          *,
          households(id, name, wealth_tier)
        `)
        .eq("advisor_id", advisorId!)
        .eq("status", "upcoming")
        .lte("scheduled_date", new Date().toISOString().split("T")[0]);
      return (data || []) as TouchpointRow[];
    },
    enabled: !!advisorId && !!user,
  });

  const { data: recentNotes = [] } = useQuery({
    queryKey: ["scorecard_notes", advisorId],
    queryFn: async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data } = await supabase
        .from("compliance_notes")
        .select("household_id, date")
        .eq("advisor_id", advisorId!)
        .gte("date", ninetyDaysAgo.toISOString().split("T")[0]);
      return (data || []) as RecentNoteRow[];
    },
    enabled: !!advisorId && !!user,
  });

  const { data: allTasks = [] } = useTasks("mine");
  const { data: households = [] } = useHouseholds();
  const { data: prospects = [] } = useProspects();

  const aumAlerts = useMemo(() => {
    const alerts: {
      householdId: string;
      householdName: string;
      currentAum: number;
      previousAum: number;
      dollarDrop: number;
      percentDrop: number;
      level: AlertLevel;
    }[] = [];

    const byHousehold = householdSnapshots.reduce<Record<string, HouseholdSnapshotRow[]>>((acc, snap) => {
      if (!acc[snap.household_id]) acc[snap.household_id] = [];
      acc[snap.household_id].push(snap);
      return acc;
    }, {});

    Object.entries(byHousehold).forEach(([hhId, snaps]) => {
      if (snaps.length < 2) return;
      const sorted = [...snaps].sort(
        (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
      );
      const current = sorted[0].total_aum;
      const previous = sorted[sorted.length - 1].total_aum;
      const level = getAlertLevel(current, previous);
      if (!level) return;

      const hh = households.find((h) => h.id === hhId);
      if (!hh) return;

      alerts.push({
        householdId: hhId,
        householdName: hh.name,
        currentAum: current,
        previousAum: previous,
        dollarDrop: previous - current,
        percentDrop: previous > 0 ? ((previous - current) / previous) * 100 : 0,
        level,
      });
    });

    return alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.level] - order[b.level];
    });
  }, [householdSnapshots, households]);

  const overdueTouchpoints = useMemo(
    () =>
      allTouchpoints.filter((tp) => {
        const scheduled = new Date(tp.scheduled_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return scheduled < today;
      }),
    [allTouchpoints]
  );

  const noRecentContact = useMemo(() => {
    const contactedIds = new Set(recentNotes.map((n) => n.household_id));
    return households
      .filter((h) => h.status === "Active" && !contactedIds.has(h.id))
      .slice(0, 10);
  }, [households, recentNotes]);

  const tierUpgrades = useMemo(
    () =>
      households
        .filter((h) => {
          if (!h.tier_score) return false;
          if (h.wealth_tier === "platinum") return false;
          if (h.wealth_tier === "silver" && h.tier_score >= 50) return true;
          if (h.wealth_tier === "gold" && h.tier_score >= 75) return true;
          return false;
        })
        .slice(0, 5),
    [households]
  );

  const noTimeline = useMemo(
    () => households.filter((h) => h.wealth_tier && h.status === "Active").slice(0, 10),
    [households]
  );

  const birthdaysThisMonth = useMemo(() => {
    return [];
  }, []);

  const stalledProspects = useMemo(
    () =>
      prospects.filter((p) => {
        if (p.pipeline_stage === "converted" || p.pipeline_stage === "lost") return false;
        const updated = new Date(p.updated_at);
        const daysSince = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince >= 14;
      }),
    [prospects]
  );

  const [blotterSearch, setBlotterSearch] = useState("");
  const [blotterFilter, setBlotterFilter] = useState<"all" | "pending" | "completed">("all");

  const blotterTasks = useMemo(() => {
    let tasks = allTasks as any[];

    if (blotterSearch.trim()) {
      const q = blotterSearch.toLowerCase();
      tasks = tasks.filter(
        (t) => t.title?.toLowerCase().includes(q) || t.households?.name?.toLowerCase().includes(q)
      );
    }

    if (blotterFilter === "pending") {
      tasks = tasks.filter((t) => t.status !== "done");
    } else if (blotterFilter === "completed") {
      tasks = tasks.filter((t) => t.status === "done");
    }

    return tasks.sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  }, [allTasks, blotterSearch, blotterFilter]);

  const touchpointHouseholdIds = useMemo(
    () => new Set(allTouchpoints.map((tp) => tp.household_id)),
    [allTouchpoints]
  );

  const missingTimeline = useMemo(
    () => noTimeline.filter((h) => !touchpointHouseholdIds.has(h.id)).slice(0, 5),
    [noTimeline, touchpointHouseholdIds]
  );

  void birthdaysThisMonth;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crosshair className="h-4 w-4" />
            <span>Client Management Scorecard</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Client Management Scorecard</h1>
            <p className="text-sm text-muted-foreground">
              Book health, risk alerts, and team accountability
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
          Updated daily at 6:00 AM
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-amber" />
              Risk Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">AUM Changes (7 days)</h2>
              </div>

              {aumAlerts.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No significant changes
                </div>
              ) : (
                <div className="space-y-3">
                  {aumAlerts.map((alert) => (
                    <div
                      key={alert.householdId}
                      className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{alert.householdName}</div>
                        <div className="text-sm text-muted-foreground">
                          -{formatCurrency(alert.dollarDrop)} ({alert.percentDrop.toFixed(1)}%) this week
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {alert.level === "critical" && (
                          <Badge className={cn("border", levelBadgeClassNames.critical)}>CRITICAL</Badge>
                        )}
                        {alert.level === "warning" && (
                          <Badge className={cn("border", levelBadgeClassNames.warning)}>WARNING</Badge>
                        )}
                        {alert.level === "info" && (
                          <Badge className={cn("border", levelBadgeClassNames.info)}>INFO</Badge>
                        )}
                        <Link
                          to={`/household/${alert.householdId}`}
                          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {overdueTouchpoints.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-4">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Overdue Touchpoints</h2>
                <div className="space-y-2">
                  {overdueTouchpoints.slice(0, 5).map((tp) => (
                    <div
                      key={tp.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                    >
                      <div>
                        <div className="font-medium text-foreground">{tp.households?.name}</div>
                        <div className="text-sm text-muted-foreground">{tp.name}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {Math.floor(
                          (Date.now() - new Date(tp.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)
                        )}
                        d overdue
                      </Badge>
                    </div>
                  ))}
                  {overdueTouchpoints.length > 5 && (
                    <div className="text-sm text-muted-foreground">+{overdueTouchpoints.length - 5} more</div>
                  )}
                </div>
              </div>
            )}

            {noRecentContact.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-4">
                <h2 className="mb-3 text-sm font-semibold text-foreground">No Contact in 90+ Days</h2>
                <div className="space-y-2">
                  {noRecentContact.slice(0, 5).map((hh) => (
                    <Link
                      key={hh.id}
                      to={`/household/${hh.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40"
                    >
                      <span className="font-medium text-foreground">{hh.name}</span>
                      <span className="text-primary">View →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                  <Lock className="h-4 w-4" />
                  High Cash Positions
                </div>
                available after LPL integration
              </div>
              <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                  <Lock className="h-4 w-4" />
                  Outbound ACATs
                </div>
                available after LPL integration
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Crosshair className="h-5 w-5 text-primary" />
              Opportunity Radar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {tierUpgrades.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-4">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Tier Upgrade Candidates</h2>
                <div className="space-y-3">
                  {tierUpgrades.map((hh) => (
                    <div
                      key={hh.id}
                      className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{hh.name}</span>
                          <TierBadge tier={hh.wealth_tier} size="sm" />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Score {hh.tier_score} — consider {hh.wealth_tier === "silver" ? "Gold" : "Platinum"} upgrade
                        </div>
                      </div>
                      <Link
                        to={`/household/${hh.id}`}
                        className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                      >
                        Review →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Missing Service Timeline</h2>
              {missingTimeline.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  All tiered households have a timeline
                </div>
              ) : (
                <div className="space-y-2">
                  {missingTimeline.map((hh) => (
                    <Link
                      key={hh.id}
                      to={`/household/${hh.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{hh.name}</span>
                        <TierBadge tier={hh.wealth_tier} size="sm" />
                      </div>
                      <span className="text-primary">Generate →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {stalledProspects.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-4">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Stalled Prospects (14+ days)</h2>
                <div className="space-y-2">
                  {stalledProspects.slice(0, 4).map((p) => (
                    <Link
                      key={p.id}
                      to={`/prospects/${p.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40"
                    >
                      <span className="font-medium text-foreground">
                        {p.first_name} {p.last_name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.floor((Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24))}d idle
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {tierUpgrades.length === 0 && stalledProspects.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                No opportunities flagged
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="h-5 w-5 text-primary" />
                The Blotter
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Search and verify task completion across your book
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={blotterSearch}
                onChange={(e) => setBlotterSearch(e.target.value)}
                className="h-8 pl-9 text-sm"
                placeholder="Search tasks or client"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "completed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setBlotterFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                    blotterFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {blotterTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {blotterSearch ? `No tasks found for "${blotterSearch}"` : "No tasks found"}
                    </td>
                  </tr>
                ) : (
                  blotterTasks.slice(0, 50).map((task: any) => {
                    const statusLabel =
                      task.status === "done"
                        ? "Done"
                        : task.due_date && new Date(task.due_date) < new Date()
                          ? "Overdue"
                          : "Pending";

                    return (
                      <tr key={task.id} className="border-t border-border">
                        <td className="px-4 py-3 text-foreground">{task.households?.name || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{task.title}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.due_date
                            ? new Date(task.due_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.completed_at
                            ? new Date(task.completed_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              statusLabel === "Done" && "border-emerald/20 bg-emerald-muted text-emerald",
                              statusLabel === "Pending" && "border-primary/20 bg-primary/10 text-primary",
                              statusLabel === "Overdue" && "border-destructive/20 bg-destructive/10 text-destructive"
                            )}
                          >
                            {statusLabel}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {blotterTasks.length > 50 && (
            <div className="text-sm text-muted-foreground">
              Showing 50 of {blotterTasks.length} tasks. Use search to narrow results.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}