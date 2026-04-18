import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  TicketCheck,
  CheckSquare,
  Plus,
} from "lucide-react";
import CreateHouseholdDialog from "@/components/CreateHouseholdDialog";
import QuickLogNoteDialog from "@/components/QuickLogNoteDialog";
import { useInSession } from "@/contexts/InSessionContext";
import { useQueryClient } from "@tanstack/react-query";
import { useHouseholds, useAllComplianceNotes, useGenerateSnapshot } from "@/hooks/useHouseholds";
import { useUpcomingEvents, EVENT_TYPE_COLORS } from "@/hooks/useCalendarEvents";
import { useMyServiceRequests } from "@/hooks/useServiceRequests";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
import { toast } from "sonner";
import RequestAssistanceDialog from "@/components/RequestAssistanceDialog";
import GoodieSuggests from "@/components/GoodieSuggests";
import MorningBriefing from "@/components/MorningBriefing";
import { useTasks } from "@/hooks/useTasks";

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
  const { data: upcomingEvents = [] } = useUpcomingEvents(20);
  const { data: myRequests = [] } = useMyServiceRequests();
  const { data: myTasks = [] } = useTasks("mine");
  const generateSnapshot = useGenerateSnapshot();
  const [assistOpen, setAssistOpen] = useState(false);
  const [createHouseholdOpen, setCreateHouseholdOpen] = useState(false);
  const [logNoteOpen, setLogNoteOpen] = useState(false);
  const { startSession } = useInSession();

  const openRequests = useMemo(() => {
    return myRequests.filter(r => r.status !== "resolved" && r.status !== "closed");
  }, [myRequests]);

  const pendingTasks = useMemo(() => {
    return myTasks.filter(t => t.status === "todo").slice(0, 3);
  }, [myTasks]);

  const imminentMeeting = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 60 * 60 * 1000;
    return upcomingEvents.find((ev) => {
      const t = new Date(ev.start_time).getTime();
      return t >= now && t <= cutoff;
    }) ?? null;
  }, [upcomingEvents]);

  const minutesUntilMeeting = imminentMeeting
    ? Math.max(0, Math.round((new Date(imminentMeeting.start_time).getTime() - Date.now()) / 60000))
    : 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      <div className="p-6 lg:p-10">
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
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Good morning, {firstName}</h1>
        <p className="text-muted-foreground mt-1">Here's your practice overview for today.</p>
      </div>

      {/* Quick Actions bar */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/40 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setLogNoteOpen(true)}>
            <FileText className="w-4 h-4 mr-1.5" />
            Log a Note
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/calendar")}>
            <CalendarDays className="w-4 h-4 mr-1.5" />
            Schedule Meeting
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreateHouseholdOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Household
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssistOpen(true)}>
            <HelpCircle className="w-4 h-4 mr-1.5" />
            Request GL Assistance
          </Button>
        </div>
        {openRequests.length > 0 && (
          <Link
            to="/my-requests"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 transition-colors shrink-0"
          >
            <TicketCheck className="w-3.5 h-3.5" />
            {openRequests.length} open {openRequests.length === 1 ? "request" : "requests"}
          </Link>
        )}
      </div>

      <MorningBriefing
        households={households}
        recentNotes={recentNotes as any}
        upcomingEvents={upcomingEvents as any}
        pendingTasks={myTasks as any}
        firstName={firstName}
      />

      {/* Your Next Meeting — only when within 60 minutes */}
      {imminentMeeting && (
        <Card className="mb-6 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/10 shadow-none">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                    Starting Soon
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {imminentMeeting.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {imminentMeeting.households?.name || "No household linked"}
                    {" · "}
                    {minutesUntilMeeting === 0
                      ? "Starting now"
                      : `In ${minutesUntilMeeting} ${minutesUntilMeeting === 1 ? "minute" : "minutes"}`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => imminentMeeting && startSession(imminentMeeting)}
                disabled={!imminentMeeting.household_id}
              >
                Start Session
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Tasks */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
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
              {pendingTasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckSquare className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">You're all caught up</p>
                </div>
              ) : (
                pendingTasks.map((t) => {
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
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {t.households.name}
                          </p>
                        )}
                      </div>
                      {t.due_date && (
                        <span
                          className={`text-[11px] shrink-0 ${
                            isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
                          }`}
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

          {/* Upcoming Meetings */}
          <Card className="border-border shadow-none">
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
        </div>

        <div className="lg:col-span-1">
          <GoodieSuggests households={households} recentNotes={recentNotes as any} />
        </div>
      </div>

      <RequestAssistanceDialog open={assistOpen} onOpenChange={setAssistOpen} />
      <QuickLogNoteDialog open={logNoteOpen} onOpenChange={setLogNoteOpen} />
      <CreateHouseholdDialog
        open={createHouseholdOpen}
        onOpenChange={(open) => {
          setCreateHouseholdOpen(open);
          if (!open) queryClient.invalidateQueries({ queryKey: ["households"] });
        }}
      />
    </div>
  );
}
