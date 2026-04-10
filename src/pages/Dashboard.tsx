import { useState } from "react";
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
  CalendarDays,
  HelpCircle,
} from "lucide-react";
import { useHouseholds, useAllComplianceNotes, useGenerateSnapshot } from "@/hooks/useHouseholds";
import { useUpcomingEvents, EVENT_TYPE_COLORS } from "@/hooks/useCalendarEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
import { toast } from "sonner";
import RequestAssistanceDialog from "@/components/RequestAssistanceDialog";

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
  const { data: upcomingEvents = [] } = useUpcomingEvents(5);
  const generateSnapshot = useGenerateSnapshot();
  const [assistOpen, setAssistOpen] = useState(false);

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Good morning, {firstName}</h1>
          <p className="text-muted-foreground mt-1">Here's your practice overview for today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAssistOpen(true)}>
            <HelpCircle className="w-4 h-4 mr-1.5" />
            Request GL Assistance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              generateSnapshot.mutate(undefined, {
                onSuccess: (data) => toast.success(`Snapshot saved — ${formatCurrency(data.total_aum)} AUM, ${data.household_count} households.`),
                onError: () => toast.error("Failed to generate snapshot."),
              })
            }
            disabled={generateSnapshot.isPending}
          >
            <Camera className="w-4 h-4 mr-1.5" />
            {generateSnapshot.isPending ? "Saving…" : "Generate Snapshot"}
          </Button>
        </div>
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
        {/* Upcoming Meetings */}
        <Card className="lg:col-span-2 border-border shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Upcoming Meetings</CardTitle>
              <Link to="/calendar">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  View Calendar <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.map((ev) => {
              const colors = EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS["Discovery Call"];
              return (
                <Link
                  key={ev.id}
                  to="/calendar"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors group"
                >
                  <div className={`w-2 h-8 rounded-full shrink-0 ${colors.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
              );
            })}
            {upcomingEvents.length === 0 && (
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
