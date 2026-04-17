import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, X, Calendar, TrendingUp, FileText, Users, ChevronRight, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePreMeetingBrief } from "@/hooks/usePreMeetingBrief";
import { formatFullCurrency } from "@/data/sampleData";
import { EVENT_TYPE_COLORS, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  event: CalendarEvent;
  householdId: string;
  onClose?: () => void;
}

const RISK_COLORS: Record<string, string> = {
  Conservative: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Moderate: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Aggressive: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Very Aggressive": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  "Annual Review": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Phone Call": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Email: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  Prospecting: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Compliance: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (sameDay) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return `${date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} at ${time}`;
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

function isStartingSoon(iso: string): boolean {
  const minutes = (new Date(iso).getTime() - Date.now()) / 60000;
  return minutes >= 0 && minutes <= 60;
}

function buildContext(brief: ReturnType<typeof usePreMeetingBrief>): string {
  const { household, members, accountSummary, recentNotes, event } = brief;
  if (!household || !event) return "";

  const memberLines = members
    .map((m) => `- ${m.first_name} ${m.last_name} (${m.relationship}${m.age ? `, age ${m.age}` : ""})`)
    .join("\n");

  const acctLines = accountSummary.byMember
    .map(
      (g) =>
        `${g.member_name}: ${g.accounts
          .map((a) => `${a.account_type} ${formatFullCurrency(a.balance)}`)
          .join(", ")} (subtotal ${formatFullCurrency(g.subtotal)})`,
    )
    .join("\n");

  const noteLines = recentNotes
    .map((n) => `- [${n.date}] ${n.type}: ${n.summary}`)
    .join("\n");

  return [
    `MEETING: ${event.title} (${event.event_type}) on ${new Date(event.start_time).toLocaleString()}`,
    ``,
    `HOUSEHOLD: ${household.name}`,
    `Status: ${household.status} | Risk: ${household.risk_tolerance} | Total AUM: ${formatFullCurrency(household.total_aum)}`,
    `Investment Objective: ${household.investment_objective || "Not set"}`,
    `Next Action: ${household.next_action || "None"}`,
    `Annual Review Date: ${household.annual_review_date || "Not set"}`,
    ``,
    `MEMBERS:`,
    memberLines || "(none)",
    ``,
    `ACCOUNTS (Total ${formatFullCurrency(accountSummary.totalAum)}):`,
    acctLines || "(none)",
    ``,
    `RECENT NOTES:`,
    noteLines || "(none)",
  ].join("\n");
}

function useGoodieBrief(brief: ReturnType<typeof usePreMeetingBrief>) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggeredRef = useRef<string | null>(null);

  const ready =
    !brief.isLoading && !!brief.household && !!brief.event && triggeredRef.current !== brief.event.id;

  useEffect(() => {
    if (!ready) return;
    triggeredRef.current = brief.event.id;

    const run = async () => {
      setLoading(true);
      setError(null);
      setText("");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Not authenticated");

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
        const context = buildContext(brief);
        const userPrompt = `Generate a concise pre-meeting brief for my upcoming ${brief.event!.event_type} with ${brief.household!.name}. In 3-4 sentences highlight: the most important thing to address in this meeting, any red flags or opportunities in the data, and one specific talking point based on their recent activity. Be direct and advisor-focused.`;

        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: userPrompt }],
            context,
          }),
        });

        if (!resp.ok || !resp.body) {
          if (resp.status === 429) throw new Error("Rate limited. Please try again shortly.");
          if (resp.status === 402) throw new Error("AI credits exhausted.");
          throw new Error("Failed to generate brief");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let done = false;
        let acc = "";

        while (!done) {
          const { done: d, value } = await reader.read();
          if (d) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (delta) {
                acc += delta;
                setText(acc);
              }
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate brief");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return { text, loading, error };
}

export default function PreMeetingBriefPanel({ event, householdId, onClose }: Props) {
  const brief = usePreMeetingBrief(event, householdId);
  const goodie = useGoodieBrief(brief);

  const eventColor = EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS["Discovery Call"];
  const startingSoon = useMemo(() => isStartingSoon(event.start_time), [event.start_time]);

  const memberSummary = brief.members
    .map((m) => `${m.first_name} ${m.last_name}${m.age ? ` (${m.age})` : ""}`)
    .join(", ");

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl truncate">{event.title}</CardTitle>
                <Badge className={`${eventColor.bg} ${eventColor.text} border-0`}>
                  {event.event_type}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{formatEventTime(event.start_time)}</span>
                {startingSoon && (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Starting soon
                  </span>
                )}
              </div>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* SECTION 1 — Client Snapshot */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium uppercase tracking-wide">
            <Users className="h-4 w-4" />
            Client Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {brief.isLoading || !brief.household ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex items-center justify-between md:col-span-2">
                <Link
                  to={`/household/${brief.household.id}`}
                  className="font-semibold text-base hover:underline transition-colors hover:text-primary"
                >
                  {brief.household.name}
                </Link>
                <Badge variant="secondary">{brief.household.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total AUM</span>
                <span className="font-medium">{formatFullCurrency(brief.household.total_aum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk Tolerance</span>
                <Badge
                  variant="outline"
                  className={`border-0 ${RISK_COLORS[brief.household.risk_tolerance] || ""}`}
                >
                  {brief.household.risk_tolerance}
                </Badge>
              </div>
              <div className="flex justify-between md:col-span-2">
                <span className="text-muted-foreground">Investment Objective</span>
                <span className="font-medium text-right">
                  {brief.household.investment_objective || "—"}
                </span>
              </div>
              {brief.members.length > 0 && (
                <div className="md:col-span-2 pt-2 border-t">
                  <span className="text-muted-foreground">Members: </span>
                  {brief.members.map((m, i) => (
                    <span key={m.id}>
                      <Link
                        to={`/contacts/${m.id}`}
                        className="font-medium text-foreground hover:underline transition-colors hover:text-primary"
                      >
                        {m.first_name} {m.last_name}
                        {m.age ? ` (${m.age})` : ""}
                      </Link>
                      {i < brief.members.length - 1 && <span>, </span>}
                    </span>
                  ))}
                </div>
              )}
              <div className="md:col-span-2">
                <Link to={`/household/${brief.household.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    View Full Profile
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2 — Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium uppercase tracking-wide">
            <TrendingUp className="h-4 w-4" />
            Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {brief.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : brief.accountSummary.byMember.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts on file.</p>
          ) : (
            <>
              {brief.accountSummary.byMember.map((g) => (
                <div key={g.member_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{g.member_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFullCurrency(g.subtotal)}
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs">Type</TableHead>
                        <TableHead className="h-8 text-xs text-right">Balance</TableHead>
                        <TableHead className="h-8 w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.accounts.map((a) => (
                        <TableRow key={a.id} className="cursor-pointer group">
                          <TableCell className="p-0" colSpan={3}>
                            <Link
                              to={`/accounts/${a.id}`}
                              className="flex items-center w-full py-2 px-4 transition-colors hover:text-primary hover:bg-muted/40"
                            >
                              <span className="flex-1 text-sm">{a.account_type}</span>
                              <span className="text-sm text-right tabular-nums w-32">
                                {formatFullCurrency(a.balance)}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 ml-2 text-muted-foreground group-hover:text-primary" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatFullCurrency(brief.accountSummary.totalAum)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3 — Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium uppercase tracking-wide">
            <FileText className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {brief.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : brief.recentNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ol className="space-y-3">
              {brief.recentNotes.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1 w-px bg-border mt-1" />
                  </div>
                  <Link
                    to={`/household/${brief.household!.id}`}
                    className="flex-1 space-y-1 pb-1 rounded-md -mx-2 px-2 py-1 transition-colors hover:bg-muted/40 hover:text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`border-0 text-xs ${NOTE_TYPE_COLORS[n.type] || "bg-secondary"}`}
                      >
                        {n.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(n.date)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90">
                      {n.summary.length > 100
                        ? `${n.summary.slice(0, 100)}…`
                        : n.summary}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4 — Goodie's Take */}
      <Card className="border-amber-200/70 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
            <Bot className="h-4 w-4" />
            Goodie's Take
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goodie.error ? (
            <p className="text-sm text-destructive">{goodie.error}</p>
          ) : goodie.loading && !goodie.text ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {goodie.text || "Preparing brief..."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
