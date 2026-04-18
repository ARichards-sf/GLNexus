import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { streamChat } from "@/lib/aiChat";
import { formatCurrency } from "@/data/sampleData";

interface BriefingCache {
  date: string;
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
}

export default function MorningBriefing({
  households,
  recentNotes,
  upcomingEvents,
  pendingTasks,
  firstName,
  userId,
}: MorningBriefingProps) {
  const STORAGE_KEY = `goodie_morning_briefing_${userId}`;
  const today = new Date().toISOString().split("T")[0];

  const initialCache: BriefingCache | null = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: BriefingCache = JSON.parse(raw);
      return parsed?.date === today ? parsed : null;
    } catch {
      return null;
    }
  })();

  const [text, setText] = useState(initialCache?.text ?? "");
  const [isGenerating, setIsGenerating] = useState(!initialCache);
  const [minimized, setMinimized] = useState(initialCache?.minimized ?? false);
  const [dismissed, setDismissed] = useState(false);
  const hasGeneratedRef = useRef(!!initialCache);

  // Clean up old non-scoped cache on mount
  useEffect(() => {
    try {
      localStorage.removeItem("goodie_morning_briefing");
    } catch { /* ignore */ }
  }, []);

  // Persist minimized state
  useEffect(() => {
    if (!text) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: today, text, minimized })
      );
    } catch {
      // ignore quota errors
    }
  }, [minimized, text, today, STORAGE_KEY]);

  // Generate briefing once if no cache
  useEffect(() => {
    if (hasGeneratedRef.current) return;
    if (households.length === 0 && pendingTasks.length === 0 && upcomingEvents.length === 0) {
      // wait for data
      return;
    }
    hasGeneratedRef.current = true;

    const todayFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const todaysMeetings = upcomingEvents.filter((e) => {
      const d = new Date(e.start_time);
      return d.toDateString() === new Date().toDateString();
    });

    const overdueTasks = pendingTasks.filter((t) => {
      if (!t.due_date || t.status === "done") return false;
      return new Date(t.due_date + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0));
    });

    const dueTodayTasks = pendingTasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date + "T00:00:00");
      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);
      return d.getTime() === today0.getTime();
    });

    const overdueReviews = households.filter((h) => {
      if (!h.annual_review_date) return false;
      return new Date(h.annual_review_date) < new Date();
    });

    const totalAUM = households.reduce((s, h) => s + Number(h.total_aum || 0), 0);
    const activeCount = households.filter((h) => h.status === "Active").length;

    const prompt = `Today is ${todayFormatted}.

Generate a concise morning briefing for this financial advisor in two parts:

PART 1 — Write a 2-3 sentence narrative paragraph. Lead with the most important thing the advisor should focus on today. Be specific — use actual client names, meeting times, and task details from the data below. Write in a warm, direct tone as Goodie the AI assistant. Open with "Good morning ${firstName}".

PART 2 — After the narrative, add a line break then write "KEY ITEMS:" followed by bullet points (use • not -) covering:
- Each meeting today with time and client name
- Any overdue tasks by name
- Any tasks due today by name
- Any households with overdue annual reviews
- One proactive suggestion based on the data

Keep the entire briefing under 150 words.
Be direct and advisor-focused.
Do not mention that you are an AI.

DATA:
Today's meetings: ${
      todaysMeetings.length === 0
        ? "None scheduled"
        : todaysMeetings
            .map(
              (e) =>
                `${e.title} at ${new Date(e.start_time).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })} with ${e.households?.name || "client"}`
            )
            .join(", ")
    }

Tasks overdue: ${
      overdueTasks.length === 0
        ? "None"
        : overdueTasks
            .map((t) => `"${t.title}"${t.households?.name ? ` (${t.households.name})` : ""}`)
            .join(", ")
    }

Tasks due today: ${
      dueTodayTasks.length === 0
        ? "None"
        : dueTodayTasks.map((t) => `"${t.title}"`).join(", ")
    }

Overdue annual reviews: ${
      overdueReviews.length === 0 ? "None" : overdueReviews.map((h) => h.name).join(", ")
    }

Total AUM: ${formatCurrency(totalAUM)}

Active households: ${activeCount} of ${households.length}

Recent activity: ${
      recentNotes
        .slice(0, 3)
        .map((n) => `${n.type} for ${n.households?.name || "household"} on ${n.date}`)
        .join(", ") || "None"
    }`;

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
              STORAGE_KEY,
              JSON.stringify({ date: today, text: next, minimized: false })
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
  }, [households, pendingTasks, upcomingEvents, recentNotes, firstName]);

  if (dismissed) return null;

  const parts = text.split("KEY ITEMS:");
  const narrative = parts[0]?.trim() ?? "";
  const bulletSection = parts[1]?.trim();

  return (
    <Card className="mb-6 border-border shadow-none bg-gradient-to-br from-primary/[0.03] via-background to-background">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Good morning briefing</p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
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
                          <span className="text-primary mt-0.5 shrink-0">•</span>
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
                      <Sparkles className="w-3 h-3 text-primary" />
                      Ask Goodie to dive deeper into any of these items
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
