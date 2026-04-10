import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  CalendarCheck,
  Users,
  ArrowUpRight,
  Clock,
  FileText,
  Phone,
  ArrowRight,
  Camera,
} from "lucide-react";
import { useHouseholds, useAllComplianceNotes, useGenerateSnapshot } from "@/hooks/useHouseholds";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
import { toast } from "sonner";

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

export default function Dashboard() {
  const { user } = useAuth();
  const { impersonatedUser } = useImpersonation();
  const { data: households = [], isLoading } = useHouseholds();
  const { data: recentNotes = [] } = useAllComplianceNotes();
  const generateSnapshot = useGenerateSnapshot();

  const totalAUM = households.reduce((sum, h) => sum + Number(h.total_aum), 0);
  const totalHouseholds = households.length;
  const activeHouseholds = households.filter((h) => h.status === "Active").length;

  const upcomingReviews = households
    .filter((h) => {
      if (!h.annual_review_date) return false;
      const d = new Date(h.annual_review_date);
      const now = new Date();
      const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 60;
    })
    .sort((a, b) => new Date(a.annual_review_date!).getTime() - new Date(b.annual_review_date!).getTime());

  const firstName = impersonatedUser?.name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "Advisor";

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-secondary rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Good morning, {firstName}</h1>
        <p className="text-muted-foreground mt-1">Here's your practice overview for today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">Total Book of Business</span>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{formatCurrency(totalAUM)}</p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald" />
              <span className="text-xs font-medium text-emerald">+3.2% QTD</span>
            </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upcoming Reviews */}
        <Card className="lg:col-span-2 border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Annual Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingReviews.map((h) => (
              <Link
                key={h.id}
                to={`/household/${h.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/60 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(Number(h.total_aum))} AUM</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs font-medium text-foreground">
                      {new Date(h.annual_review_date!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
            {upcomingReviews.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No upcoming reviews</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-3 border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentNotes.map((note: any) => {
                const Icon = noteTypeIcons[note.type] || FileText;
                return (
                  <div key={note.id} className="flex gap-3">
                    <div className="mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/household/${note.household_id}`} className="text-sm font-medium text-foreground hover:underline">
                          {note.households?.name || "Household"}
                        </Link>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${noteTypeColors[note.type] || ""}`}>
                          {note.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{note.summary}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(note.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {recentNotes.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
