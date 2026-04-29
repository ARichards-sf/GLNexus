import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ============================================================
// Shared types + helpers
// ============================================================

interface BookingSettings {
  advisor_id: string;
  slug: string;
  title: string;
  intro: string | null;
  time_zone: string;
  advance_notice_hours: number;
  buffer_minutes: number;
  max_per_day: number;
  date_range_days: number;
}

interface MeetingType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  event_type: string;
  color: string | null;
}

interface BookingPageData {
  settings: BookingSettings;
  meeting_types: MeetingType[];
  advisor: { display_name: string | null; avatar_url: string | null };
}

async function callPublicBooking<T = any>(
  query: Record<string, string> | undefined,
  body?: any,
): Promise<T> {
  const search = query ? `?${new URLSearchParams(query).toString()}` : "";
  const { data, error } = await supabase.functions.invoke(`public-booking${search}`, {
    method: body ? "POST" : "GET",
    body: body ?? undefined,
  });
  if (error) {
    let detail = "";
    try {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        const eb = await ctx.json();
        detail = eb?.error || JSON.stringify(eb);
      }
    } catch {
      // ignore
    }
    throw new Error(detail ? `${error.message}: ${detail}` : error.message);
  }
  return data as T;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto">{children}</div>
    </div>
  );
}

function NotFoundPanel({ title = "Booking page not found" }: { title?: string }) {
  return (
    <PageShell>
      <Card className="border-border">
        <CardContent className="py-16 text-center space-y-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            The link you followed is incorrect or no longer active.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function usePageData(slug: string | undefined) {
  return useQuery({
    queryKey: ["public_booking_page", slug],
    queryFn: () => callPublicBooking<BookingPageData>({ action: "get_page", slug: slug! }),
    enabled: !!slug,
    retry: false,
  });
}

// ============================================================
// Step 1: Profile + meeting type list
// ============================================================

export function BookingProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = usePageData(slug);

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-24 w-full mb-2" />
        <Skeleton className="h-24 w-full" />
      </PageShell>
    );
  }
  if (isError || !data) return <NotFoundPanel />;

  const { settings, meeting_types, advisor } = data;

  return (
    <PageShell>
      <Card className="border-border mb-4">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              {advisor.display_name?.slice(0, 1).toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{settings.title}</CardTitle>
              {advisor.display_name && (
                <CardDescription>{advisor.display_name}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        {settings.intro && (
          <CardContent className="text-sm text-foreground/80 leading-relaxed pt-0">
            {settings.intro}
          </CardContent>
        )}
      </Card>

      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 px-1">
        Pick a meeting type
      </p>
      <div className="space-y-2">
        {meeting_types.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No active meeting types right now. Please check back later.
            </CardContent>
          </Card>
        ) : (
          meeting_types.map((mt) => (
            <Link
              key={mt.id}
              to={`/book/${slug}/${mt.slug}`}
              className="block rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className="w-1 h-12 rounded-full shrink-0 mt-0.5"
                    style={{ background: mt.color ?? "hsl(var(--primary))" }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{mt.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {mt.duration_minutes} min
                    </p>
                    {mt.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {mt.description}
                      </p>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Link>
          ))
        )}
      </div>
    </PageShell>
  );
}

// ============================================================
// Step 2: Pick a time
// ============================================================

const formatLocalDateIso = (date: Date): string => {
  // YYYY-MM-DD in the user's local tz (browser). We pass this to the slot
  // endpoint along with the advisor's tz; the server treats it as a date
  // in the *advisor's* tz, which is the convention we want — clients are
  // shown slots that exist in the advisor's working windows.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export function BookingPickTime() {
  const { slug, typeSlug } = useParams<{ slug: string; typeSlug: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: page, isLoading: pageLoading, isError } = usePageData(slug);
  const meetingType = useMemo(
    () => page?.meeting_types.find((m) => m.slug === typeSlug),
    [page, typeSlug],
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Tier-aware booking: the email decides which availability windows apply.
  // We accept both `?email=` (canonical) and `?e=` (legacy short form) and
  // promote whichever is present into the page's working state.
  const urlEmail = (params.get("email") ?? params.get("e") ?? "").trim().toLowerCase();
  const [emailDraft, setEmailDraft] = useState("");
  const email = urlEmail;

  const tierQuery = useQuery({
    queryKey: ["public_booking_resolve", slug, email],
    queryFn: () =>
      callPublicBooking<{ tier: string | null; display_name: string | null }>({
        action: "resolve_email",
        slug: slug!,
        email,
      }),
    enabled: !!slug && !!email,
    staleTime: 60_000,
  });

  const dateIso = selectedDate ? formatLocalDateIso(selectedDate) : null;
  const slotsQuery = useQuery({
    queryKey: ["public_booking_slots", slug, typeSlug, dateIso, email],
    queryFn: () =>
      callPublicBooking<{ slots: string[]; time_zone: string }>({
        action: "get_slots",
        slug: slug!,
        type_slug: typeSlug!,
        date: dateIso!,
        ...(email ? { email } : {}),
      }),
    enabled: !!slug && !!typeSlug && !!dateIso && !!email,
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailDraft.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(trimmed)) return;
    const next = new URLSearchParams(params);
    next.set("email", trimmed);
    next.delete("e"); // canonicalize
    setParams(next, { replace: true });
  };

  const clearEmail = () => {
    const next = new URLSearchParams(params);
    next.delete("email");
    next.delete("e");
    setParams(next, { replace: true });
    setEmailDraft("");
  };

  if (pageLoading) {
    return (
      <PageShell>
        <Skeleton className="h-12 w-32 mb-4" />
        <Skeleton className="h-96 w-full" />
      </PageShell>
    );
  }
  if (isError || !page || !meetingType) return <NotFoundPanel />;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + page.settings.date_range_days);

  return (
    <PageShell>
      <Link
        to={`/book/${slug}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to meeting types
      </Link>

      <Card className="border-border mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{meetingType.name}</CardTitle>
          <CardDescription className="flex items-center gap-1 text-xs">
            <Clock className="w-3 h-3" />
            {meetingType.duration_minutes} min · {page.settings.time_zone.replace(/_/g, " ")}
          </CardDescription>
        </CardHeader>
      </Card>

      {!email ? (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              Your email
            </CardTitle>
            <CardDescription className="text-xs">
              We use your email to show you the times that work for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
              />
              <Button type="submit" size="sm" className="sm:w-auto">
                Continue
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {tierQuery.data?.display_name && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Booking as <span className="text-foreground font-medium">{tierQuery.data.display_name}</span>
                {" · "}
                <span className="text-muted-foreground">{email}</span>
              </span>
              <button
                type="button"
                onClick={clearEmail}
                className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Not you?
              </button>
            </div>
          )}
          {!tierQuery.data?.display_name && tierQuery.isFetched && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground truncate">
                Booking as <span className="text-foreground font-medium">{email}</span>
              </span>
              <button
                type="button"
                onClick={clearEmail}
                className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Change
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarIcon className="w-3.5 h-3.5" />
              Pick a date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              fromDate={today}
              toDate={maxDate}
              className="p-0"
            />
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Available times
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Pick a date to see available times.
              </p>
            ) : slotsQuery.isLoading ? (
              <div className="space-y-1.5">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (slotsQuery.data?.slots ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No times available on this date.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto">
                {(slotsQuery.data!.slots ?? []).map((iso) => {
                  const d = new Date(iso);
                  const label = new Intl.DateTimeFormat(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: page.settings.time_zone,
                  }).format(d);
                  return (
                    <Button
                      key={iso}
                      variant="outline"
                      size="sm"
                      className="text-xs justify-center"
                      onClick={() => {
                        // Carry through any existing prefill params (n, e, p)
                        // from the email link so the confirm page can seed
                        // the form fields without the recipient retyping.
                        const next = new URLSearchParams(params);
                        next.set("slot", iso);
                        navigate(`/book/${slug}/${typeSlug}/confirm?${next.toString()}`);
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}

// ============================================================
// Step 3: Confirm — collect contact info + answer
// ============================================================

export function BookingConfirm() {
  const { slug, typeSlug } = useParams<{ slug: string; typeSlug: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slot = params.get("slot");

  const { data: page, isLoading } = usePageData(slug);
  const meetingType = useMemo(
    () => page?.meeting_types.find((m) => m.slug === typeSlug),
    [page, typeSlug],
  );

  // Seed the form from any prefill params (n, email|e, p) — set when the
  // email link points the recipient at this booking flow. The `email` query
  // arg is canonical (and how the time-pick step writes it); `e` is kept for
  // backwards compatibility with older email links.
  const [name, setName] = useState(() => params.get("n") ?? "");
  const [email, setEmail] = useState(() => params.get("email") ?? params.get("e") ?? "");
  const [phone, setPhone] = useState(() => params.get("p") ?? "");
  const [answer, setAnswer] = useState("");

  const book = useMutation({
    mutationFn: async () => {
      return await callPublicBooking<{
        event_id: string;
        title: string;
        start_time: string;
        end_time: string;
        time_zone: string;
      }>(undefined, {
        action: "book",
        slug,
        type_slug: typeSlug,
        start_time: slot,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        answer: answer.trim() || null,
      });
    },
    onSuccess: (data) => {
      navigate(`/book/${slug}/confirmed/${data.event_id}`, {
        state: { result: data, meetingType: meetingType?.name },
      });
    },
  });

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-12 w-32 mb-4" />
        <Skeleton className="h-96 w-full" />
      </PageShell>
    );
  }
  if (!page || !meetingType || !slot) return <NotFoundPanel />;

  const slotDate = new Date(slot);
  const slotLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: page.settings.time_zone,
  }).format(slotDate);

  const canSubmit = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email.trim()) && !book.isPending;

  return (
    <PageShell>
      <Link
        to={`/book/${slug}/${typeSlug}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3 h-3" />
        Pick a different time
      </Link>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Confirm your meeting</CardTitle>
          <CardDescription className="space-y-0.5">
            <span className="block">{meetingType.name} · {meetingType.duration_minutes} min</span>
            <span className="block text-foreground font-medium">{slotLabel}</span>
            <span className="block text-[10px] text-muted-foreground">
              {page.settings.time_zone.replace(/_/g, " ")}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) book.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                <User className="w-3 h-3 inline mr-1" />
                Full name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah Anderson"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                <Mail className="w-3 h-3 inline mr-1" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">
                <Phone className="w-3 h-3 inline mr-1" />
                Phone <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            {meetingType.description && (
              <div className="space-y-1.5">
                <Label htmlFor="answer" className="text-xs">
                  Anything you'd like to share before we meet?{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
            {book.isError && (
              <p className="text-xs text-destructive">
                {book.error instanceof Error ? book.error.message : "Couldn't book — please try again."}
              </p>
            )}
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {book.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Booking…
                </>
              ) : (
                "Confirm booking"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

// ============================================================
// Step 4: Confirmed
// ============================================================

interface ConfirmedState {
  result?: {
    event_id: string;
    title: string;
    start_time: string;
    end_time: string;
    time_zone: string;
  };
  meetingType?: string;
}

export function BookingConfirmed() {
  const { slug } = useParams<{ slug: string }>();
  const params = useSearchParams()[0];
  const fallback = useMemo(() => {
    // Allow direct deep-link via query string for refresh resilience.
    const start = params.get("start");
    const tz = params.get("tz");
    if (!start || !tz) return null;
    return { start, tz };
  }, [params]);
  // We pass the booking response in router state; if user refreshes we fall
  // back to the URL params (no DB read needed for the confirmation page).
  const state = (window.history.state?.usr ?? {}) as ConfirmedState;
  const result = state?.result ?? null;

  const startIso = result?.start_time ?? fallback?.start ?? null;
  const tz = result?.time_zone ?? fallback?.tz ?? "UTC";

  return (
    <PageShell>
      <Card className="border-border">
        <CardContent className="py-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">You're booked.</h2>
            <p className="text-sm text-muted-foreground">
              A confirmation has been logged. You'll get a reminder before the meeting.
            </p>
          </div>
          {startIso && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 inline-block text-left">
              {state?.meetingType && (
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {state.meetingType}
                </p>
              )}
              <p className="text-sm font-medium text-foreground">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: tz,
                }).format(new Date(startIso))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{tz.replace(/_/g, " ")}</p>
            </div>
          )}
          <Link
            to={`/book/${slug}`}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeft className="w-3 h-3" />
            Book another meeting
          </Link>
        </CardContent>
      </Card>
    </PageShell>
  );
}
