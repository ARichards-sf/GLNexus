import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useSnapshots, useHouseholds, useGenerateSnapshot } from "@/hooks/useHouseholds";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
import { toast } from "sonner";

export default function Performance() {
  const { user } = useAuth();
  const { impersonatedUser } = useImpersonation();
  const { data: snapshots = [], isLoading } = useSnapshots();
  const { data: households = [] } = useHouseholds();
  const generateSnapshot = useGenerateSnapshot();

  const firstName =
    impersonatedUser?.name?.split(" ")[0] ||
    user?.user_metadata?.full_name?.split(" ")[0] ||
    "Advisor";

  // Chart data: last 30 days
  const chartData = useMemo(() => {
    const sorted = [...snapshots]
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      .slice(-30);
    return sorted.map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      aum: Number(s.total_aum),
      households: s.household_count,
    }));
  }, [snapshots]);

  // Growth comparison: this month vs last month
  const growth = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastDate = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;

    const thisMonthSnaps = snapshots.filter((s) => s.snapshot_date.startsWith(thisMonth));
    const lastMonthSnaps = snapshots.filter((s) => s.snapshot_date.startsWith(lastMonth));

    const latestThis = thisMonthSnaps.length
      ? thisMonthSnaps.reduce((a, b) => (a.snapshot_date > b.snapshot_date ? a : b))
      : null;
    const earliestThis = thisMonthSnaps.length
      ? thisMonthSnaps.reduce((a, b) => (a.snapshot_date < b.snapshot_date ? a : b))
      : null;
    const latestLast = lastMonthSnaps.length
      ? lastMonthSnaps.reduce((a, b) => (a.snapshot_date > b.snapshot_date ? a : b))
      : null;

    const currentAum = latestThis ? Number(latestThis.total_aum) : households.reduce((s, h) => s + Number(h.total_aum), 0);
    const prevAum = latestLast ? Number(latestLast.total_aum) : 0;
    const aumChange = currentAum - prevAum;
    const aumPct = prevAum > 0 ? (aumChange / prevAum) * 100 : 0;

    const currentHH = latestThis?.household_count ?? households.length;
    const prevHH = latestLast?.household_count ?? 0;
    const newHH = currentHH - prevHH;

    const avgRevPerHH = currentHH > 0 ? currentAum / currentHH : 0;

    return { currentAum, prevAum, aumChange, aumPct, currentHH, prevHH, newHH, avgRevPerHH };
  }, [snapshots, households]);

  const TrendIcon = growth.aumChange > 0 ? TrendingUp : growth.aumChange < 0 ? TrendingDown : Minus;
  const trendColor = growth.aumChange > 0 ? "text-emerald" : growth.aumChange < 0 ? "text-destructive" : "text-muted-foreground";

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="h-80 bg-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Performance
          </h1>
          <p className="text-muted-foreground mt-1">
            {impersonatedUser
              ? `Viewing ${impersonatedUser.name}'s performance`
              : `${firstName}'s business trends and growth metrics.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            generateSnapshot.mutate(undefined, {
              onSuccess: (data) =>
                toast.success(
                  `Snapshot saved — ${formatCurrency(data.total_aum)} AUM, ${data.household_count} households.`
                ),
              onError: () => toast.error("Failed to generate snapshot."),
            })
          }
          disabled={generateSnapshot.isPending}
        >
          <Camera className="w-4 h-4 mr-1.5" />
          {generateSnapshot.isPending ? "Saving…" : "Generate Snapshot"}
        </Button>
      </div>

      {/* AUM Trend Chart */}
      <Card className="border-border shadow-none mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Total AUM — Last 30 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              No snapshot data yet. Click "Generate Snapshot" to start tracking.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => [formatFullCurrency(value), "AUM"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="aum"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Growth Table */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Month-over-Month Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Metric</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Last Month</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">This Month</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-medium text-foreground">Total AUM</td>
                  <td className="py-3 px-4 text-right text-foreground font-mono">
                    {growth.prevAum > 0 ? formatFullCurrency(growth.prevAum) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-foreground font-mono">
                    {formatFullCurrency(growth.currentAum)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {growth.prevAum > 0 ? (
                      <span className={`inline-flex items-center gap-1 font-medium ${trendColor}`}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        {growth.aumPct >= 0 ? "+" : ""}
                        {growth.aumPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 font-medium text-foreground">Households</td>
                  <td className="py-3 px-4 text-right text-foreground font-mono">
                    {growth.prevHH > 0 ? growth.prevHH : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-foreground font-mono">
                    {growth.currentHH}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {growth.prevHH > 0 ? (
                      <span
                        className={`font-medium ${
                          growth.newHH > 0
                            ? "text-emerald"
                            : growth.newHH < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {growth.newHH > 0 ? "+" : ""}
                        {growth.newHH}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-foreground">Avg AUM per Household</td>
                  <td className="py-3 px-4 text-right text-muted-foreground font-mono">—</td>
                  <td className="py-3 px-4 text-right text-foreground font-mono">
                    {growth.currentHH > 0 ? formatFullCurrency(growth.avgRevPerHH) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
