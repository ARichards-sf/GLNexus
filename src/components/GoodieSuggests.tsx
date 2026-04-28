import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, CalendarCheck, FileText, MessageCircle, Sparkles, X, type LucideIcon } from "lucide-react";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";
import QuickLogNoteDialog from "@/components/QuickLogNoteDialog";
import type { HouseholdRow } from "@/hooks/useHouseholds";

type ActionKind = "schedule" | "households" | "logNote";

interface NoteLite {
  household_id: string;
  date: string;
}

interface ScheduleSuggestion {
  id: "s-schedule";
  action: "schedule";
  household: HouseholdRow;
  text: string;
  context: string;
  icon: LucideIcon;
  iconClass: string;
}

interface HouseholdsSuggestion {
  id: "s-households";
  action: "households";
  text: string;
  context: string;
  icon: LucideIcon;
  iconClass: string;
}

interface LogNoteSuggestion {
  id: "s-lognote";
  action: "logNote";
  household: HouseholdRow;
  text: string;
  context: string;
  icon: LucideIcon;
  iconClass: string;
}

type Suggestion = ScheduleSuggestion | HouseholdsSuggestion | LogNoteSuggestion;

interface Props {
  households: HouseholdRow[];
  recentNotes?: NoteLite[] | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

export default function GoodieSuggests({ households, recentNotes }: Props) {
  const notes = recentNotes ?? [];
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [logNoteOpen, setLogNoteOpen] = useState(false);
  const [scheduleCtx, setScheduleCtx] = useState<{ id?: string; name?: string; title?: string }>({});
  const [logNoteCtx, setLogNoteCtx] = useState<{ id?: string; name?: string }>({});

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const now = new Date();

    // --- Suggestion 1: Most urgent annual review ---
    const withReview = households.filter((h) => !!h.annual_review_date);
    if (withReview.length > 0) {
      // Sort by absolute distance from today (overdue + soonest upcoming both bubble up)
      const sorted = [...withReview].sort((a, b) => {
        const da = Math.abs(new Date(a.annual_review_date!).getTime() - now.getTime());
        const db = Math.abs(new Date(b.annual_review_date!).getTime() - now.getTime());
        return da - db;
      });
      const top = sorted[0];
      out.push({
        id: "s-schedule",
        action: "schedule",
        household: top,
        text: `Schedule annual review for ${top.name}`,
        context: `Review due ${formatDate(top.annual_review_date!)}`,
        icon: CalendarCheck,
        iconClass: "bg-amber-muted text-amber",
      });
    }

    // --- Suggestion 2: Reviews due in next 60 days ---
    const upcoming = households.filter((h) => {
      if (!h.annual_review_date) return false;
      const diff = daysBetween(new Date(h.annual_review_date), now);
      return diff >= 0 && diff <= 60;
    });
    if (upcoming.length > 0) {
      const sample = upcoming.slice(0, 3).map((h) => h.name).join(", ");
      out.push({
        id: "s-households",
        action: "households",
        text: `${upcoming.length} household${upcoming.length === 1 ? "" : "s"} have reviews due in 60 days`,
        context: sample,
        icon: FileText,
        iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      });
    }

    // --- Suggestion 3: Least recently contacted ---
    if (households.length > 0) {
      // Build map of household_id -> most recent note date
      const lastNoteByHh = new Map<string, Date>();
      for (const n of notes) {
        const d = new Date(n.date);
        const existing = lastNoteByHh.get(n.household_id);
        if (!existing || d > existing) lastNoteByHh.set(n.household_id, d);
      }

      // Find a household with no notes first; otherwise the one with the oldest most-recent note
      const noNote = households.find((h) => !lastNoteByHh.has(h.id));
      let target: HouseholdRow | null = null;
      let contextText = "";

      if (noNote) {
        target = noNote;
        contextText = "No notes found";
      } else {
        const sorted = [...households].sort((a, b) => {
          const da = lastNoteByHh.get(a.id)!.getTime();
          const db = lastNoteByHh.get(b.id)!.getTime();
          return da - db; // oldest first
        });
        const oldest = sorted[0];
        const daysSince = daysBetween(now, lastNoteByHh.get(oldest.id)!);
        if (daysSince > 30) {
          target = oldest;
          contextText = `Last contact was ${daysSince} days ago`;
        }
      }

      if (target) {
        out.push({
          id: "s-lognote",
          action: "logNote",
          household: target,
          text: `Log a follow-up for ${target.name}`,
          context: contextText,
          icon: MessageCircle,
          iconClass: "bg-emerald-muted text-emerald",
        });
      }
    }

    return out;
  }, [households, notes]);

  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  const handleAction = (s: Suggestion) => {
    if (s.action === "schedule") {
      setScheduleCtx({
        id: s.household.id,
        name: s.household.name,
        title: `Annual Review — ${s.household.name}`,
      });
      setScheduleOpen(true);
    } else if (s.action === "households") {
      navigate("/households");
    } else if (s.action === "logNote") {
      setLogNoteCtx({ id: s.household.id, name: s.household.name });
      setLogNoteOpen(true);
    }
  };

  const dismiss = (id: string) =>
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  if (visible.length === 0) return null;

  return (
    <>
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-60" />
              <Bot className="w-3.5 h-3.5 text-primary relative" />
            </span>
            Goodie Suggests
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-0.5">
            {visible.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => handleAction(s)}
                  className="group w-full text-left flex items-start gap-2.5 p-2 rounded-md hover:bg-secondary/60 transition-colors"
                >
                  <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${s.iconClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-snug">{s.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{s.context}</p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(s.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        dismiss(s.id);
                      }
                    }}
                    className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Dismiss suggestion"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 pt-2.5 mt-1.5 border-t border-border">
            <Sparkles className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Powered by Goodie · Nexus AI</span>
          </div>
        </CardContent>
      </Card>

      <ScheduleEventDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultHouseholdId={scheduleCtx.id}
        defaultHouseholdName={scheduleCtx.name}
        defaultEventType="Annual Review"
        defaultTitle={scheduleCtx.title}
      />
      <QuickLogNoteDialog
        open={logNoteOpen}
        onOpenChange={setLogNoteOpen}
      />
    </>
  );
}
