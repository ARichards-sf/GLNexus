import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
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
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
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
                    ? "bg-red-500"
                    : t.priority === "high"
                      ? "bg-amber-500"
                      : t.priority === "medium"
                        ? "bg-blue-500"
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
                    <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot}`} />
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
                          isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground",
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

    case "upcoming_meetings": {
      const visibleEvents = upcomingEvents.slice(0, size === "large" ? 8 : 5);
      return (
        <Card className="border-border shadow-none h-full">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Upcoming Meetings
              </CardTitle>
              <Link to="/calendar">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  View Calendar <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleEvents.map((ev) => (
              <Link
                key={ev.id}
                to="/calendar"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors group"
              >
                <div className="w-2 h-8 rounded-full shrink-0 bg-primary/50" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ev.households?.name || "No household linked"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-foreground">
                    {new Date(ev.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(ev.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </Link>
            ))}
            {visibleEvents.length === 0 && (
              <div className="text-center py-6">
                <CalendarDays className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No upcoming meetings</p>
                <Link to="/calendar">
                  <Button variant="outline" size="sm" className="mt-2 text-xs">Schedule a meeting</Button>
                </Link>
              </div>
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
      const grouped = activeProspects.reduce((acc: Record<string, { count: number; value: number }>, prospect: any) => {
        const stage = prospect.pipeline_stage || "lead";
        if (!acc[stage]) acc[stage] = { count: 0, value: 0 };
        acc[stage].count += 1;
        acc[stage].value += Number(prospect.estimated_aum || 0);
        return acc;
      }, {});
      const entries = Object.entries(grouped).sort((a, b) => b[1].value - a[1].value);
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {household.wealth_tier || "Tier pending"}
                    </p>
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
                  <span className="text-[11px] text-red-600 dark:text-red-400 shrink-0 font-medium">Overdue</span>
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

    case "referral_leaderboard": {
      const counts = prospects.reduce((acc: Record<string, { count: number; value: number }>, prospect: any) => {
        const householdId = prospect.referred_by_household_id;
        if (!householdId) return acc;
        if (!acc[householdId]) acc[householdId] = { count: 0, value: 0 };
        acc[householdId].count += 1;
        acc[householdId].value += Number(prospect.estimated_aum || 0);
        return acc;
      }, {});

      const leaderboard = Object.entries(counts)
        .map(([householdId, stats]) => ({
          householdId,
          household: households.find((h) => h.id === householdId),
          ...stats,
        }))
        .filter((entry) => entry.household)
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
