import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Check,
  CheckSquare,
  CheckCircle2,
  LineChart,
  PieChart,
  Zap,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/aiChat";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

const PILLARS = [
  { key: "estate", label: "Estate", hint: "Will, trust, beneficiaries" },
  { key: "risk", label: "Risk", hint: "Insurance, liability, coverage" },
  { key: "retirement", label: "Retirement", hint: "401k, pension, Social Security" },
  { key: "assets", label: "Assets", hint: "Holdings, held-away, real estate" },
] as const;

const NOTE_TYPES = [
  "Annual Review",
  "Discovery Call",
  "Meeting",
  "Phone Call",
  "Prospecting",
  "Compliance",
  "Email",
];

const LANES = [
  {
    key: "financial_planning",
    label: "Financial Planning",
    icon: LineChart,
    description: "Comprehensive plan — retirement, estate, tax, cash flow",
    hint: "Creates planning intake task",
  },
  {
    key: "portfolio_construction",
    label: "Portfolio Construction",
    icon: PieChart,
    description: "Asset management focus for investment solutions",
    hint: "Creates portfolio proposal task",
  },
  {
    key: "point_solution",
    label: "Point / Product Solution",
    icon: Zap,
    description: "Targeted solution — 401k rollover, life insurance, single product",
    hint: "Creates product recommendation task",
  },
  {
    key: "handoff",
    label: "Handoff",
    icon: ArrowRightLeft,
    description: "Route to junior advisor or Compass desk",
    hint: "Creates handoff task",
  },
] as const;

export interface EndSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionEvent: (CalendarEvent & {
    households?: { name?: string } | null;
    prospects?: { first_name?: string; last_name?: string } | null;
  }) | null;
  isProspectSession: boolean;
  onComplete: (data: {
    pillars: string[];
    summary: string;
    noteType: string;
    lane?: string;
  }) => void;
}

export default function EndSessionDialog({
  open,
  onOpenChange,
  sessionEvent,
  isProspectSession,
  onComplete,
}: EndSessionDialogProps) {
  const totalSteps = isProspectSession ? 3 : 2;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pillars, setPillars] = useState<string[]>(() => {
    return ((window as any).__session_pillars as string[]) || [];
  });
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [selectedLane, setSelectedLane] = useState<string | null>(null);

  const defaultNoteType = (() => {
    const et = sessionEvent?.event_type;
    if (et === "Annual Review") return "Annual Review";
    if (et === "Discovery Call") return "Discovery Call";
    if (et === "Prospecting") return "Prospecting";
    return "Meeting";
  })();
  const [noteType, setNoteType] = useState(defaultNoteType);

  const sessionName =
    sessionEvent?.households?.name ||
    (sessionEvent?.prospects
      ? `${sessionEvent.prospects.first_name ?? ""} ${sessionEvent.prospects.last_name ?? ""}`.trim()
      : "client");

  const togglePillar = (key: string) => {
    setPillars((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setSummary("");

    const pillarsText =
      pillars.length > 0
        ? `Pillars covered in this meeting: ${pillars
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(", ")}.`
        : "No specific pillars noted.";

    const prompt = `Generate a concise compliance ${noteType} note for an advisor's meeting with ${sessionName}.

${pillarsText}
Meeting type: ${sessionEvent?.event_type || "Meeting"}
Date: ${new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })}

Write a professional 3-4 sentence first-person compliance note. Reference the pillars covered. Include a brief next steps mention. Keep under 100 words. Do not invent specific financial figures or account details. Start directly with the note content, no preamble.`;

    streamChat({
      messages: [{ role: "user", content: prompt }],
      context: "",
      onDelta: (chunk) => setSummary((prev) => prev + chunk),
      onToolCalls: () => {},
      onDone: () => {
        setIsGenerating(false);
        setGenerated(true);
      },
      onError: () => setIsGenerating(false),
    });
  };

  const stepIndicator = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i + 1 === step ? "w-8 bg-primary" : i + 1 < step ? "w-6 bg-primary/60" : "w-6 bg-border"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        Step {step} of {totalSteps}
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "End Session"}
            {step === 2 && "Meeting Notes"}
            {step === 3 && "Select Execution Lane"}
          </DialogTitle>
          <DialogDescription>{sessionName}</DialogDescription>
        </DialogHeader>

        {stepIndicator}

        {/* STEP 1 — Pillars */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-muted-foreground" />
                What was covered?
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Confirm the planning pillars discussed during this meeting.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PILLARS.map((pillar) => {
                const covered = pillars.includes(pillar.key);
                return (
                  <button
                    key={pillar.key}
                    type="button"
                    onClick={() => togglePillar(pillar.key)}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all",
                      covered
                        ? "border-primary/60 bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:bg-secondary/40"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        covered ? "bg-primary border-primary text-primary-foreground" : "border-border"
                      )}
                    >
                      {covered && <Check className="w-3 h-3" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          covered ? "text-foreground" : "text-foreground/80"
                        )}
                      >
                        {pillar.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {pillar.hint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {pillars.length === 4 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                All pillars covered
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setPillars([]);
                setStep(2);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              None of the above / Skip
            </button>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)}>Next →</Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2 — Notes */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">Log meeting notes</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This will be saved as a compliance note.
              </p>
            </div>

            {/* Note type pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {NOTE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNoteType(t)}
                  className={cn(
                    "shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors",
                    noteType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              )}
              {generated ? "Regenerate with Goodie" : "Generate with Goodie"}
            </Button>

            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Add meeting notes, or use Generate with Goodie..."
              rows={5}
              className="resize-none"
              disabled={isGenerating}
            />

            {pillars.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">Pillars:</span>
                {pillars.map((p) => (
                  <Badge key={p} variant="secondary" className="text-[10px] capitalize">
                    {p}
                  </Badge>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2 pt-2 sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    onComplete({ pillars, summary: "", noteType, lane: undefined })
                  }
                >
                  Skip & End Session
                </Button>
                <Button
                  onClick={() => {
                    if (isProspectSession) {
                      setStep(3);
                    } else {
                      onComplete({ pillars, summary, noteType });
                    }
                  }}
                  disabled={isGenerating}
                >
                  {isProspectSession ? "Next →" : "Save & End Session"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3 — Execution lane (prospects only) */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">Select Execution Lane</h3>
              <p className="text-xs text-muted-foreground mt-1">
                How should we proceed with {sessionName}?
              </p>
            </div>

            <div className="space-y-2">
              {LANES.map((lane) => {
                const Icon = lane.icon;
                const selected = selectedLane === lane.key;
                return (
                  <button
                    key={lane.key}
                    type="button"
                    onClick={() => setSelectedLane(lane.key)}
                    className={cn(
                      "w-full flex items-start gap-3 p-4 rounded-lg text-left transition-all cursor-pointer",
                      selected
                        ? "border-2 border-primary bg-primary/5"
                        : "border border-border hover:border-primary/40 hover:bg-secondary/40"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                        selected ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{lane.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {lane.description}
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 mt-1 italic">
                        {lane.hint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    onComplete({ pillars, summary, noteType, lane: "skip" })
                  }
                >
                  Skip for now
                </Button>
                <Button
                  disabled={!selectedLane}
                  onClick={() =>
                    onComplete({ pillars, summary, noteType, lane: selectedLane! })
                  }
                >
                  Confirm Lane
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
