import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  FileText,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Gift,
  Trophy,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHouseholds, useAllComplianceNotes, type HouseholdRow } from "@/hooks/useHouseholds";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGES } from "@/hooks/useProspects";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";
import { cn } from "@/lib/utils";

const formatCurrency = (n: number): string => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};


// ---------- helpers ----------
const formatAUM = (n: number): string => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtShortDate = (iso: string) => {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtFullDate = (iso: string) => {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const daysBetween = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

const relativeTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day ago";
  if (diff < 30) return `${diff} days ago`;
  if (diff < 60) return "1 month ago";
  if (diff < 365) return `${Math.round(diff / 30)} months ago`;
  return `${Math.round(diff / 365)} year${diff >= 730 ? "s" : ""} ago`;
};

const RISK_COLORS: Record<string, string> = {
  Conservative: "hsl(217 91% 60%)",
  Moderate: "hsl(160 84% 39%)",
  Aggressive: "hsl(38 92% 50%)",
  "Very Aggressive": "hsl(0 84% 60%)",
};

const STATUS_COLORS = [
  "hsl(215 25% 47%)",
  "hsl(160 60% 45%)",
  "hsl(38 80% 55%)",
  "hsl(280 50% 55%)",
  "hsl(200 60% 50%)",
];

const NOTE_TYPE_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(280 60% 55%)",
  "hsl(0 70% 60%)",
  "hsl(190 70% 50%)",
  "hsl(330 70% 60%)",
];

// ---------- StatCard ----------
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        </div>
        <p className={cn("text-2xl font-semibold tracking-tight mt-2 text-foreground", valueClass)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- Tab 1 ----------
type SortKey = "name" | "aum";
function BookOfBusinessTab() {
  const { data: households = [] } = useHouseholds();
  const { data: notes = [] } = useAllComplianceNotes();
  const [sortKey, setSortKey] = useState<SortKey>("aum");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const stats = useMemo(() => {
    const totalAum = households.reduce((s, h) => s + Number(h.total_aum || 0), 0);
    const count = households.length;
    const active = households.filter((h) => h.status === "Active").length;
    const inactive = count - active;
    const now = new Date();
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);
    const reviewsDue = households.filter((h) => {
      if (!h.annual_review_date) return false;
      const d = new Date(h.annual_review_date + "T00:00:00");
      return d <= in90;
    }).length;
    return { totalAum, count, active, inactive, reviewsDue };
  }, [households]);

  const riskData = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of households) {
      map.set(h.risk_tolerance, (map.get(h.risk_tolerance) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [households]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of households) {
      map.set(h.status, (map.get(h.status) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [households]);

  const lastNoteByHousehold = useMemo(() => {
    const map = new Map<string, { date: string; type: string }>();
    for (const n of (notes as any[]) || []) {
      const existing = map.get(n.household_id);
      if (!existing || new Date(n.date) > new Date(existing.date)) {
        map.set(n.household_id, { date: n.date, type: n.type });
      }
    }
    return map;
  }, [notes]);

  const sortedHouseholds = useMemo(() => {
    const arr = [...households];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = Number(a.total_aum) - Number(b.total_aum);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [households, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "aum" ? "desc" : "asc");
    }
  };

  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total AUM"
          value={formatAUM(stats.totalAum)}
          sub={`Across ${stats.count} household${stats.count === 1 ? "" : "s"}`}
          icon={TrendingUp}
        />
        <StatCard
          label="Average AUM per Household"
          value={stats.count > 0 ? formatAUM(stats.totalAum / stats.count) : "$0"}
          sub="Per relationship"
          icon={Users}
        />
        <StatCard
          label="Active Households"
          value={stats.active}
          sub={`${stats.inactive} inactive or onboarding`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Annual Reviews Due"
          value={stats.reviewsDue}
          sub="Next 90 days"
          icon={CalendarIcon}
          valueClass={stats.reviewsDue > 0 ? "text-amber-600" : undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risk Tolerance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {riskData.map((entry) => (
                      <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "hsl(215 25% 47%)"} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend formatter={(v, e: any) => `${v} (${e.payload.value})`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Household Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {statusData.map((entry, i) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend formatter={(v, e: any) => `${v} (${e.payload.value})`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Households table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Households</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                    Name <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("aum")} className="flex items-center gap-1 hover:text-foreground">
                    AUM <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Annual Review</TableHead>
                <TableHead>Last Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHouseholds.map((h) => {
                const last = lastNoteByHousehold.get(h.id);
                const reviewDate = h.annual_review_date
                  ? new Date(h.annual_review_date + "T00:00:00")
                  : null;
                const overdue = reviewDate && reviewDate < today;
                return (
                  <TableRow key={h.id}>
                    <TableCell>
                      <Link to={`/household/${h.id}`} className="font-medium text-foreground hover:underline">
                        {h.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{formatAUM(Number(h.total_aum))}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{h.risk_tolerance}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{h.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {reviewDate ? (
                        <span className={cn("text-sm flex items-center gap-1", overdue && "text-red-600 font-medium")}>
                          {overdue && <AlertCircle className="w-3.5 h-3.5" />}
                          {fmtFullDate(h.annual_review_date!)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {last ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{fmtShortDate(last.date)}</span>
                          <Badge variant="outline" className="text-xs font-normal">{last.type}</Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedHouseholds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No households found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Tab 2 ----------
function ReviewStatusTab() {
  const { data: households = [] } = useHouseholds();
  const { data: notes = [] } = useAllComplianceNotes();
  const [showReviewed, setShowReviewed] = useState(false);
  const [scheduleHousehold, setScheduleHousehold] = useState<HouseholdRow | null>(null);

  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);

  // Map household_id → most recent Annual Review note date
  const lastAnnualReview = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of (notes as any[]) || []) {
      if (n.type !== "Annual Review") continue;
      const existing = map.get(n.household_id);
      if (!existing || new Date(n.date) > new Date(existing)) {
        map.set(n.household_id, n.date);
      }
    }
    return map;
  }, [notes]);

  const stats = useMemo(() => {
    let reviewedThisYear = 0;
    let notReviewed = 0;
    let overdue = 0;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const h of households) {
      const last = lastAnnualReview.get(h.id);
      const lastDate = last ? new Date(last + "T00:00:00") : null;
      if (lastDate && lastDate >= yearStart) reviewedThisYear++;
      else notReviewed++;

      const reviewDue = h.annual_review_date ? new Date(h.annual_review_date + "T00:00:00") : null;
      const hasRecentReview = lastDate && lastDate >= oneYearAgo;
      if (reviewDue && reviewDue < today && !hasRecentReview) overdue++;
    }
    return { reviewedThisYear, notReviewed, overdue };
  }, [households, lastAnnualReview, today, yearStart]);

  const needsReview = useMemo(() => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return households
      .map((h) => {
        const last = lastAnnualReview.get(h.id);
        const lastDate = last ? new Date(last + "T00:00:00") : null;
        const reviewDue = h.annual_review_date ? new Date(h.annual_review_date + "T00:00:00") : null;
        const isOverdue = reviewDue && reviewDue < today;
        const noRecent = !lastDate || lastDate < oneYearAgo;
        if (!isOverdue && !noRecent) return null;
        const reference = reviewDue && reviewDue < today ? reviewDue : oneYearAgo;
        const daysOverdue = Math.max(0, daysBetween(today, reference));
        return { household: h, lastDate, daysOverdue };
      })
      .filter((x): x is { household: HouseholdRow; lastDate: Date | null; daysOverdue: number } => !!x)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [households, lastAnnualReview, today]);

  const reviewedThisYearList = useMemo(() => {
    return households
      .map((h) => {
        const last = lastAnnualReview.get(h.id);
        const lastDate = last ? new Date(last + "T00:00:00") : null;
        if (!lastDate || lastDate < yearStart) return null;
        return { household: h, date: last! };
      })
      .filter((x): x is { household: HouseholdRow; date: string } => !!x)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [households, lastAnnualReview, yearStart]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Reviewed This Year"
          value={stats.reviewedThisYear}
          sub={`Of ${households.length} households`}
          icon={CheckCircle2}
          valueClass="text-emerald-600"
        />
        <StatCard
          label="Not Yet Reviewed"
          value={stats.notReviewed}
          sub="No annual review this year"
          icon={CalendarIcon}
          valueClass={stats.notReviewed > 0 ? "text-amber-600" : undefined}
        />
        <StatCard
          label="Overdue Reviews"
          value={stats.overdue}
          sub="Past due date, no recent review"
          icon={AlertCircle}
          valueClass={stats.overdue > 0 ? "text-red-600" : undefined}
        />
      </div>

      {/* Needs Review */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Needs Review</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {needsReview.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              All households are up to date. 🎉
            </div>
          ) : (
            <div className="divide-y divide-border">
              {needsReview.map(({ household, lastDate, daysOverdue }) => (
                <div key={household.id} className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/40">
                  <div className="flex-1 min-w-0">
                    <Link to={`/household/${household.id}`} className="font-medium text-foreground hover:underline">
                      {household.name}
                    </Link>
                    <p className="text-xs mt-0.5">
                      {lastDate ? (
                        <span className="text-muted-foreground">Last reviewed {fmtFullDate(lastDate.toISOString().slice(0, 10))}</span>
                      ) : (
                        <span className="text-red-600/80">Never reviewed</span>
                      )}
                    </p>
                  </div>
                  <Badge variant="destructive" className="font-normal">{daysOverdue} days overdue</Badge>
                  <span className="text-sm font-medium tabular-nums w-20 text-right">{formatAUM(Number(household.total_aum))}</span>
                  <Button size="sm" variant="outline" onClick={() => setScheduleHousehold(household)}>
                    Schedule Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviewed This Year (collapsible) */}
      <Card>
        <CardHeader className="pb-2">
          <button
            onClick={() => setShowReviewed((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <CardTitle className="text-base">
              {showReviewed ? "Hide" : "Show"} {reviewedThisYearList.length} reviewed household{reviewedThisYearList.length === 1 ? "" : "s"}
            </CardTitle>
            {showReviewed ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {showReviewed && (
          <CardContent className="p-0">
            {reviewedThisYearList.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No reviews completed yet this year.</div>
            ) : (
              <div className="divide-y divide-border">
                {reviewedThisYearList.map(({ household, date }) => (
                  <div key={household.id} className="flex items-center justify-between gap-4 p-4">
                    <Link to={`/household/${household.id}`} className="font-medium text-foreground hover:underline">
                      {household.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{fmtFullDate(date)}</span>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 font-normal">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Reviewed
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {scheduleHousehold && (
        <ScheduleEventDialog
          open={!!scheduleHousehold}
          onOpenChange={(open) => !open && setScheduleHousehold(null)}
          defaultHouseholdId={scheduleHousehold.id}
          defaultHouseholdName={scheduleHousehold.name}
          defaultEventType="Annual Review"
          defaultTitle={`Annual Review — ${scheduleHousehold.name}`}
        />
      )}
    </div>
  );
}

// ---------- Tab 3 ----------
function ActivityTasksTab() {
  const { data: notes = [] } = useAllComplianceNotes();
  const { data: tasks = [] } = useTasks("mine");

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    const notesArr = (notes as any[]) || [];
    const notesThisMonth = notesArr.filter((n) => new Date(n.date + "T00:00:00") >= monthStart).length;
    const notesThisYear = notesArr.filter((n) => new Date(n.date + "T00:00:00") >= yearStart).length;
    const pending = tasks.filter((t) => t.status === "todo").length;
    const completed30 = tasks.filter(
      (t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= thirtyAgo
    ).length;
    return { notesThisMonth, notesThisYear, pending, completed30 };
  }, [notes, tasks]);

  const noteTypeData = useMemo(() => {
    const ninety = new Date();
    ninety.setDate(ninety.getDate() - 90);
    const map = new Map<string, number>();
    for (const n of (notes as any[]) || []) {
      const d = new Date(n.date + "T00:00:00");
      if (d < ninety) continue;
      map.set(n.type, (map.get(n.type) || 0) + 1);
    }
    return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
  }, [notes]);

  const recentNotes = useMemo(() => {
    return [...((notes as any[]) || [])]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [notes]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Notes This Month" value={stats.notesThisMonth} icon={FileText} />
        <StatCard label="Notes This Year" value={stats.notesThisYear} icon={FileText} />
        <StatCard
          label="Pending Tasks"
          value={stats.pending}
          icon={CalendarIcon}
          valueClass={stats.pending > 0 ? "text-amber-600" : undefined}
        />
        <StatCard
          label="Completed Tasks"
          value={stats.completed30}
          sub="Last 30 days"
          icon={CheckCircle2}
          valueClass="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Note Activity by Type</CardTitle>
            <p className="text-xs text-muted-foreground">Last 90 days</p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {noteTypeData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No notes in the last 90 days.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={noteTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="type" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <RTooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {noteTypeData.map((_, i) => (
                        <Cell key={i} fill={NOTE_TYPE_COLORS[i % NOTE_TYPE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Compliance Notes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentNotes.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notes yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentNotes.map((n: any) => (
                  <div key={n.id} className="p-4 hover:bg-secondary/40">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs font-normal">{n.type}</Badge>
                      {n.households?.name && (
                        <Link to={`/household/${n.household_id}`} className="text-sm font-medium text-foreground hover:underline">
                          {n.households.name}
                        </Link>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{relativeTime(n.date + "T00:00:00")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {n.summary?.length > 80 ? n.summary.slice(0, 80) + "…" : n.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- Tab 4: Referrals ----------
interface LeaderboardEntry {
  householdId: string;
  householdName: string;
  totalReferrals: number;
  converted: number;
  pending: number;
  lost: number;
  estimatedAum: number;
  prospects: any[];
}

function ReferralsTab() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const advisorId = user ? targetAdvisorId(user.id) : undefined;

  const { data: households = [] } = useHouseholds();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: allProspects = [] } = useQuery({
    queryKey: ["all_prospects_referrals", advisorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prospects")
        .select("*")
        .eq("advisor_id", advisorId!)
        .not("referred_by_household_id", "is", null);
      return data || [];
    },
    enabled: !!advisorId,
  });

  const householdMap = useMemo(() => {
    const m = new Map<string, HouseholdRow>();
    for (const h of households) m.set(h.id, h);
    return m;
  }, [households]);

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const map = new Map<string, LeaderboardEntry>();

    for (const p of allProspects) {
      const hId = p.referred_by_household_id!;
      const household = householdMap.get(hId);
      const fallbackName = p.referred_by || household?.name || "Unknown";

      if (!map.has(hId)) {
        map.set(hId, {
          householdId: hId,
          householdName: household?.name || fallbackName,
          totalReferrals: 0,
          converted: 0,
          pending: 0,
          lost: 0,
          estimatedAum: 0,
          prospects: [],
        });
      }

      const entry = map.get(hId)!;
      entry.totalReferrals++;
      entry.estimatedAum += Number(p.estimated_aum || 0);
      entry.prospects.push(p);

      if (p.pipeline_stage === "converted") entry.converted++;
      else if (p.pipeline_stage === "lost") entry.lost++;
      else entry.pending++;
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalReferrals - a.totalReferrals
    );
  }, [allProspects, householdMap]);

  const totalReferrals = allProspects.length;
  const totalConverted = allProspects.filter(
    (p) => p.pipeline_stage === "converted"
  ).length;
  const conversionRate =
    totalReferrals > 0
      ? Math.round((totalConverted / totalReferrals) * 100)
      : 0;
  const inPipelineCount = allProspects.filter(
    (p) => p.pipeline_stage !== "converted" && p.pipeline_stage !== "lost"
  ).length;
  const totalPipelineValue = allProspects
    .filter(
      (p) => p.pipeline_stage !== "converted" && p.pipeline_stage !== "lost"
    )
    .reduce((sum, p) => sum + Number(p.estimated_aum || 0), 0);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stageMeta = (key: string) =>
    PIPELINE_STAGES.find((s) => s.key === key) || {
      label: key,
      color: "bg-muted text-muted-foreground",
    };

  const rankBadge = (idx: number) => {
    if (idx === 0) return "🥇";
    if (idx === 1) return "🥈";
    if (idx === 2) return "🥉";
    return `#${idx + 1}`;
  };

  const conversionColor = (rate: number) => {
    if (rate >= 50) return "text-emerald-600 font-medium";
    if (rate >= 25) return "text-amber-600 font-medium";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Referrals"
          value={totalReferrals}
          sub="From existing clients"
          icon={Gift}
        />
        <StatCard
          label="Converted"
          value={totalConverted}
          sub={`${conversionRate}% conversion rate`}
          icon={CheckCircle2}
          valueClass="text-emerald-600"
        />
        <StatCard
          label="In Pipeline"
          value={inPipelineCount}
          sub={`${formatCurrency(totalPipelineValue)} estimated`}
          icon={TrendingUp}
          valueClass="text-blue-600"
        />
        <StatCard
          label="Top Referrer"
          value={
            <span className="text-lg truncate block">
              {leaderboard[0]?.householdName || "—"}
            </span>
          }
          sub={`${leaderboard[0]?.totalReferrals || 0} referrals sent`}
          icon={Trophy}
          valueClass="text-amber-600"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Referral Leaderboard</CardTitle>
          <p className="text-xs text-muted-foreground">
            Clients ranked by referrals sent
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {leaderboard.length === 0 ? (
            <div className="p-12 text-center">
              <Gift className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                No referrals tracked yet
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
                When you add a prospect with source "Referral" and link them to
                an existing client, they'll appear here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-center">Referrals</TableHead>
                  <TableHead className="text-center">Converted</TableHead>
                  <TableHead className="text-center">In Pipeline</TableHead>
                  <TableHead>Est. Value</TableHead>
                  <TableHead>Conversion</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, idx) => {
                  const household = householdMap.get(entry.householdId);
                  const isOpen = expanded.has(entry.householdId);
                  const pipelineValue = entry.prospects
                    .filter(
                      (p) =>
                        p.pipeline_stage !== "converted" &&
                        p.pipeline_stage !== "lost"
                    )
                    .reduce((s, p) => s + Number(p.estimated_aum || 0), 0);
                  const rate =
                    entry.totalReferrals > 0
                      ? Math.round(
                          (entry.converted / entry.totalReferrals) * 100
                        )
                      : 0;

                  return (
                    <>
                      <TableRow
                        key={entry.householdId}
                        className="cursor-pointer hover:bg-secondary/40"
                        onClick={() => toggleRow(entry.householdId)}
                      >
                        <TableCell className="font-medium text-base">
                          {rankBadge(idx)}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/household/${entry.householdId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-foreground hover:underline inline-flex items-center gap-1.5"
                          >
                            {entry.householdName}
                            {(household as any)?.is_prime_partner && (
                              <span className="text-amber-500">⭐</span>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-medium">
                            {entry.totalReferrals}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-medium",
                              entry.converted > 0
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {entry.converted}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-medium",
                              entry.pending > 0
                                ? "text-blue-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {entry.pending}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(pipelineValue)}
                        </TableCell>
                        <TableCell>
                          <span className={conversionColor(rate)}>{rate}%</span>
                        </TableCell>
                        <TableCell>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow
                          key={`${entry.householdId}-detail`}
                          className="bg-secondary/20 hover:bg-secondary/20"
                        >
                          <TableCell colSpan={8} className="p-0">
                            <div className="divide-y divide-border">
                              {entry.prospects.map((p) => {
                                const meta = stageMeta(p.pipeline_stage);
                                return (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-4 px-6 py-3"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm text-foreground">
                                        {p.first_name} {p.last_name}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Added{" "}
                                        {fmtFullDate(
                                          (p.created_at || "").slice(0, 10)
                                        )}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        "font-normal",
                                        (meta as any).color
                                      )}
                                    >
                                      {meta.label}
                                    </Badge>
                                    <div className="text-sm font-medium text-foreground w-24 text-right">
                                      {p.estimated_aum
                                        ? formatCurrency(
                                            Number(p.estimated_aum)
                                          )
                                        : "—"}
                                    </div>
                                    {p.pipeline_stage === "converted" &&
                                    p.converted_household_id ? (
                                      <Link
                                        to={`/household/${p.converted_household_id}`}
                                        className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                                      >
                                        → View Client
                                      </Link>
                                    ) : (
                                      <span className="w-[80px]" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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

// ---------- Page ----------
export default function Reports() {
  return (
    <div className="px-6 py-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Practice analytics and insights</p>
        </div>
      </div>

      <Tabs defaultValue="book">
        <TabsList>
          <TabsTrigger value="book">Book of Business</TabsTrigger>
          <TabsTrigger value="reviews">Review Status</TabsTrigger>
          <TabsTrigger value="activity">Activity & Tasks</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="mt-6">
          <BookOfBusinessTab />
        </TabsContent>
        <TabsContent value="reviews" className="mt-6">
          <ReviewStatusTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-6">
          <ActivityTasksTab />
        </TabsContent>
        <TabsContent value="referrals" className="mt-6">
          <ReferralsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
