import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHouseholds, useTargetAdvisorId } from "@/hooks/useHouseholds";
import { useTasks } from "@/hooks/useTasks";
import { useProspects } from "@/hooks/useProspects";
import { streamChat } from "@/lib/aiChat";
import { formatCurrency } from "@/data/sampleData";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import TierBadge from "@/components/TierBadge";
import PageLoader from "@/components/PageLoader";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Search,
  ClipboardList,
  Crosshair,
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react";

type AlertLevel = "critical" | "warning" | "info";

type HouseholdSnapshotRow = {
  household_id: string;
  snapshot_date: string;
  total_aum: number;
};

type TouchpointRow = {
  id: string;
  household_id: string;
  name: string;
  scheduled_date: string;
  households?: {
    id: string;
    name: string;
    wealth_tier: string | null;
  } | null;
};

type RecentCompletedRow = {
  household_id: string;
  completed_date: string;
};

type TouchpointHouseholdRow = {
  household_id: string | null;
};

const SUMMARY_CACHE_KEY = "scorecard_goodie_summary";

const SUMMARY_DATE_KEY = "scorecard_goodie_summary_date";

function getCachedSummary(): string | null {
  try {
    const cachedDate = localStorage.getItem(SUMMARY_DATE_KEY);
    const today = new Date().toISOString().split("T")[0];

    if (cachedDate !== today) return null;

    return localStorage.getItem(SUMMARY_CACHE_KEY);
  } catch {
    return null;
  }
}

function cacheSummary(summary: string): void {
  try {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem(SUMMARY_CACHE_KEY, summary);
    localStorage.setItem(SUMMARY_DATE_KEY, today);
  } catch {
    // localStorage unavailable
  }
}

function clearSummaryCache(): void {
  try {
    localStorage.removeItem(SUMMARY_CACHE_KEY);
    localStorage.removeItem(SUMMARY_DATE_KEY);
  } catch {}
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

export default function Scorecard() {
  const { user } = useAuth();
  const { advisorId } = useTargetAdvisorId();
  const { data: households = [] } = useHouseholds();
  const { data: allTasks = [] } = useTasks("mine");
  const { data: prospects = [] } = useProspects();

  const cachedOnMount = getCachedSummary();
  const [summary, setSummary] = useState(cachedOnMount || "");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerated, setSummaryGenerated] = useState(!!cachedOnMount);
  const summaryRef = useRef<boolean>(!!cachedOnMount);
  const summaryTextRef = useRef<string>("");

  const [blotterSearch, setBlotterSearch] = useState("");
  const [blotterFilter, setBlotterFilter] = useState<"all" | "pending" | "completed">("all");

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
    enabled: !!advisorId,
  });

  const { data: overdueTouchpoints = [] } = useQuery({
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
    enabled: !!advisorId,
  });

  const { data: recentCompleted = [] } = useQuery({
    queryKey: ["scorecard_recent_completed", advisorId],
    queryFn: async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const { data } = await supabase
        .from("touchpoints")
        .select("household_id, completed_date")
        .eq("advisor_id", advisorId!)
        .eq("status", "completed")
        .gte("completed_date", sixtyDaysAgo.toISOString().split("T")[0]);
      return (data || []) as RecentCompletedRow[];
    },
    enabled: !!advisorId,
  });

  const { data: allTouchpoints = [] } = useQuery({
    queryKey: ["scorecard_all_touchpoints", advisorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("touchpoints")
        .select("household_id")
        .eq("advisor_id", advisorId!);
      return (data || []) as TouchpointHouseholdRow[];
    },
    enabled: !!advisorId,
  });

  const aumAlerts = useMemo(() => {
    const byHousehold = householdSnapshots.reduce<Record<string, HouseholdSnapshotRow[]>>((acc, snap) => {
      if (!acc[snap.household_id]) acc[snap.household_id] = [];
      acc[snap.household_id].push(snap);
      return acc;
    }, {});

    const alerts: {
      householdId: string;
      householdName: string;
      currentAum: number;
      previousAum: number;
      dollarDrop: number;
      percentDrop: number;
      level: AlertLevel;
    }[] = [];

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
      const order: Record<AlertLevel, number> = {
        critical: 0,
        warning: 1,
        info: 2,
      };
      return order[a.level] - order[b.level];
    });
  }, [householdSnapshots, households]);

  const contactGaps = useMemo(() => {
    const recentHouseholdIds = new Set(recentCompleted.map((t) => t.household_id));
    return households
      .filter(
        (h) =>
          h.status === "Active" &&
          (h.wealth_tier === "platinum" || h.wealth_tier === "gold") &&
          !recentHouseholdIds.has(h.id)
      )
      .map((h) => ({
        id: h.id,
        name: h.name,
        tier: h.wealth_tier as string,
      }))
      .sort((a, b) => {
        if (a.tier === "platinum" && b.tier === "gold") return -1;
        if (a.tier === "gold" && b.tier === "platinum") return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [households, recentCompleted]);

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

  const touchpointHouseholdIds = useMemo(
    () => new Set(allTouchpoints.map((tp) => tp.household_id).filter(Boolean)),
    [allTouchpoints]
  );

  const missingTimeline = useMemo(
    () =>
      households
        .filter((h) => h.wealth_tier && h.status === "Active" && !touchpointHouseholdIds.has(h.id))
        .slice(0, 5),
    [households, touchpointHouseholdIds]
  );

  const stalledProspects = useMemo(
    () =>
      (prospects as any[]).filter((p) => {
        if (p.pipeline_stage === "converted" || p.pipeline_stage === "lost") return false;
        const daysSince = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        return daysSince >= 14;
      }),
    [prospects]
  );

  const blotterTasks = useMemo(() => {
    let tasks = [...(allTasks as any[])];
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

  const totalAUM = useMemo(
    () => households.reduce((sum, h) => sum + Number(h.total_aum), 0),
    [households]
  );

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Advisor";

  const generateSummary = useCallback(async () => {
    if (summaryLoading) return;

    setSummaryLoading(true);
    setSummary("");
    summaryTextRef.current = "";

    const alertLines = aumAlerts
      .slice(0, 5)
      .map(
        (a) =>
          `${a.householdName}: -${formatCurrency(a.dollarDrop)} (-${a.percentDrop.toFixed(1)}%) — ${a.level}`
      )
      .join("\n");

    const overdueLines = overdueTouchpoints
      .slice(0, 5)
      .map((tp) => {
        const days = Math.floor(
          (Date.now() - new Date(tp.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return `${tp.households?.name}: ${tp.name} — ${days}d overdue`;
      })
      .join("\n");

    const prompt = `You are reviewing the book of business for financial advisor ${firstName}.

BOOK STATS:
Total AUM: ${formatCurrency(totalAUM)}
Active households: ${households.filter((h) => h.status === "Active").length}
Active prospects: ${(prospects as any[]).filter(
      (p) => p.pipeline_stage !== "converted" && p.pipeline_stage !== "lost"
    ).length}

AUM ALERTS THIS WEEK:
${alertLines || "None"}

OVERDUE TOUCHPOINTS:
${overdueLines || "None"}

PLATINUM/GOLD WITH NO TOUCHPOINT IN 60 DAYS:
${contactGaps.slice(0, 5).map((h) => `${h.name} (${h.tier})`).join(", ") || "None"}

OPPORTUNITIES:
Tier upgrade candidates: ${tierUpgrades.length}
Households missing service timeline: ${missingTimeline.length}
Stalled prospects (14+ days): ${stalledProspects.length}

Write a concise 3-4 sentence executive summary of book health for ${firstName}.
Lead with the most urgent item.
Name specific clients where relevant.
End with the single most important action to take today.
Be direct and advisor-focused.
Do not use bullet points.
Do not mention that you are an AI.`;

    try {
      await new Promise<void>((resolve, reject) => {
        streamChat({
          messages: [{ role: "user", content: prompt }],
          context: "",
          onDelta: (chunk) => {
            summaryTextRef.current += chunk;
            setSummary((prev) => prev + chunk);
          },
          onToolCalls: () => {},
          onDone: () => {
            resolve();
          },
          onError: (msg) => reject(new Error(msg)),
        }).catch(reject);
      });
      setSummaryGenerated(true);
      cacheSummary(summaryTextRef.current);
      summaryTextRef.current = "";
    } catch {
      setSummary("Unable to generate summary. Check your alerts below.");
    } finally {
      setSummaryLoading(false);
    }
  }, [
    firstName,
    totalAUM,
    households,
    prospects,
    aumAlerts,
    overdueTouchpoints,
    contactGaps,
    tierUpgrades,
    missingTimeline,
    stalledProspects,
    summaryLoading,
  ]);

  useEffect(() => {
    if (summaryRef.current || summaryGenerated || summaryLoading || households.length === 0) return;
    summaryRef.current = true;
    generateSummary();
  }, [households.length, generateSummary, summaryGenerated, summaryLoading]);

  const isLoading = households.length === 0 && !aumAlerts.length;

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6 p-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm md:flex-row md:items-end md:justify-between">
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
          <CheckCircle2 className="h-3.5 w-3.5" />
          Updated daily at 6:00 AM
        </div>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Goodie&apos;s Assessment</h2>
                {summaryLoading && !summary && (
                  <span className="text-sm text-muted-foreground">Analyzing your book...</span>
                )}
              </div>
              {(summary || summaryLoading) && (
                <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                  {summary}
                  {summaryLoading && summary && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSummaryGenerated(false);
              summaryRef.current = false;
              generateSummary();
            }}
            disabled={summaryLoading}
            className="h-7 shrink-0 text-xs text-muted-foreground"
          >
            {summaryLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Refresh
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5" />
              Risk Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">AUM Changes (7 days)</h2>
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
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                            alert.level === "critical" && "border-destructive/20 bg-destructive/10 text-destructive",
                            alert.level === "warning" && "border-border bg-secondary text-foreground",
                            alert.level === "info" && "border-primary/20 bg-primary/10 text-primary"
                          )}
                        >
                          {alert.level}
                        </span>
                        <Link to={`/household/${alert.householdId}`} className="text-sm font-medium text-primary">
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Overdue Touchpoints</h2>
              {overdueTouchpoints.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  All touchpoints on track
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueTouchpoints.slice(0, 5).map((tp) => {
                    const days = Math.floor(
                      (Date.now() - new Date(tp.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={tp.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                      >
                        <div>
                          <div className="font-medium text-foreground">{tp.households?.name}</div>
                          <div className="text-sm text-muted-foreground">{tp.name}</div>
                        </div>
                        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                          {days}d overdue
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                No Touchpoint in 60 Days
                <span className="ml-1.5 text-[10px] normal-case font-normal">
                  Platinum &amp; Gold only
                </span>
              </p>
              {contactGaps.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  All Platinum &amp; Gold clients have recent touchpoints
                </p>
              ) : (
                <div className="space-y-2">
                  {contactGaps.map((hh) => (
                    <div
                      key={hh.id}
                      className="flex items-center justify-between border-b border-border py-1.5 last:border-0"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            hh.tier === "platinum"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          )}
                        >
                          {hh.tier === "platinum" ? "Plat" : "Gold"}
                        </span>
                        <span className="truncate text-xs font-medium text-foreground">{hh.name}</span>
                      </div>
                      <Link
                        to={`/household/${hh.id}`}
                        className="ml-2 shrink-0 text-xs text-primary hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                  {contactGaps.length >= 8 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      Showing top 8 — check Households for full list
                    </p>
                  )}
                </div>
              )}
            </div>

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
              <Crosshair className="h-5 w-5" />
              Opportunity Radar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Tier Upgrade Candidates</h2>
              {tierUpgrades.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No upgrades flagged
                </div>
              ) : (
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
                      <Link to={`/household/${hh.id}`} className="text-sm font-medium text-primary">
                        Review →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary/60"
                    >
                      <div className="flex items-center gap-2">
                        <TierBadge tier={hh.wealth_tier} size="sm" />
                        <span className="font-medium text-foreground">{hh.name}</span>
                      </div>
                      <span className="text-primary">Generate →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Stalled Prospects (14+ days)</h2>
              {stalledProspects.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No stalled prospects
                </div>
              ) : (
                <div className="space-y-2">
                  {stalledProspects.slice(0, 4).map((p: any) => {
                    const days = Math.floor(
                      (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                      >
                        <Link to={`/prospects/${p.id}`} className="font-medium text-foreground">
                          {p.first_name} {p.last_name}
                        </Link>
                        <span className="text-sm text-muted-foreground">{days}d idle</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="h-5 w-5" />
                The Blotter
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Search to verify task completion across your book
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
                placeholder="Search tasks or households"
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
              <thead className="bg-secondary/50">
                <tr className="text-left text-muted-foreground">
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
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
                      <tr key={task.id} className="border-t border-border align-top">
                        <td className="px-4 py-3 text-foreground">{task.households?.name || "—"}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{task.title}</td>
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
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-medium",
                              statusLabel === "Done" && "bg-secondary text-foreground",
                              statusLabel === "Overdue" && "bg-destructive/10 text-destructive",
                              statusLabel === "Pending" && "bg-primary/10 text-primary"
                            )}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {blotterTasks.length > 50 && (
            <p className="text-sm text-muted-foreground">
              Showing 50 of {blotterTasks.length} tasks. Use search to narrow results.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
