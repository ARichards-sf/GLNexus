import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  CheckSquare,
  FileText,
  GitBranch,
  Phone,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MorningBriefing from "@/components/MorningBriefing";
import GoodieSuggests from "@/components/GoodieSuggests";
import TierBadge from "@/components/TierBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { WidgetInstance } from "@/lib/dashboardWidgets";

const noteTypeColors: Record<string, string> = {
  Prospecting: "bg-amber-muted text-amber",
  Review: "bg-emerald-muted text-emerald",
  Service: "bg-secondary text-muted-foreground",
  Compliance: "bg-secondary text-muted-foreground",
  Onboarding: "bg-emerald-muted text-emerald",
};

const noteTypeIcons: Record<string, React.ElementType> = {
  Prospecting: Users,
  Review: CalendarCheck,
  Service: Phone,
  Compliance: FileText,
  Onboarding: FileText,
};

type StageStats = {
  count: number;
  value: number;
};

interface WidgetRendererProps {
  instance: WidgetInstance;
  households: any[];
  recentNotes: any[];
  upcomingEvents: any[];
  pendingTasks: any[];
  prospects: any[];
  firstName: string;
  userId: string;
  firmAccentColor?: string;
  totalAUM: number;
  totalHouseholds: number;
  activeHouseholds: number;
  upcomingReviews: any[];
}

function ClientScorecardWidget() {
  const { user } = useAuth();

  const { data: upcomingTouchpoints = [] } = useQuery({
    queryKey: ["all_touchpoints_scorecard", user?.id],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { data, error } = await supabase
        .from("touchpoints")
        .select(
          `
            *,
            households(
              id,
              name,
              wealth_tier,
              total_aum
            )
          `,
        )
        .eq("advisor_id", user!.id)
        .in("status", ["upcoming", "active"])
        .lte("scheduled_date", thirtyDaysFromNow)
        .order("scheduled_date");

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const byHousehold = useMemo(() => {
    const map = new Map();

    upcomingTouchpoints.forEach((tp: any) => {
      const hhId = tp.household_id;
      if (!map.has(hhId)) {
        map.set(hhId, {
          household: tp.households,
          touchpoints: [],
          overdue: 0,
        });
      }
      const entry = map.get(hhId)!;
      entry.touchpoints.push(tp);
      if (new Date(tp.scheduled_date) < new Date()) {
        entry.overdue++;
      }
    });

    return Array.from(map.values()).sort((a: any, b: any) => b.overdue - a.overdue);
  }, [upcomingTouchpoints]);

  const totalOverdue = upcomingTouchpoints.filter(
    (tp: any) => new Date(tp.scheduled_date) < new Date(),
  ).length;

  return (
    <Card className="border-border shadow-none h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Client Scorecard
          </CardTitle>
          {totalOverdue > 0 && (
            <span className="inline-flex rounded-full bg-amber-muted px-2.5 py-1 text-xs font-medium text-amber">
              {totalOverdue} overdue
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {byHousehold.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="mb-2 h-6 w-6 text-emerald" />
            <p className="text-sm text-muted-foreground">All touchpoints up to date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {byHousehold.slice(0, 6).map(({ household, touchpoints: tps, overdue }: any) => (
              <div key={household?.id ?? tps[0]?.household_id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{household?.name}</p>
                      {household?.wealth_tier && <TierBadge tier={household.wealth_tier} size="sm" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Next: {tps[0]?.name}
                      {" · "}
                      {new Date(tps[0]?.scheduled_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {overdue > 0 && (
                      <span className="inline-flex rounded-full bg-destructive/10 px-2 py-1 font-medium text-destructive">
                        {overdue} overdue
                      </span>
                    )}
                    <span className="inline-flex rounded-full bg-secondary px-2 py-1 font-medium text-muted-foreground">
                      {tps.length} upcoming
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WidgetRenderer({
  instance,
  households,
  recentNotes,
  upcomingEvents,
  pendingTasks,
  prospects,
  firstName,
  userId,
  firmAccentColor,
  totalAUM,
  totalHouseholds,
  activeHouseholds,
  upcomingReviews,
}: WidgetRendererProps) {
  const size = instance.size;

  switch (instance.widgetId) {
    case "morning_briefing":
      return (
        <div className="[&>*]:mb-0">
          <MorningBriefing
            households={households}
            recentNotes={recentNotes as any}
            upcomingEvents={upcomingEvents as any}
            pendingTasks={pendingTasks as any}
            firstName={firstName}
            userId={userId}
            accentColor={firmAccentColor}
            prospects={prospects}
          />
        </div>
      );

    case "kpi_cards":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border shadow-none">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">Total Book of Business</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{formatCurrency(totalAUM)}</p>
              <p className="text-xs text-muted-foreground mt-2">{formatFullCurrency(totalAUM)}</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-none">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">Households</span>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{totalHouseholds}</p>
              <p className="text-xs text-muted-foreground mt-2">{activeHouseholds} active</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-none">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">Upcoming Reviews</span>
                <CalendarCheck className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{upcomingReviews.length}</p>
              <p className="text-xs text-muted-foreground mt-2">Next 60 days</p>
            </CardContent>
          </Card>
        </div>
      );

    case "pending_tasks": {
      const visibleTasks = pendingTasks.filter((t) => t.status !== "done").slice(0, size === "large" ? 6 : 4);
      return (
        <Card className="border-border shadow-none h-full">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Pending Tasks
              </CardTitle>
              <Link to="/tasks">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  View all <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleTasks.length === 0 ? (
              <div className="text-center py-6">
                <CheckSquare className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">You're all caught up</p>
              </div>
            ) : (
              visibleTasks.map((t) => {
                const priorityDot =
                  t.priority === "urgent"
                    ? "bg-destructive"
                    : t.priority === "high"
                      ? "bg-amber"
                      : t.priority === "medium"
                        ? "bg-primary"
                        : "bg-muted-foreground/40";
                const isOverdue =
                  !!t.due_date &&
                  new Date(t.due_date + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <Link
                    key={t.id}
                    to={`/tasks/${t.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors"
                  >
                    <div className={cn("w-2 h-2 rounded-full shrink-0", priorityDot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                      {t.households?.name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.households.name}</p>
                      )}
                    </div>
                    {t.due_date && (
                      <span
                        className={cn(
                          "text-[11px] shrink-0",
                          isOverdue ? "text-destructive font-medium" : "text-muted-foreground",
                        )}
                      >
                        {new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      );
    }

    case "goodie_suggests":
      return <GoodieSuggests households={households as any} recentNotes={recentNotes as any} />;

    case "pipeline_summary": {
      const activeProspects = prospects.filter(
        (p: any) => p.pipeline_stage !== "converted" && p.pipeline_stage !== "lost",
      );
      const grouped = activeProspects.reduce<Record<string, StageStats>>((acc, prospect: any) => {
        const stage = prospect.pipeline_stage || "lead";
        if (!acc[stage]) acc[stage] = { count: 0, value: 0 };
        acc[stage].count += 1;
        acc[stage].value += Number(prospect.estimated_aum || 0);
        return acc;
      }, {});
      const entries = Object.entries(grouped) as [string, StageStats][];
      entries.sort((a, b) => b[1].value - a[1].value);
      const totalValue = activeProspects.reduce((sum: number, p: any) => sum + Number(p.estimated_aum || 0), 0);

      return (
        <Card className="border-border shadow-none h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Pipeline Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(totalValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{activeProspects.length} active prospects</p>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active pipeline right now.</p>
            ) : (
              <div className="space-y-3">
                {entries.slice(0, size === "large" ? 6 : 4).map(([stage, stats]) => (
                  <div key={stage} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground capitalize">{stage.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">
                        {stats.count} · {formatCurrency(stats.value)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${totalValue > 0 ? (stats.value / totalValue) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    case "top_households": {
      const topHouseholds = [...households]
        .sort((a, b) => Number(b.total_aum || 0) - Number(a.total_aum || 0))
        .slice(0, size === "large" ? 6 : 4);

      return (
        <Card className="border-border shadow-none h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Top Households
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topHouseholds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No households available.</p>
            ) : (
              topHouseholds.map((household, index) => (
                <Link
                  key={household.id}
                  to={`/households/${household.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {index + 1}. {household.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{household.wealth_tier || "Tier pending"}</p>
                  </div>
                  <span className="text-xs font-medium text-foreground shrink-0">
                    {formatCurrency(Number(household.total_aum || 0))}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      );
    }

    case "overdue_reviews": {
      const overdue = households
        .filter((h) => h.annual_review_date && new Date(h.annual_review_date) < new Date())
        .sort((a, b) => new Date(a.annual_review_date!).getTime() - new Date(b.annual_review_date!).getTime())
        .slice(0, size === "large" ? 6 : 4);

      return (
        <Card className="border-border shadow-none h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Overdue Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue annual reviews.</p>
            ) : (
              overdue.map((household) => (
                <Link
                  key={household.id}
                  to={`/households/${household.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{household.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {new Date(household.annual_review_date!).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-[11px] text-destructive shrink-0 font-medium">Overdue</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      );
    }

    case "recent_activity": {
      const items = recentNotes.slice(0, size === "large" ? 8 : 5);
      return (
        <Card className="border-border shadow-none h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              items.map((note: any) => {
                const Icon = noteTypeIcons[note.type] || FileText;
                const colorClass = noteTypeColors[note.type] || "bg-secondary text-muted-foreground";
                return (
                  <div key={note.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60">
                    <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", colorClass)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{note.type}</p>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(note.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{note.summary}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      );
    }

    case "client_scorecard":
      return <ClientScorecardWidget />;

    case "referral_leaderboard": {
      const counts = prospects.reduce<Record<string, StageStats>>((acc, prospect: any) => {
        const householdId = prospect.referred_by_household_id;
        if (!householdId) return acc;
        if (!acc[householdId]) acc[householdId] = { count: 0, value: 0 };
        acc[householdId].count += 1;
        acc[householdId].value += Number(prospect.estimated_aum || 0);
        return acc;
      }, {});

      const leaderboard = (Object.entries(counts) as [string, StageStats][])
        .map(([householdId, stats]) => ({
          householdId,
          household: households.find((h) => h.id === householdId),
          count: stats.count,
          value: stats.value,
        }))
        .filter((entry) => !!entry.household)
        .sort((a, b) => b.count - a.count || b.value - a.value)
        .slice(0, size === "large" ? 6 : 4);

      return (
        <Card className="border-border shadow-none h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Referral Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referral data yet.</p>
            ) : (
              leaderboard.map((entry, index) => (
                <Link
                  key={entry.householdId}
                  to={`/households/${entry.householdId}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {index + 1}. {entry.household?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.count} referral{entry.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-foreground shrink-0">{formatCurrency(entry.value)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      );
    }

    default:
      return null;
  }
}
