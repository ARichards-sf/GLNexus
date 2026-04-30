import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bot,
  CalendarCheck,
  FileText,
  MessageCircle,
  Sparkles,
  TrendingDown,
  Clock,
  AlertCircle,
  X,
  Mail,
  MessageSquare,
  Phone,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";
import QuickLogNoteDialog from "@/components/QuickLogNoteDialog";
import { supabase } from "@/integrations/supabase/client";
import { useTargetAdvisorId } from "@/hooks/useHouseholds";
import { useProspects } from "@/hooks/useProspects";
import { useDraftPanel, type DraftKind } from "@/contexts/DraftPanelContext";
import { formatCurrency } from "@/data/sampleData";
import type { HouseholdRow } from "@/hooks/useHouseholds";

type ActionKind =
  | "schedule"
  | "households"
  | "logNote"
  | "household"
  | "prospect";

interface NoteLite {
  household_id: string;
  date: string;
}

interface BaseSuggestion {
  id: string;
  text: string;
  context: string;
  icon: LucideIcon;
  iconClass: string;
  priority: number;
}

interface ScheduleSuggestion extends BaseSuggestion {
  action: "schedule";
  household: HouseholdRow;
}

interface HouseholdsSuggestion extends BaseSuggestion {
  action: "households";
}

interface LogNoteSuggestion extends BaseSuggestion {
  action: "logNote";
  household: HouseholdRow;
}

interface HouseholdNavSuggestion extends BaseSuggestion {
  action: "household";
  householdId: string;
}

interface ProspectNavSuggestion extends BaseSuggestion {
  action: "prospect";
  prospectId: string;
}

type Suggestion =
  | ScheduleSuggestion
  | HouseholdsSuggestion
  | LogNoteSuggestion
  | HouseholdNavSuggestion
  | ProspectNavSuggestion;

interface Props {
  households: HouseholdRow[];
  recentNotes?: NoteLite[] | null;
  /**
   * When `true`, drops the outer Card chrome and the built-in title row so
   * this can stack inside a parent (e.g. CopilotSidebar) that provides its
   * own section header.
   */
  embedded?: boolean;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

// Mirrors the alert thresholds in Scorecard.tsx
function getAumAlertLevel(currentAum: number, previousAum: number): "critical" | "warning" | null {
  const dollarDrop = previousAum - currentAum;
  const percentDrop = previousAum > 0 ? (dollarDrop / previousAum) * 100 : 0;
  if (dollarDrop <= 0) return null;
  const isLarge = currentAum >= 1000000;
  const isMedium = currentAum >= 250000;
  if (isLarge) {
    if (dollarDrop >= 500000 || percentDrop >= 15) return "critical";
    if (dollarDrop >= 100000 || percentDrop >= 8) return "warning";
  } else if (isMedium) {
    if (dollarDrop >= 100000 || percentDrop >= 12) return "critical";
    if (dollarDrop >= 25000 || percentDrop >= 7) return "warning";
  } else {
    if (dollarDrop >= 25000 || percentDrop >= 10) return "critical";
    if (dollarDrop >= 10000 || percentDrop >= 6) return "warning";
  }
  return null;
}

const MAX_VISIBLE = 5;

// Dismissals are persisted in sessionStorage so they survive the navigate
// away → back round trip that happens when an AUM-drop tile opens the draft
// panel (the dashboard unmounts mid-flow, which would otherwise wipe the
// in-memory dismissed Set before `onSent` could update it).
const DISMISSED_STORAGE_KEY = "goodie_suggests_dismissed_v1";

const loadDismissed = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
};

const saveDismissed = (s: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    // sessionStorage can throw in private browsing modes — silently ignore.
  }
};

export default function GoodieSuggests({ households, recentNotes, embedded = false }: Props) {
  const notes = recentNotes ?? [];
  const navigate = useNavigate();
  const { advisorId } = useTargetAdvisorId();
  const { data: prospects = [] } = useProspects();
  const { openDraftPanel } = useDraftPanel();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  useEffect(() => {
    saveDismissed(dismissed);
  }, [dismissed]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [logNoteOpen, setLogNoteOpen] = useState(false);
  const [scheduleCtx, setScheduleCtx] = useState<{ id?: string; name?: string; title?: string; eventType?: string }>({});
  const [logNoteCtx, setLogNoteCtx] = useState<{ id?: string; name?: string }>({});

  // Tracks the suggestion that triggered the currently-open dialog so that
  // when the dialog completes successfully we can dismiss the right tile.
  // (An action completing means the advisor took the suggested step, so the
  // tile shouldn't keep nagging them. Dismissing makes room for the next
  // priority-ordered suggestion to slide in.)
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);

  const completePendingSuggestion = () => {
    if (pendingSuggestionId) {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(pendingSuggestionId);
        return next;
      });
      setPendingSuggestionId(null);
    }
  };

  // Scorecard-style data — reuses Scorecard's query keys so the cache is shared.
  const { data: householdSnapshots = [] } = useQuery({
    queryKey: ["scorecard_snapshots", advisorId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from("household_snapshots")
        .select("household_id, snapshot_date, total_aum")
        .eq("advisor_id", advisorId!)
        .gte("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true });
      return data || [];
    },
    enabled: !!advisorId,
  });

  const { data: overdueTouchpoints = [] } = useQuery({
    queryKey: ["scorecard_touchpoints", advisorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("touchpoints")
        .select(`*, households(id, name, wealth_tier)`)
        .eq("advisor_id", advisorId!)
        .eq("status", "upcoming")
        .lte("scheduled_date", new Date().toISOString().split("T")[0]);
      return data || [];
    },
    enabled: !!advisorId,
  });

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const seenHouseholds = new Set<string>();
    const now = new Date();

    // --- AUM drops (priority 90 critical / 75 warning) ---
    const byHh = new Map<string, { date: string; total_aum: number }[]>();
    for (const s of householdSnapshots as any[]) {
      const arr = byHh.get(s.household_id) || [];
      arr.push({ date: s.snapshot_date, total_aum: Number(s.total_aum) });
      byHh.set(s.household_id, arr);
    }
    const aumAlerts: {
      household: HouseholdRow;
      level: "critical" | "warning";
      dollarDrop: number;
      percentDrop: number;
    }[] = [];
    byHh.forEach((snaps, hhId) => {
      if (snaps.length < 2) return;
      const sorted = [...snaps].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const current = sorted[0].total_aum;
      const previous = sorted[sorted.length - 1].total_aum;
      const level = getAumAlertLevel(current, previous);
      if (!level) return;
      const hh = households.find((h) => h.id === hhId);
      if (!hh) return;
      aumAlerts.push({
        household: hh,
        level,
        dollarDrop: previous - current,
        percentDrop: previous > 0 ? ((previous - current) / previous) * 100 : 0,
      });
    });
    aumAlerts.sort((a, b) => {
      if (a.level !== b.level) return a.level === "critical" ? -1 : 1;
      return b.dollarDrop - a.dollarDrop;
    });
    // Pool more than the visible cap so dismissing a tile slides in the next
    // priority-ordered alert. Without this the pool tops out below
    // MAX_VISIBLE and dismissals leave permanent empty slots.
    for (const a of aumAlerts.slice(0, 10)) {
      seenHouseholds.add(a.household.id);
      out.push({
        id: `s-aum-${a.household.id}`,
        action: "household",
        householdId: a.household.id,
        text: `Review AUM drop at ${a.household.name}`,
        context: `${formatCurrency(a.dollarDrop)} (-${a.percentDrop.toFixed(1)}%) — ${a.level}`,
        icon: TrendingDown,
        iconClass:
          a.level === "critical"
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        priority: a.level === "critical" ? 90 : 75,
      });
    }

    // --- Overdue touchpoints (priority 70) ---
    const tps = (overdueTouchpoints as any[]).filter(
      (tp) => tp.households?.id && !seenHouseholds.has(tp.households.id)
    );
    for (const tp of tps.slice(0, 10)) {
      const days = daysBetween(now, new Date(tp.scheduled_date));
      seenHouseholds.add(tp.households.id);
      out.push({
        id: `s-touchpoint-${tp.id}`,
        action: "household",
        householdId: tp.households.id,
        text: `Overdue touchpoint: ${tp.households.name}`,
        context: `${tp.name} — ${days}d overdue`,
        icon: Clock,
        iconClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        priority: 70,
      });
    }

    // --- Most urgent annual reviews (priority 60) ---
    // Pool the top few so dismissals reveal the next-most-urgent review.
    const withReview = households.filter(
      (h) => !!h.annual_review_date && !seenHouseholds.has(h.id)
    );
    if (withReview.length > 0) {
      const sorted = [...withReview].sort((a, b) => {
        const da = Math.abs(new Date(a.annual_review_date!).getTime() - now.getTime());
        const db = Math.abs(new Date(b.annual_review_date!).getTime() - now.getTime());
        return da - db;
      });
      for (const top of sorted.slice(0, 5)) {
        seenHouseholds.add(top.id);
        out.push({
          id: `s-schedule-${top.id}`,
          action: "schedule",
          household: top,
          text: `Schedule annual review for ${top.name}`,
          context: `Review due ${formatDate(top.annual_review_date!)}`,
          icon: CalendarCheck,
          iconClass: "bg-amber-muted text-amber",
          priority: 60,
        });
      }
    }

    // --- Stalled prospects (priority 50) ---
    const stalled = (prospects as any[]).filter((p) => {
      if (!p?.id) return false;
      if (p.pipeline_stage === "converted" || p.pipeline_stage === "lost") return false;
      const days = Math.floor(
        (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return days >= 14;
    });
    if (stalled.length > 0) {
      const sortedStalled = [...stalled].sort(
        (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
      for (const top of sortedStalled.slice(0, 5)) {
        const days = Math.floor(
          (Date.now() - new Date(top.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const name = `${top.first_name ?? ""} ${top.last_name ?? ""}`.trim() || "Prospect";
        out.push({
          id: `s-prospect-${top.id}`,
          action: "prospect",
          prospectId: top.id,
          text: `Re-engage stalled prospect ${name}`,
          context: `${days}d in ${String(top.pipeline_stage || "pipeline").replace(/_/g, " ")}`,
          icon: AlertCircle,
          iconClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
          priority: 50,
        });
      }
    }

    // --- Reviews due in next 60 days (priority 40) ---
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
        priority: 40,
      });
    }

    // --- Least recently contacted (priority 30) ---
    if (households.length > 0) {
      const lastNoteByHh = new Map<string, Date>();
      for (const n of notes) {
        const d = new Date(n.date);
        const existing = lastNoteByHh.get(n.household_id);
        if (!existing || d > existing) lastNoteByHh.set(n.household_id, d);
      }
      const candidates = households.filter((h) => !seenHouseholds.has(h.id));
      const noNote = candidates.find((h) => !lastNoteByHh.has(h.id));
      let target: HouseholdRow | null = null;
      let contextText = "";
      if (noNote) {
        target = noNote;
        contextText = "No notes found";
      } else if (candidates.length > 0) {
        const sorted = [...candidates].sort((a, b) => {
          const da = lastNoteByHh.get(a.id)?.getTime() ?? 0;
          const db = lastNoteByHh.get(b.id)?.getTime() ?? 0;
          return da - db;
        });
        const oldest = sorted[0];
        const lastDate = lastNoteByHh.get(oldest.id);
        if (lastDate) {
          const daysSince = daysBetween(now, lastDate);
          if (daysSince > 30) {
            target = oldest;
            contextText = `Last contact was ${daysSince} days ago`;
          }
        }
      }
      if (target) {
        seenHouseholds.add(target.id);
        out.push({
          id: "s-lognote",
          action: "logNote",
          household: target,
          text: `Log a follow-up for ${target.name}`,
          context: contextText,
          icon: MessageCircle,
          iconClass: "bg-emerald-muted text-emerald",
          priority: 30,
        });
      }
    }

    return out.sort((a, b) => b.priority - a.priority);
  }, [households, notes, householdSnapshots, overdueTouchpoints, prospects]);

  const visible = suggestions.filter((s) => !dismissed.has(s.id)).slice(0, MAX_VISIBLE);

  const handleAction = (s: Suggestion) => {
    if (s.action === "schedule") {
      setPendingSuggestionId(s.id);
      setScheduleCtx({
        id: s.household.id,
        name: s.household.name,
        title: `Annual Review — ${s.household.name}`,
      });
      setScheduleOpen(true);
    } else if (s.action === "households") {
      navigate("/households");
    } else if (s.action === "logNote") {
      setPendingSuggestionId(s.id);
      setLogNoteCtx({ id: s.household.id, name: s.household.name });
      setLogNoteOpen(true);
    } else if (s.action === "household") {
      navigate(`/household/${s.householdId}`);
    } else if (s.action === "prospect") {
      navigate(`/prospects/${s.prospectId}`);
    }
  };

  // AUM-drop tiles render as a dropdown of options instead of a single click.
  // Other tile types keep their existing primary-action behavior.
  const isAumDrop = (s: Suggestion) => s.id.startsWith("s-aum-");

  const openDraft = (
    kind: DraftKind,
    household: HouseholdRow,
    reason: string,
    suggestionId: string,
  ) => {
    // Capture the suggestion id for the success closure. This callback fires
    // from MessageDraftPanel *after* navigation has unmounted the dashboard,
    // so setDismissed alone would be a no-op — write straight to
    // sessionStorage so the next mount of GoodieSuggests honors the dismissal.
    // We also still call setDismissed for the (rare) case where this component
    // is still mounted at fire time.
    const dismissThis = () => {
      const stored = loadDismissed();
      stored.add(suggestionId);
      saveDismissed(stored);
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(suggestionId);
        return next;
      });
    };
    // Navigate to the household so the advisor can review the underlying
    // data alongside the AI-generated draft in the right sidebar.
    navigate(`/household/${household.id}`);
    openDraftPanel({
      kind,
      recipientName: household.name,
      reason,
      callToAction: "schedule a brief call",
      householdId: household.id,
      onSent: dismissThis,
    });
  };

  const dismiss = (id: string) =>
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  // Embedded mode (sidebar) shows an empty state so the section doesn't
  // disappear; standalone mode returns null to keep the dashboard clean.
  if (visible.length === 0 && !embedded) return null;

  const tilesList = (
    <>
      {visible.length === 0 ? (
        <div className="px-2 py-6 text-center">
          <Sparkles className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">All caught up — no new suggestions right now.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
            {visible.map((s) => {
              const Icon = s.icon;

              const tileInner = (
                <>
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
                </>
              );

              const tileClass =
                "group w-full text-left flex items-start gap-2.5 p-2 rounded-md hover:bg-secondary/60 hover:-translate-y-0.5 transition-all duration-200";

              // AUM-drop tile → dropdown of outreach actions.
              if (isAumDrop(s) && s.action === "household") {
                const household = households.find((h) => h.id === s.householdId);
                if (!household) {
                  return null;
                }
                return (
                  <DropdownMenu key={s.id}>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className={tileClass}>{tileInner}</button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem
                        onClick={() => openDraft("email", household, s.context, s.id)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Draft email
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDraft("text", household, s.context, s.id)}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Draft text
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setPendingSuggestionId(s.id);
                          setScheduleCtx({
                            id: household.id,
                            name: household.name,
                            title: `Check-in — ${household.name}`,
                            eventType: "Check-in",
                          });
                          setScheduleOpen(true);
                        }}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Schedule call
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => navigate(`/household/${household.id}`)}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open household
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              // All other tiles keep the single-click behavior.
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => handleAction(s)}
                  className={tileClass}
                >
                  {tileInner}
                </button>
              );
            })}
        </div>
      )}
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="px-3 py-2">{tilesList}</div>
      ) : (
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
            {tilesList}
            <div className="flex items-center gap-1.5 pt-2.5 mt-1.5 border-t border-border">
              <Sparkles className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Powered by Goodie · Nexus AI</span>
            </div>
          </CardContent>
        </Card>
      )}

      <ScheduleEventDialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          // If the dialog was closed without success, drop the pending id
          // so the next action doesn't accidentally dismiss something.
          if (!open) setPendingSuggestionId(null);
        }}
        defaultHouseholdId={scheduleCtx.id}
        defaultHouseholdName={scheduleCtx.name}
        defaultEventType={scheduleCtx.eventType ?? "Annual Review"}
        defaultTitle={scheduleCtx.title}
        onSuccess={completePendingSuggestion}
      />
      <QuickLogNoteDialog
        open={logNoteOpen}
        onOpenChange={(open) => {
          setLogNoteOpen(open);
          if (!open) setPendingSuggestionId(null);
        }}
        onSuccess={completePendingSuggestion}
      />
    </>
  );
}
