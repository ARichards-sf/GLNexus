import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsDemoUser } from "@/lib/demoMode";

interface TourStep {
  id: string;
  /** Optional path to navigate to before showing this step. */
  path?: string;
  title: string;
  body: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/",
    title: "Welcome to Nexus AI",
    body: (
      <>
        <p>
          A live demo of an <strong>AI-powered CRM</strong> built for wealth advisors. Running on
          Supabase + Vercel + Claude, with ~30 synthetic households totaling ~$50M AUM.
        </p>
        <p>
          The amber dashed-border annotations throughout the app explain individual components.
          This tour walks you through the highlights — click <strong>Next</strong> to start.
        </p>
      </>
    ),
  },
  {
    id: "morning-brief",
    path: "/",
    title: "Time-Adaptive AI Briefing",
    body: (
      <>
        <p>
          Streamed from <strong>Claude</strong> via a Supabase Edge Function. The prompt rotates
          across morning, midday, and end-of-day variants and regenerates as the period rolls over.
        </p>
        <p>
          Live context: meetings, tasks, overdue annual reviews, AUM, prospect pipeline, recent
          compliance notes. Cached per-day in localStorage with task-change detection.
        </p>
      </>
    ),
  },
  {
    id: "goodie",
    path: "/goodie",
    title: "Goodie — RAG-Backed AI Co-Pilot",
    body: (
      <>
        <p>
          Ask Goodie anything about your book. Queries are vectorized via OpenAI embeddings, then
          semantic-searched against <strong>pgvector</strong> indexes over notes, households,
          members, accounts, tasks, and prospects.
        </p>
        <p>Try one of these — each maps to specific records in the seeded book:</p>
        <ul>
          <li>"What's the latest on the Castellanos family?"</li>
          <li>"Tell me about the Whitfield family's charitable giving plans."</li>
          <li>"Which clients have stock concentration concerns?"</li>
        </ul>
      </>
    ),
  },
  {
    id: "scorecard",
    path: "/scorecard",
    title: "Automated Portfolio Monitoring",
    body: (
      <>
        <p>
          Daily snapshots written by a <strong>pg_cron</strong> job feed tiered alert logic. The
          AUM Changes panel flags households whose 30-day decline crosses dollar or percent
          thresholds calibrated to portfolio size.
        </p>
        <p>
          Tier reassessments queue when an AUM swing crosses a band, surfacing here as pending
          reviews for the advisor to confirm or override.
        </p>
      </>
    ),
  },
  {
    id: "households",
    path: "/households",
    title: "Household Book of Business",
    body: (
      <>
        <p>
          30 seeded households across <strong>platinum / gold / silver</strong> tiers. Click any
          household to drill into members, accounts, compliance notes, calendar history, and an
          AUM-over-time chart — all backed by Supabase with row-level security per advisor.
        </p>
      </>
    ),
  },
  {
    id: "pipeline",
    path: "/pipeline",
    title: "Pipeline + Referral Graph",
    body: (
      <>
        <p>
          Prospects flow through 7 pipeline stages from lead to converted. Six of the ten are
          referred by existing households — those edges feed the tier-scoring algorithm: a
          referral from a platinum client adds more weight than from silver.
        </p>
      </>
    ),
  },
  {
    id: "end",
    title: "End of Tour",
    body: (
      <>
        <p>
          That's the highlights reel. Explore freely — every component with an amber dashed
          border has an explanation, and Goodie is always one click away.
        </p>
        <p>
          <strong>Heads up:</strong> this is still a work in progress, so you may run into
          rough edges or bugs.
        </p>
        <p>
          Hit the <strong>✨ Tour</strong> button bottom-left anytime to restart this walkthrough.
        </p>
      </>
    ),
  },
];

const STORAGE_KEYS = {
  seen: "nexus_demo_tour_seen",
  dismissed: "nexus_demo_tour_dismissed",
} as const;

export function DemoTour() {
  const isDemo = useIsDemoUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [stepIdx, setStepIdx] = useState(0);
  const [open, setOpen] = useState(false);

  // First-time auto-open
  useEffect(() => {
    if (!isDemo) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEYS.seen) === "true";
      const dismissed = localStorage.getItem(STORAGE_KEYS.dismissed) === "true";
      if (!seen && !dismissed) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEYS.seen, "true");
      }
    } catch {
      // ignore — localStorage may be unavailable
    }
  }, [isDemo]);

  if (!isDemo) return null;

  const step = TOUR_STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  const goTo = (newIdx: number) => {
    const next = TOUR_STEPS[newIdx];
    if (next?.path && next.path !== location.pathname) {
      navigate(next.path);
    }
    setStepIdx(newIdx);
  };

  const handleNext = () => {
    if (isLast) {
      handleDismiss();
    } else {
      goTo(stepIdx + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) goTo(stepIdx - 1);
  };

  const handleDismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEYS.dismissed, "true");
    } catch {
      // ignore
    }
  };

  const handleRestart = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.dismissed);
    } catch {
      // ignore
    }
    setStepIdx(0);
    if (TOUR_STEPS[0]?.path && TOUR_STEPS[0].path !== location.pathname) {
      navigate(TOUR_STEPS[0].path);
    }
    setOpen(true);
  };

  // Close on Escape while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Restart-only floating button when tour is closed
  if (!open) {
    return (
      <button
        onClick={handleRestart}
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 px-3.5 py-2 text-amber-950 text-sm font-semibold shadow-lg transition-colors"
        title="Restart guided tour"
      >
        <Sparkles className="w-4 h-4" />
        Tour
      </button>
    );
  }

  const progressDots = (
    <div className="flex items-center justify-center gap-1.5 shrink-0">
      {TOUR_STEPS.map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === stepIdx
              ? "w-6 bg-amber-500"
              : i < stepIdx
                ? "w-1.5 bg-amber-400/70"
                : "w-1.5 bg-muted",
          )}
        />
      ))}
    </div>
  );

  const navButtons = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="text-sm text-muted-foreground"
      >
        Skip
      </Button>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleBack} disabled={isFirst}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button
          size="sm"
          onClick={handleNext}
          className="bg-amber-500 hover:bg-amber-600 text-amber-950 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-amber-950"
        >
          {isLast ? "Finish" : "Next"}
          {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </>
  );

  // Welcome step (idx 0): centered modal with backdrop — captures full
  // attention before the user starts exploring.
  if (isFirst) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Guided tour"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-2xl rounded-xl border-2 border-amber-400 dark:border-amber-500 bg-card shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30 rounded-t-lg shrink-0">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <Sparkles className="w-4 h-4" />
                <span>
                  Tour · Step {stepIdx + 1} of {TOUR_STEPS.length}
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="rounded-full p-1.5 text-amber-900/70 dark:text-amber-100/70 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                title="Close tour"
                aria-label="Close tour"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto">
              <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
              <div className="text-base text-muted-foreground leading-relaxed space-y-3 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-foreground [&_strong]:font-semibold [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                {step.body}
              </div>
            </div>
            <div className="pb-3 shrink-0">{progressDots}</div>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
              {navButtons}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Subsequent steps: floating card in the bottom-left. No backdrop, page
  // is fully interactive so the user can poke around what each step describes.
  return (
    <div
      role="dialog"
      aria-label="Guided tour"
      className="fixed bottom-4 left-4 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border-2 border-amber-400 dark:border-amber-500 bg-card shadow-2xl flex flex-col max-h-[calc(100vh-2rem)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30 rounded-t-md shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-100">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            Tour · Step {stepIdx + 1} of {TOUR_STEPS.length}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-full p-1 text-amber-900/70 dark:text-amber-100/70 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          title="Close tour"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-3 space-y-2 overflow-y-auto">
        <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-0.5 [&_strong]:text-foreground [&_strong]:font-semibold [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
          {step.body}
        </div>
      </div>
      <div className="pb-2.5 shrink-0">{progressDots}</div>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border shrink-0">
        {navButtons}
      </div>
    </div>
  );
}
