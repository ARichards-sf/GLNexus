import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, CalendarCheck, FileText, MessageCircle, Sparkles, X, type LucideIcon } from "lucide-react";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";
import QuickLogNoteDialog from "@/components/QuickLogNoteDialog";

type ActionKind = "schedule" | "households" | "logNote";

interface Suggestion {
  id: string;
  icon: LucideIcon;
  iconClass: string; // tailwind classes for icon color + bg
  text: string;
  context: string;
  action: ActionKind;
  actionLabel: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: "s1",
    icon: CalendarCheck,
    iconClass: "bg-amber-muted text-amber",
    text: "Schedule annual review for Henderson Family",
    context: "Last review was 14 months ago — overdue by 2 months",
    action: "schedule",
    actionLabel: "Schedule",
  },
  {
    id: "s2",
    icon: FileText,
    iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    text: "3 households have reviews due this month",
    context: "Smith Family, Johnson Trust, Williams Retirement — all within 30 days",
    action: "households",
    actionLabel: "Review",
  },
  {
    id: "s3",
    icon: MessageCircle,
    iconClass: "bg-emerald-muted text-emerald",
    text: "Follow up with Davis Family",
    context: "No contact logged in 45 days — last note was a phone call",
    action: "logNote",
    actionLabel: "Log Note",
  },
];

export default function GoodieSuggests() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [logNoteOpen, setLogNoteOpen] = useState(false);

  const visible = SUGGESTIONS.filter((s) => !dismissed.has(s.id));

  const handleAction = (kind: ActionKind) => {
    if (kind === "schedule") setScheduleOpen(true);
    else if (kind === "households") navigate("/households");
    else if (kind === "logNote") setLogNoteOpen(true);
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
      <Card className="border-border shadow-none mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-60" />
              <Bot className="w-4 h-4 text-primary relative" />
            </span>
            Goodie Suggests
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1">
            {visible.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="group flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${s.iconClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.context}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleAction(s.action)}
                    >
                      Take Action
                    </Button>
                    <button
                      type="button"
                      onClick={() => dismiss(s.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Dismiss suggestion"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 pt-3 mt-2 border-t border-border">
            <Sparkles className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Powered by Goodie · GL Nexus AI</span>
          </div>
        </CardContent>
      </Card>

      <ScheduleEventDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
      <QuickLogNoteDialog open={logNoteOpen} onOpenChange={setLogNoteOpen} />
    </>
  );
}
