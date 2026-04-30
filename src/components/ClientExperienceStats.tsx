import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  householdId: string;
}

interface TouchpointLite {
  id: string;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
}

const startOfYear = () => {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatRelativeDate = (iso: string): string => {
  const target = new Date(iso + "T00:00:00");
  const today = startOfToday();
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 0 && days <= 7) return `In ${days} days`;
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Header strip for the Client Experience tab — surfaces the four numbers an
 * advisor cares about at a glance: how many touchpoints are planned this
 * year, how many are done, what's overdue, and when the next one lands.
 *
 * Reuses the same query key as TouchpointTimeline so the request is shared
 * via the react-query cache.
 */
export default function ClientExperienceStats({ householdId }: Props) {
  // Stats only need a few fields, but we MUST share the cache entry with
  // TouchpointTimeline so a single fetch + invalidate updates both. Use a
  // distinct key here (the timeline does the canonical fetch + join) and
  // run a lean query for our own computation. Different keys → no cache
  // collision; both refetch independently on invalidation.
  const { data: touchpoints = [] } = useQuery({
    queryKey: ["touchpoint_stats", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("touchpoints")
        .select("id, status, scheduled_date, completed_date")
        .eq("household_id", householdId)
        .order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as TouchpointLite[];
    },
    enabled: !!householdId,
  });

  const stats = useMemo(() => {
    const yearStart = startOfYear();
    const today = startOfToday();

    let plannedThisYear = 0;
    let completedYtd = 0;
    let overdue = 0;
    let nextDate: string | null = null;

    for (const tp of touchpoints) {
      const sched = new Date(tp.scheduled_date + "T00:00:00");
      const inThisYear = sched >= yearStart;

      if (inThisYear) plannedThisYear++;

      if (tp.status === "completed" && inThisYear) {
        completedYtd++;
      }

      if (tp.status === "upcoming") {
        if (sched < today) {
          overdue++;
        } else if (!nextDate || tp.scheduled_date < nextDate) {
          nextDate = tp.scheduled_date;
        }
      }
    }

    return { plannedThisYear, completedYtd, overdue, nextDate };
  }, [touchpoints]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <StatTile
        icon={<CalendarCheck className="w-4 h-4" />}
        label="Planned this year"
        value={String(stats.plannedThisYear)}
      />
      <StatTile
        icon={<CheckCircle2 className="w-4 h-4 text-emerald" />}
        label="Completed YTD"
        value={String(stats.completedYtd)}
        sub={
          stats.plannedThisYear > 0
            ? `${Math.round((stats.completedYtd / stats.plannedThisYear) * 100)}% of plan`
            : undefined
        }
      />
      <StatTile
        icon={
          <AlertCircle
            className={cn("w-4 h-4", stats.overdue > 0 ? "text-destructive" : "text-muted-foreground")}
          />
        }
        label="Overdue"
        value={String(stats.overdue)}
        emphasize={stats.overdue > 0}
      />
      <StatTile
        icon={<ArrowRight className="w-4 h-4 text-muted-foreground" />}
        label="Next touch"
        value={stats.nextDate ? formatRelativeDate(stats.nextDate) : "—"}
        sub={
          stats.nextDate
            ? new Date(stats.nextDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })
            : "Nothing scheduled"
        }
      />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  emphasize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  emphasize?: boolean;
}) {
  return (
    <Card className="border-border shadow-none">
      <CardContent className="pt-4 pb-3 space-y-0.5">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            emphasize ? "text-destructive" : "text-foreground",
          )}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
