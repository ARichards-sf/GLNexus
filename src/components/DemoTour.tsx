import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsDemoUser, TOUR_STORAGE_KEYS } from "@/lib/demoMode";
import { useDraftPanel } from "@/contexts/DraftPanelContext";

interface TourStep {
  id: string;
  /** Optional path to navigate to before showing this step. */
  path?: string;
  title: string;
  body: React.ReactNode;
  /**
   * Where to anchor the floating card. Default is bottom-left so most steps
   * leave the right Copilot sidebar fully visible. "near-sidebar" docks the
   * card to the bottom-right, just left of the sidebar — used when the step
   * is *about* the sidebar so the reader can see what's described.
   */
  position?: "bottom-left" | "near-sidebar";
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
        <p>
          <strong>Heads up:</strong> this demo is designed for desktop. Mobile support is coming soon.
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
    id: "copilot-sidebar",
    path: "/",
    position: "near-sidebar",
    title: "Copilot Sidebar — Always-On Workspace",
    body: (
      <>
        <p>
          The right-hand console (over there →) stays with the advisor across every page. Four tabs, each capped at 5 items so it stays scannable on smaller monitors:
        </p>
        <ul>
          <li><strong>AI Drafts</strong> — pre-drafted outreach emails awaiting review (we'll dig in next)</li>
          <li><strong>Today's Meetings</strong> — schedule with on-demand AI brief + downloadable household 1-pager</li>
          <li><strong>Tasks</strong> — top-priority open work with one-click complete</li>
          <li><strong>Activity</strong> — auto-emitted events ("Goodie drafted...", "New booking from...")</li>
        </ul>
        <p>
          Active tab persists in localStorage per user; count badges stay visible across switches.{" "}
          <strong>Click the AI Drafts tab</strong> in the sidebar before continuing — the next step is about that panel.
        </p>
      </>
    ),
  },
  {
    id: "ai-drafts",
    path: "/",
    position: "near-sidebar",
    title: "AI Drafts — Trigger-Driven Outreach",
    body: (
      <>
        <p>
          A scheduled edge function scans the book for trigger conditions and stages a Claude-drafted email for each match. Triggers covered today:
        </p>
        <ul>
          <li><strong>Annual review due</strong> — clients with an upcoming review date</li>
          <li><strong>AUM drop</strong> — households whose 30-day snapshot trend crosses critical/warning thresholds (same logic as the Scorecard alerts)</li>
          <li><strong>Overdue touchpoint</strong> — Client Experience touchpoints past their scheduled date</li>
          <li><strong>Stalled prospect</strong> — prospects with no pipeline movement in 14+ days</li>
        </ul>
        <p>
          Each draft gets a deep-linked booking button matched to the trigger: AUM drop → <strong>30-min Quick Check-in</strong>, annual review → <strong>60-min Annual Review</strong>, etc. Recipient email is appended to the link so the booking page auto-identifies them and only shows time slots their wealth tier unlocks.
        </p>
        <p>
          <strong>Click the top draft in the sidebar</strong> to open the editor — you'll see the streamed body, a Send button that logs a compliance note, and the embedded scheduling button.
        </p>
      </>
    ),
  },
  {
    id: "booking",
    path: "/",
    title: "Tier-Aware Public Booking",
    body: (
      <>
        <p>
          Calendly-style booking page each advisor gets at <code>/book/:slug</code>. Clients see the advisor's three default meeting types — <strong>Discovery Call</strong> (30m), <strong>Annual Review</strong> (60m), <strong>Quick Check-in</strong> (30m) — with descriptions and durations.
        </p>
        <p>
          The differentiator: each weekly availability slot can require a minimum wealth tier. The booker enters their email up front; the backend resolves it to a household and filters time slots by tier — Silver+ / Gold+ / Platinum only. AI-Drafts emails pre-fill the email param, so recipients land already identified and only see slots their tier unlocks.
        </p>
        <p>
          Try it: open <code>/book/joe-tester</code> in a new tab and walk through as a client.
        </p>
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
    id: "reports",
    path: "/reports",
    title: "Reports — Book Analytics",
    body: (
      <>
        <p>
          Aggregate analytics across the entire book, organized into four tabs:
        </p>
        <ul>
          <li><strong>Book of Business</strong> — AUM by tier, risk-tolerance and household-status breakdowns, full table</li>
          <li><strong>Review Status</strong> — who's overdue for an annual review and recent review history</li>
          <li><strong>Activity & Tasks</strong> — note volume by type, task completion trends</li>
          <li><strong>Referrals</strong> — referral graph showing which clients send business; tier-weighted scoring feeds back into prospect ranking</li>
        </ul>
        <p>
          Charts via <code>recharts</code>, queries cached with <code>@tanstack/react-query</code>.
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

const STORAGE_KEYS = TOUR_STORAGE_KEYS;

export function DemoTour() {
  const isDemo = useIsDemoUser();
  const navigate = useNavigate();
  const location = useLocation();
  // The Copilot sidebar widens when a draft is open (360→480 at 2xl,
  // 480→600 at 3xl). "near-sidebar" tour steps need to follow that change
  // so the floating card doesn't get covered by the expanded draft panel.
  const { draft } = useDraftPanel();

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

  // Subsequent steps: floating card. No backdrop, page is fully interactive
  // so the user can poke around what each step describes.
  // Default position is bottom-left. "near-sidebar" anchors the card to the
  // bottom-right and offsets by the Copilot sidebar's width so the sidebar
  // stays fully visible. The sidebar grows when a draft is open (360→480 /
  // 480→600), so we follow that with a CSS transition for a smooth slide.
  // Below 2xl the sidebar is hidden, so we revert to bottom-left.
  const cardPositionClass =
    step.position === "near-sidebar"
      ? draft
        ? "bottom-4 left-4 2xl:left-auto 2xl:right-[496px] 3xl:right-[616px]"
        : "bottom-4 left-4 2xl:left-auto 2xl:right-[376px] 3xl:right-[496px]"
      : "bottom-4 left-4";
  return (
    <div
      role="dialog"
      aria-label="Guided tour"
      className={cn(
        "fixed z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border-2 border-amber-400 dark:border-amber-500 bg-card shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] transition-[right] duration-200",
        cardPositionClass,
      )}
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
