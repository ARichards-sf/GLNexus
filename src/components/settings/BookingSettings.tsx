import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPES } from "@/hooks/useCalendarEvents";
import { cn } from "@/lib/utils";

// ============================================================
// Types + hooks (colocated since they're only used here)
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
  enabled: boolean;
}

interface AvailabilityWindow {
  id: string;
  advisor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface MeetingType {
  id: string;
  advisor_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  event_type: string;
  pre_meeting_question: string | null;
  color: string | null;
  active: boolean;
  sort_order: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COMMON_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// ============================================================
// Main component
// ============================================================

export default function BookingSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const advisorId = user?.id;

  const settingsQuery = useQuery({
    queryKey: ["booking_settings", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advisor_booking_settings" as any)
        .select("*")
        .eq("advisor_id", advisorId!)
        .maybeSingle();
      if (error) throw error;
      return data as BookingSettings | null;
    },
    enabled: !!advisorId,
  });

  const createDefaultSettings = useMutation({
    mutationFn: async () => {
      // Pull display name to seed a sensible default slug + title.
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("user_id", advisorId!)
        .maybeSingle();
      const displayName =
        (profile as any)?.display_name ?? (profile as any)?.full_name ?? "advisor";
      const baseSlug = slugify(displayName) || advisorId!.slice(0, 8);
      const { error } = await supabase.from("advisor_booking_settings" as any).insert({
        advisor_id: advisorId!,
        slug: baseSlug,
        title: `Book a meeting with ${displayName}`,
        intro: null,
        time_zone: "America/Los_Angeles",
        advance_notice_hours: 24,
        buffer_minutes: 15,
        max_per_day: 8,
        date_range_days: 60,
        enabled: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking_settings"] });
      toast.success("Booking page initialized — fill in the details below.");
    },
    onError: (e: any) => toast.error(`Couldn't create page: ${e.message}`),
  });

  if (settingsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!settingsQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            Booking Page
          </CardTitle>
          <CardDescription>
            Create a public booking page so clients can pick a time on your calendar without back-and-forth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => createDefaultSettings.mutate()}
            disabled={createDefaultSettings.isPending}
          >
            {createDefaultSettings.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1.5" />
            )}
            Set up booking page
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageSetupCard settings={settingsQuery.data} />
      <AvailabilityCard advisorId={advisorId!} />
      <MeetingTypesCard advisorId={advisorId!} />
    </div>
  );
}

// ============================================================
// Page setup section
// ============================================================

function PageSetupCard({ settings }: { settings: BookingSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  // Reset local state when the underlying record refreshes (e.g. after save).
  useEffect(() => setForm(settings), [settings]);

  const bookingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/book/${form.slug}`
      : `/book/${form.slug}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("advisor_booking_settings" as any)
        .update({
          slug: form.slug,
          title: form.title,
          intro: form.intro,
          time_zone: form.time_zone,
          advance_notice_hours: form.advance_notice_hours,
          buffer_minutes: form.buffer_minutes,
          max_per_day: form.max_per_day,
          date_range_days: form.date_range_days,
          enabled: form.enabled,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("advisor_id", form.advisor_id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["booking_settings"] });
      toast.success("Saved.");
    } catch (e: any) {
      toast.error(`Couldn't save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              Page Setup
            </CardTitle>
            <CardDescription>
              Configure the public-facing booking page that clients see.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{form.enabled ? "Live" : "Off"}</span>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="slug">URL slug</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">/book/</span>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              className="flex-1"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <code className="truncate">{bookingUrl}</code>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={handleCopy}>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] hover:text-foreground inline-flex items-center gap-1"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">Page title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="intro">Intro</Label>
          <Textarea
            id="intro"
            value={form.intro ?? ""}
            onChange={(e) => setForm({ ...form, intro: e.target.value })}
            rows={3}
            placeholder="Shown above the meeting types on your booking page."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tz">Time zone</Label>
            <Select
              value={form.time_zone}
              onValueChange={(v) => setForm({ ...form, time_zone: v })}
            >
              <SelectTrigger id="tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice">Advance notice (hours)</Label>
            <Input
              id="notice"
              type="number"
              min={0}
              max={168}
              value={form.advance_notice_hours}
              onChange={(e) =>
                setForm({ ...form, advance_notice_hours: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buffer">Buffer between meetings (min)</Label>
            <Input
              id="buffer"
              type="number"
              min={0}
              max={120}
              value={form.buffer_minutes}
              onChange={(e) =>
                setForm({ ...form, buffer_minutes: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxday">Max meetings per day</Label>
            <Input
              id="maxday"
              type="number"
              min={1}
              max={20}
              value={form.max_per_day}
              onChange={(e) =>
                setForm({ ...form, max_per_day: Number(e.target.value) || 1 })
              }
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="range">How far out can clients book? (days)</Label>
            <Input
              id="range"
              type="number"
              min={1}
              max={365}
              value={form.date_range_days}
              onChange={(e) =>
                setForm({ ...form, date_range_days: Number(e.target.value) || 30 })
              }
            />
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Availability section
// ============================================================

function AvailabilityCard({ advisorId }: { advisorId: string }) {
  const queryClient = useQueryClient();
  const windowsQuery = useQuery({
    queryKey: ["availability_windows", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advisor_availability_windows" as any)
        .select("*")
        .eq("advisor_id", advisorId)
        .order("day_of_week");
      if (error) throw error;
      return (data ?? []) as unknown as AvailabilityWindow[];
    },
    enabled: !!advisorId,
  });

  // For v1, support a single window per day (covers 95% of cases). The
  // schema allows multiple — power users can split-schedule via DB later.
  // Local form state mirrors per-day enabled + start/end.
  const [form, setForm] = useState<Record<number, { enabled: boolean; start: string; end: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!windowsQuery.data) return;
    const next: Record<number, { enabled: boolean; start: string; end: string }> = {};
    for (let i = 0; i < 7; i++) {
      const w = windowsQuery.data.find((x) => x.day_of_week === i);
      next[i] = {
        enabled: !!w,
        start: w?.start_time ?? "09:00",
        end: w?.end_time ?? "17:00",
      };
    }
    setForm(next);
  }, [windowsQuery.data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Wipe + reinsert. Simpler than diffing for a 7-row form.
      const { error: delErr } = await supabase
        .from("advisor_availability_windows" as any)
        .delete()
        .eq("advisor_id", advisorId);
      if (delErr) throw delErr;
      const inserts = Object.entries(form)
        .filter(([, v]) => v.enabled && v.start && v.end)
        .map(([dow, v]) => ({
          advisor_id: advisorId,
          day_of_week: Number(dow),
          start_time: v.start,
          end_time: v.end,
        }));
      if (inserts.length > 0) {
        const { error: insErr } = await supabase
          .from("advisor_availability_windows" as any)
          .insert(inserts as any);
        if (insErr) throw insErr;
      }
      queryClient.invalidateQueries({ queryKey: ["availability_windows"] });
      toast.success("Availability saved.");
    } catch (e: any) {
      toast.error(`Couldn't save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Weekly Availability
        </CardTitle>
        <CardDescription>
          Set the hours you're available each day in your local time zone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {windowsQuery.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            {DAY_NAMES.map((name, idx) => {
              const day = form[idx] ?? { enabled: false, start: "09:00", end: "17:00" };
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 py-1.5 border-b border-border last:border-b-0"
                >
                  <div className="w-12 shrink-0">
                    <p className="text-sm font-medium">{name}</p>
                  </div>
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) =>
                      setForm({ ...form, [idx]: { ...day, enabled: v } })
                    }
                  />
                  <Input
                    type="time"
                    value={day.start}
                    disabled={!day.enabled}
                    onChange={(e) =>
                      setForm({ ...form, [idx]: { ...day, start: e.target.value } })
                    }
                    className="w-32"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={day.end}
                    disabled={!day.enabled}
                    onChange={(e) =>
                      setForm({ ...form, [idx]: { ...day, end: e.target.value } })
                    }
                    className="w-32"
                  />
                </div>
              );
            })}
            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Save availability
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Meeting types section
// ============================================================

function MeetingTypesCard({ advisorId }: { advisorId: string }) {
  const queryClient = useQueryClient();
  const [editType, setEditType] = useState<MeetingType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<MeetingType | null>(null);

  const typesQuery = useQuery({
    queryKey: ["meeting_types", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_meeting_types" as any)
        .select("*")
        .eq("advisor_id", advisorId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as MeetingType[];
    },
    enabled: !!advisorId,
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("booking_meeting_types" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_types"] });
      toast.success("Meeting type removed.");
    },
    onError: (e: any) => toast.error(`Couldn't delete: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              Meeting Types
            </CardTitle>
            <CardDescription>
              Each meeting type is a separate option clients see on your booking page.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {typesQuery.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (typesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No meeting types yet. Add one to start accepting bookings.
          </p>
        ) : (
          <div className="space-y-2">
            {typesQuery.data!.map((mt) => (
              <div
                key={mt.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{ background: mt.color ?? "hsl(var(--primary))" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{mt.name}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {mt.duration_minutes} min
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {mt.event_type}
                    </Badge>
                    {!mt.active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        inactive
                      </Badge>
                    )}
                  </div>
                  {mt.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {mt.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditType(mt)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteCandidate(mt)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <MeetingTypeDialog
        open={createOpen || !!editType}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditType(null);
          }
        }}
        advisorId={advisorId}
        existing={editType}
        existingSlugs={typesQuery.data?.map((t) => t.slug) ?? []}
      />

      <AlertDialog
        open={!!deleteCandidate}
        onOpenChange={(o) => !o && setDeleteCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this meeting type?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteCandidate?.name}" will no longer be selectable on your booking page.
              Existing meetings already booked under this type are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCandidate) deleteType.mutate(deleteCandidate.id);
                setDeleteCandidate(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function MeetingTypeDialog({
  open,
  onOpenChange,
  advisorId,
  existing,
  existingSlugs,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  advisorId: string;
  existing: MeetingType | null;
  existingSlugs: string[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!existing;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [eventType, setEventType] = useState<string>("Discovery Call");
  const [preQuestion, setPreQuestion] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auto-derive slug from name as the user types — but only when creating
  // a new type (don't surprise-rewrite an existing slug on edit).
  const slugTouched = useMemo(() => isEdit, [isEdit]);
  useEffect(() => {
    if (open && existing) {
      setName(existing.name);
      setSlug(existing.slug);
      setDescription(existing.description ?? "");
      setDuration(existing.duration_minutes);
      setEventType(existing.event_type);
      setPreQuestion(existing.pre_meeting_question ?? "");
      setColor(existing.color ?? "#3b82f6");
      setActive(existing.active);
    } else if (open && !existing) {
      setName("");
      setSlug("");
      setDescription("");
      setDuration(30);
      setEventType("Discovery Call");
      setPreQuestion("");
      setColor("#3b82f6");
      setActive(true);
    }
  }, [open, existing]);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const slugCollides = useMemo(() => {
    if (!slug) return false;
    if (isEdit && existing && slug === existing.slug) return false;
    return existingSlugs.includes(slug);
  }, [slug, isEdit, existing, existingSlugs]);

  const canSubmit =
    name.trim().length > 0 &&
    slug.trim().length > 0 &&
    !slugCollides &&
    duration >= 5 &&
    duration <= 480;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        advisor_id: advisorId,
        slug,
        name: name.trim(),
        description: description.trim() || null,
        duration_minutes: duration,
        event_type: eventType,
        pre_meeting_question: preQuestion.trim() || null,
        color,
        active,
        updated_at: new Date().toISOString(),
      };
      if (isEdit && existing) {
        const { error } = await supabase
          .from("booking_meeting_types" as any)
          .update(payload as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("booking_meeting_types" as any)
          .insert(payload as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["meeting_types"] });
      toast.success(isEdit ? "Meeting type updated." : "Meeting type added.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Couldn't save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit meeting type" : "New meeting type"}</DialogTitle>
          <DialogDescription>
            How clients pick this option on your booking page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Discovery Call"
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
            <p className={cn(
              "text-[11px]",
              slugCollides ? "text-destructive" : "text-muted-foreground",
            )}>
              {slugCollides
                ? "Another meeting type already uses this slug."
                : "Auto-derived from the name; you can override."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description shown on the booking page."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 30)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Event type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pre-meeting question (optional)</Label>
            <Input
              value={preQuestion}
              onChange={(e) => setPreQuestion(e.target.value)}
              placeholder="What would you like to walk away with?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="block">Active</Label>
              <div className="h-9 flex items-center">
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Add meeting type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
