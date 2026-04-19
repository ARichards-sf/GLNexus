import { useEffect, useRef, useState } from "react";
import { Sunrise, Sun, Sunset, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { streamChat } from "@/lib/aiChat";
import { formatCurrency } from "@/data/sampleData";

type BriefingPeriod = "morning" | "afternoon" | "eod";

function getCurrentPeriod(): BriefingPeriod {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 16) return "afternoon";
  return "eod";
}

const PERIODS = {
  morning: {
    label: "Good morning briefing",
    timeLabel: "Morning",
    Icon: Sunrise,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    cardBorder: "border-amber-200/70 dark:border-amber-700/40",
    cardBg: "bg-amber-50/20 dark:bg-amber-950/10",
    footer: "Ask Goodie to dive deeper into any of these items",
  },
  afternoon: {
    label: "Midday check-in",
    timeLabel: "Afternoon",
    Icon: Sun,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    cardBorder: "border-orange-200/70 dark:border-orange-700/40",
    cardBg: "bg-orange-50/20 dark:bg-orange-950/10",
    footer: "Ask Goodie how your afternoon is shaping up",
  },
  eod: {
    label: "End of day wrap-up",
    timeLabel: "End of Day",
    Icon: Sunset,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    cardBorder: "border-indigo-200/70 dark:border-indigo-700/40",
    cardBg: "bg-indigo-50/20 dark:bg-indigo-950/10",
    footer: "Ask Goodie to help you prep for tomorrow",
  },
} as const;

const getCacheKey = (period: BriefingPeriod, userId: string) =>
  `goodie_brief_${period}_${userId}_${new Date().toISOString().split("T")[0]}_v2`;

interface BriefingCache {
  date: string;
  period: BriefingPeriod;
  text: string;
  minimized: boolean;
}

interface MorningBriefingProps {
  households: any[];
  recentNotes: any[];
  upcomingEvents: any[];
  pendingTasks: any[];
  firstName: string;
  userId: string;
  accentColor?: string;
  prospects?: any[];
}

interface PromptData {
  firstName: string;
  todayFormatted: string;
  todaysMeetings: any[];
  pastMeetings: any[];
  remainingMeetings: any[];
  overdueTasks: any[];
  dueTodayTasks: any[];
  completedTodayTasks: any[];
  pendingTodayTasks: any[];
  overdueReviews: any[];
  totalAUM: number;
  householdCount: number;
  onboardingCount: number;
  activeCount: number;
  recentNotes: any[];
  tomorrowsMeetings: any[];
  activeProspects: any[];
  hotProspects: any[];
  pipelineValue: number;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function buildPrompt(period: BriefingPeriod, d: PromptData): string {
  const meetingsList = (arr: any[]) =>
    arr.length === 0
      ? "None"
      : arr
          .map((e) => `${e.title} at ${fmtTime(e.start_time)} with ${e.households?.name || "client"}`)
          .join(", ");

  const tasksList = (arr: any[]) =>
    arr.length === 0
      ? "None"
      : arr.map((t) => `"${t.title}"${t.households?.name ? ` (${t.households.name})` : ""}`).join(", ");

  const pipelineText = (active: any[], hot: any[], value: number) => {
    if (active.length === 0) return "No active prospects";
    const valueStr = value > 0 ? ` · $${(value / 1000000).toFixed(1)}M estimated` : "";
    const hotStr =
      hot.length > 0
        ? `. Action needed: ${hot
            .map((p: any) => `${p.first_name} ${p.last_name} (${p.pipeline_stage.replace(/_/g, " ")})`)
            .join(", ")}`
        : "";
    return `${active.length} active prospects${valueStr}${hotStr}`;
  };

  if (period === "morning") {
    return `Today is ${d.todayFormatted}.

Generate a concise MORNING briefing for this financial advisor in two parts:

PART 1 — Write a 2-3 sentence narrative paragraph. Lead with the most important thing the advisor should focus on today. Be specific — use actual client names, meeting times, and task details. Write in a warm, direct tone as Goodie the AI assistant. Open with "Good morning ${d.firstName}".

PART 2 — After the narrative, add a line break then write "KEY ITEMS:" followed by bullet points (use • not -) covering:
- Each meeting today with time and client name
- Any overdue tasks by name
- Any tasks due today by name
- Any households with overdue annual reviews
- One proactive suggestion based on the data — this could reference a prospect ready to advance, a referral opportunity, or a client action needed

Keep the entire briefing under 150 words.
Be direct and advisor-focused.
Do not mention that you are an AI.

DATA:
Today's meetings: ${meetingsList(d.todaysMeetings)}
Tasks overdue: ${tasksList(d.overdueTasks)}
Tasks due today: ${tasksList(d.dueTodayTasks)}
Overdue annual reviews: ${d.overdueReviews.length === 0 ? "None" : d.overdueReviews.map((h) => h.name).join(", ")}
Total AUM: ${formatCurrency(d.totalAUM)}
Active households: ${d.activeCount} of ${d.householdCount}
Onboarding: ${d.onboardingCount} household(s) in onboarding
Pipeline: ${pipelineText(d.activeProspects, d.hotProspects, d.pipelineValue)}
Recent activity: ${d.recentNotes.slice(0, 3).map((n) => `${n.type} for ${n.households?.name || "household"} on ${n.date}`).join(", ") || "None"}`;
  }

  if (period === "afternoon") {
    return `It is midday on ${d.todayFormatted}.

Generate a concise AFTERNOON check-in for this advisor in two parts:

PART 1 — Write 2-3 sentences summarizing the morning and what still needs attention this afternoon. Be specific with names. Open with "Good afternoon ${d.firstName}".

PART 2 — After the narrative, add a line break then write "KEY ITEMS:" followed by bullet points (use • not -) covering:
- Remaining meetings today with time and client name
- Tasks completed this morning (acknowledge progress)
- Still-pending tasks due today
- Any overdue items needing attention
- One afternoon focus suggestion

Keep under 150 words. Direct and advisor-focused. Do not mention that you are an AI.

DATA:
Remaining meetings today: ${meetingsList(d.remainingMeetings)}
Meetings already completed today: ${meetingsList(d.pastMeetings)}
Tasks completed today: ${tasksList(d.completedTodayTasks)}
Tasks still pending today: ${tasksList(d.pendingTodayTasks)}
Overdue tasks: ${tasksList(d.overdueTasks)}
Pipeline: ${pipelineText(d.activeProspects, d.hotProspects, d.pipelineValue)}`;
  }

  // eod
  return `It is end of day on ${d.todayFormatted}.

Generate a concise END OF DAY wrap-up for this advisor in two parts:

PART 1 — Write 2-3 sentences recapping the day and setting up tomorrow. Be specific. Open with "Good evening ${d.firstName}".

PART 2 — After the narrative, add a line break then write "KEY ITEMS:" followed by bullet points (use • not -) covering:
- What was accomplished today (meetings held, tasks completed)
- Outstanding items carrying to tomorrow
- Overdue tasks needing attention
- One thing to prepare for tomorrow
- An encouraging close

Keep under 150 words. Direct and advisor-focused. Do not mention that you are an AI.

DATA:
Meetings today: ${meetingsList(d.todaysMeetings)}
Tasks completed today: ${tasksList(d.completedTodayTasks)}
Outstanding tasks: ${tasksList([...d.pendingTodayTasks, ...d.overdueTasks])}
Upcoming tomorrow: ${meetingsList(d.tomorrowsMeetings)}
Active pipeline: ${pipelineText(d.activeProspects, d.hotProspects, d.pipelineValue)}`;
}

export default function MorningBriefing({
  households,
  recentNotes,
  upcomingEvents,
  pendingTasks,
  firstName,
  userId,
  accentColor,
}: MorningBriefingProps) {
  const currentPeriod = getCurrentPeriod();
  const periodConfig = PERIODS[currentPeriod];
  const cacheKey = getCacheKey(currentPeriod, userId);
  const today = new Date().toISOString().split("T")[0];

  const initialCache: BriefingCache | null = (() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed: BriefingCache = JSON.parse(raw);
      return parsed?.date === today && parsed?.period === currentPeriod ? parsed : null;
    } catch {
      return null;
    }
  })();

  const [text, setText] = useState(initialCache?.text ?? "");
  const [isGenerating, setIsGenerating] = useState(!initialCache);
  const [minimized, setMinimized] = useState(initialCache?.minimized ?? false);
  const [dismissed, setDismissed] = useState(false);
  const hasGeneratedRef = useRef(!!initialCache);

  // Clean up legacy cache keys
  useEffect(() => {
    try {
      localStorage.removeItem("goodie_morning_briefing");
      localStorage.removeItem(`goodie_morning_briefing_${userId}`);
      localStorage.removeItem(`goodie_morning_briefing_${userId}_v2`);
    } catch {
      /* ignore */
    }
  }, [userId]);

  // Persist minimized state
  useEffect(() => {
    if (!text) return;
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ date: today, period: currentPeriod, text, minimized })
      );
    } catch {
      // ignore
    }
  }, [minimized, text, today, cacheKey, currentPeriod]);

  // Generate briefing once if no cache
  useEffect(() => {
    if (hasGeneratedRef.current) return;
    if (households.length === 0 && pendingTasks.length === 0 && upcomingEvents.length === 0) {
      return;
    }
    hasGeneratedRef.current = true;

    const now = new Date();
    const todayStr = now.toDateString();
    const todayFormatted = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const todaysMeetings = upcomingEvents.filter(
      (e) => new Date(e.start_time).toDateString() === todayStr
    );
    const pastMeetings = upcomingEvents.filter((e) => {
      const d = new Date(e.start_time);
      return d.toDateString() === todayStr && d < now;
    });
    const remainingMeetings = upcomingEvents.filter((e) => {
      const d = new Date(e.start_time);
      return d.toDateString() === todayStr && d >= now;
    });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();
    const tomorrowsMeetings = upcomingEvents.filter(
      (e) => new Date(e.start_time).toDateString() === tomorrowStr
    );

    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);

    const overdueTasks = pendingTasks.filter((t) => {
      if (!t.due_date || t.status === "done") return false;
      return new Date(t.due_date + "T00:00:00") < today0;
    });

    const dueTodayTasks = pendingTasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date + "T00:00:00");
      return d.getTime() === today0.getTime();
    });

    const pendingTodayTasks = dueTodayTasks.filter((t) => t.status !== "done");

    const completedTodayTasks = pendingTasks.filter((t) => {
      if (t.status !== "done" || !t.completed_at) return false;
      return new Date(t.completed_at).toDateString() === todayStr;
    });

    const overdueReviews = households.filter(
      (h) => h.annual_review_date && new Date(h.annual_review_date) < now
    );

    const totalAUM = households.reduce((s, h) => s + Number(h.total_aum || 0), 0);
    const activeCount = households.filter(
      (h) => h.status === "Active" || h.status === "Review Scheduled"
    ).length;
    const onboardingCount = households.filter((h) => h.status === "Onboarding").length;

    const prompt = buildPrompt(currentPeriod, {
      firstName,
      todayFormatted,
      todaysMeetings,
      pastMeetings,
      remainingMeetings,
      overdueTasks,
      dueTodayTasks,
      completedTodayTasks,
      pendingTodayTasks,
      overdueReviews,
      totalAUM,
      householdCount: households.length,
      onboardingCount,
      activeCount,
      recentNotes,
      tomorrowsMeetings,
    });

    setIsGenerating(true);
    setText("");

    streamChat({
      messages: [{ role: "user", content: prompt }],
      context: "",
      onDelta: (chunk) => {
        setText((prev) => {
          const next = prev + chunk;
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({ date: today, period: currentPeriod, text: next, minimized: false })
            );
          } catch {
            // ignore
          }
          return next;
        });
      },
      onToolCalls: () => {},
      onDone: () => setIsGenerating(false),
      onError: () => setIsGenerating(false),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households, pendingTasks, upcomingEvents, recentNotes, firstName, currentPeriod]);

  if (dismissed) return null;

  const parts = text.split("KEY ITEMS:");
  const narrative = parts[0]?.trim() ?? "";
  const bulletSection = parts[1]?.trim();
  const PeriodIcon = periodConfig.Icon;

  return (
    <Card
      className={`mb-6 shadow-none ${periodConfig.cardBorder} ${periodConfig.cardBg}`}
      style={{ borderColor: accentColor ? `${accentColor}60` : undefined }}
    >
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${periodConfig.bgColor}`}
            >
              <PeriodIcon className={`w-4 h-4 ${periodConfig.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{periodConfig.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                · {periodConfig.timeLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setMinimized(!minimized)}
              title={minimized ? "Expand briefing" : "Minimize briefing"}
            >
              {minimized ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDismissed(true)}
              title="Dismiss for today"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {minimized && narrative && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {narrative.split(".")[0]}...
          </p>
        )}

        {!minimized && (
          <div>
            {isGenerating && !text ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {narrative}
                </p>

                {bulletSection && (
                  <ul className="space-y-1.5">
                    {bulletSection
                      .split("•")
                      .filter((b) => b.trim())
                      .map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className={`mt-0.5 shrink-0 ${periodConfig.color}`}>•</span>
                          <span className="text-foreground/85 leading-relaxed">
                            {bullet.trim()}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}

                {!isGenerating && text && (
                  <div className="pt-2 mt-2 border-t border-border/60">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Sparkles className={`w-3 h-3 ${periodConfig.color}`} />
                      {periodConfig.footer}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
