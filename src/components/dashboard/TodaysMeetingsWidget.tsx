import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useTodaysMeetings, EVENT_TYPE_COLORS, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/aiChat";
import { formatFullCurrency } from "@/data/sampleData";
import { cn } from "@/lib/utils";

const dateKey = () => new Date().toISOString().split("T")[0];
const cacheKey = (eventId: string) => `dash_meeting_brief_${eventId}_${dateKey()}`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

interface Props {
  size?: "small" | "large";
  /**
   * When `true`, drops the outer Card chrome and the built-in title row so
   * this can stack inside a parent (e.g. CopilotSidebar) that provides its
   * own section header.
   */
  embedded?: boolean;
}

/**
 * Today's Meetings — replaces the old upcoming-meetings widget. Shows every
 * scheduled meeting on the local calendar day; rows drop off as
 * useCompleteEvent flips status to "completed". Each row expands into an
 * AI-generated 2-3 sentence brief that's lazy-streamed on first open and
 * cached in localStorage so reopening doesn't redraft.
 */
export default function TodaysMeetingsWidget({ size = "small", embedded = false }: Props) {
  const { data: meetings = [], isLoading } = useTodaysMeetings();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = meetings.slice(0, size === "large" ? 8 : 5);

  const body = isLoading ? (
    <div className="space-y-2">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  ) : visible.length === 0 ? (
    <div className="text-center py-6">
      <CalendarDays className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">No meetings today</p>
      <Link to="/calendar">
        <Button variant="outline" size="sm" className="mt-2 text-xs">
          Open calendar
        </Button>
      </Link>
    </div>
  ) : (
    visible.map((ev) => (
      <MeetingRow
        key={ev.id}
        event={ev}
        expanded={expandedId === ev.id}
        onToggle={() => setExpandedId((cur) => (cur === ev.id ? null : ev.id))}
      />
    ))
  );

  if (embedded) {
    return <div className="space-y-2 px-3 py-2">{body}</div>;
  }

  return (
    <Card className="border-border shadow-none h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Today's Meetings
            {meetings.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] font-medium">
                {meetings.length}
              </Badge>
            )}
          </CardTitle>
          <Link to="/calendar">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View Calendar <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">{body}</CardContent>
    </Card>
  );
}

function MeetingRow({
  event,
  expanded,
  onToggle,
}: {
  event: CalendarEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS["Discovery Call"];
  const recipientName =
    event.households?.name ??
    (event.prospects ? `${event.prospects.first_name} ${event.prospects.last_name}` : "Unlinked");
  const linkTo = event.household_id
    ? `/household/${event.household_id}`
    : event.prospect_id
    ? `/prospects/${event.prospect_id}`
    : "/calendar";

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className={cn("w-2 h-10 rounded-full shrink-0", color.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
            <Badge variant="outline" className={cn("border-0 text-[10px] py-0 px-1.5 h-4", color.bg, color.text)}>
              {event.event_type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{recipientName}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-foreground tabular-nums">{formatTime(event.start_time)}</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
            <Sparkles className="w-2.5 h-2.5" />
            {expanded ? "Hide" : "Brief"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-amber-50/30 dark:bg-amber-950/10 px-3 py-3 space-y-2">
          <MeetingBriefBody event={event} recipientName={recipientName} />
          <div className="flex items-center justify-end gap-1 pt-1">
            {event.household_id && (
              <a
                href={`/household/${event.household_id}/onepager`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="text-[11px] h-7">
                  <Download className="w-3 h-3 mr-1" />
                  1-pager PDF
                </Button>
              </a>
            )}
            <Link to={linkTo}>
              <Button variant="ghost" size="sm" className="text-[11px] h-7">
                Open {event.household_id ? "household" : event.prospect_id ? "prospect" : "calendar"}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Streams a short brief on first render. Cached per event per day so
 * reopening the dashboard later in the day reads from localStorage instead
 * of redrafting.
 */
function MeetingBriefBody({ event, recipientName }: { event: CalendarEvent; recipientName: string }) {
  const [text, setText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(cacheKey(event.id)) ?? "";
    } catch {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Lightweight prep data: household snapshot + last few notes. We only
  // fetch this when the row is actually expanded (the component mounts on
  // expand) so the dashboard stays cheap on the default render.
  const { data: prep } = useQuery({
    queryKey: ["dash_meeting_prep", event.id],
    queryFn: async () => {
      if (event.household_id) {
        const [{ data: household }, { data: notes }] = await Promise.all([
          supabase
            .from("households")
            .select("name, total_aum, risk_tolerance, investment_objective, status, annual_review_date, next_action")
            .eq("id", event.household_id)
            .maybeSingle(),
          supabase
            .from("compliance_notes")
            .select("date, type, summary")
            .eq("household_id", event.household_id)
            .order("date", { ascending: false })
            .limit(4),
        ]);
        return { household, notes: notes ?? [], prospect: null };
      }
      if (event.prospect_id) {
        const { data: prospect } = await supabase
          .from("prospects")
          .select("first_name, last_name, company, pipeline_stage, estimated_aum, source, referred_by, notes")
          .eq("id", event.prospect_id)
          .maybeSingle();
        return { household: null, notes: [], prospect };
      }
      return { household: null, notes: [], prospect: null };
    },
    // If we have cached brief text, skip the fetch — the brief is the only
    // thing this query feeds.
    enabled: !text,
  });

  const context = useMemo(() => {
    if (!prep) return "";
    const lines: string[] = [];
    lines.push(`MEETING: ${event.title} (${event.event_type}) at ${formatTime(event.start_time)}`);
    if (prep.household) {
      lines.push("");
      lines.push(`HOUSEHOLD: ${prep.household.name}`);
      lines.push(
        `Status: ${prep.household.status} | Risk: ${prep.household.risk_tolerance} | AUM: ${formatFullCurrency(Number(prep.household.total_aum))}`,
      );
      if (prep.household.investment_objective) lines.push(`Objective: ${prep.household.investment_objective}`);
      if (prep.household.next_action) lines.push(`Next action on file: ${prep.household.next_action}`);
      if (prep.household.annual_review_date) lines.push(`Annual review date: ${prep.household.annual_review_date}`);
      if (prep.notes.length > 0) {
        lines.push("");
        lines.push("RECENT NOTES:");
        for (const n of prep.notes) {
          lines.push(`- [${n.date}] ${n.type}: ${(n.summary ?? "").slice(0, 200)}`);
        }
      }
    } else if (prep.prospect) {
      lines.push("");
      lines.push(`PROSPECT: ${prep.prospect.first_name} ${prep.prospect.last_name}`);
      if (prep.prospect.company) lines.push(`Company: ${prep.prospect.company}`);
      lines.push(`Pipeline stage: ${prep.prospect.pipeline_stage}`);
      if (prep.prospect.estimated_aum) lines.push(`Est. AUM: ${formatFullCurrency(Number(prep.prospect.estimated_aum))}`);
      if (prep.prospect.source) lines.push(`Source: ${prep.prospect.source}`);
      if (prep.prospect.referred_by) lines.push(`Referred by: ${prep.prospect.referred_by}`);
      if (prep.prospect.notes) lines.push(`Notes: ${prep.prospect.notes}`);
    }
    if (event.meeting_context) {
      lines.push("");
      lines.push(`MEETING GOAL: ${event.meeting_context}`);
    }
    return lines.join("\n");
  }, [prep, event.title, event.event_type, event.start_time, event.meeting_context]);

  useEffect(() => {
    if (text) return;
    if (!context) return;
    if (startedRef.current) return;
    startedRef.current = true;

    setLoading(true);
    setError(null);
    let acc = "";

    streamChat({
      messages: [
        {
          role: "user",
          content: `Generate a concise pre-meeting brief in 2-3 sentences for my upcoming ${event.event_type} with ${recipientName}. Highlight the single most important thing to address, any red flag or opportunity in the data, and one specific talking point. Be direct and advisor-focused. No greeting, no signoff — just the brief.`,
        },
      ],
      context,
      onDelta: (chunk) => {
        acc += chunk;
        setText(acc);
      },
      onToolCalls: () => {},
      onDone: () => {
        setLoading(false);
        try {
          if (acc.trim()) localStorage.setItem(cacheKey(event.id), acc);
        } catch {
          // sessionStorage/localStorage can throw in private mode
        }
      },
      onError: (msg) => {
        setLoading(false);
        setError(msg);
        startedRef.current = false; // allow retry on next expand
      },
    });
  }, [context, text, event.id, event.event_type, recipientName]);

  if (error) {
    return <p className="text-xs text-destructive">Couldn't generate brief: {error}</p>;
  }

  if (!text && loading) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <Bot className="w-3 h-3" />
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Goodie is reviewing the file…</span>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
        <Bot className="w-3 h-3" />
        Goodie's take
      </div>
      <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {text || "Open the household to review the full file."}
      </p>
    </div>
  );
}
