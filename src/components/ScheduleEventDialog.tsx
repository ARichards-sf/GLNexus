import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCalendarEvent, EVENT_TYPES } from "@/hooks/useCalendarEvents";
import { useHouseholds, type HouseholdRow } from "@/hooks/useHouseholds";
import { useProspects, PIPELINE_STAGES, type Prospect } from "@/hooks/useProspects";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Users, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingTypeOption {
  id: string;
  slug: string;
  name: string;
  event_type: string;
  duration_minutes: number;
}


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string; // YYYY-MM-DD
  defaultHouseholdId?: string;
  defaultHouseholdName?: string;
  defaultEventType?: string;
  /** @deprecated use defaultEventType */
  defaultType?: string;
  defaultTitle?: string;
  /** Fires after the meeting is successfully created. */
  onSuccess?: () => void;
}

type MeetingType = "client" | "prospect";

export default function ScheduleEventDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultHouseholdId,
  defaultHouseholdName,
  defaultEventType,
  defaultType,
  defaultTitle,
  onSuccess,
}: Props) {
  const resolvedDefaultType = defaultEventType ?? defaultType ?? "";
  const { user } = useAuth();
  const [meetingType, setMeetingType] = useState<MeetingType>("client");
  const [title, setTitle] = useState(defaultTitle || "");
  const [description, setDescription] = useState("");
  const [meetingContext, setMeetingContext] = useState("");
  const [eventType, setEventType] = useState(resolvedDefaultType);
  /**
   * Selected booking_meeting_types row id. The advisor's configured menu is
   * the source of truth for "what kinds of meeting can I schedule" — same
   * list a client sees on /book/:slug. We keep `eventType` (string) on top
   * because the calendar_event row still stores the underlying event_type;
   * multiple meeting types can map to the same event_type (e.g. Discovery
   * Call + Quick Check-in both surface as event_type "Discovery Call").
   */
  const [selectedMeetingTypeId, setSelectedMeetingTypeId] = useState("");
  const [householdId, setHouseholdId] = useState(defaultHouseholdId || "");
  const [date, setDate] = useState(defaultDate || "");
  const [startTime, setStartTime] = useState("09:00");

  // The advisor's active booking meeting types. Empty list = fall back to
  // the legacy static EVENT_TYPES enum so this dialog still works for any
  // advisor who hasn't configured booking yet.
  const { data: meetingTypeOptions = [] } = useQuery<MeetingTypeOption[]>({
    queryKey: ["booking_meeting_types_for_dialog", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_meeting_types")
        .select("id, slug, name, event_type, duration_minutes")
        .eq("advisor_id", user!.id)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MeetingTypeOption[];
    },
    enabled: !!user?.id,
  });

  // When defaultEventType is passed (e.g. AI draft → "Annual Review"),
  // pre-select the first meeting type whose event_type matches so the
  // dropdown reflects the caller's intent.
  useEffect(() => {
    if (selectedMeetingTypeId) return;
    if (!resolvedDefaultType) return;
    if (meetingTypeOptions.length === 0) return;
    const match = meetingTypeOptions.find((m) => m.event_type === resolvedDefaultType);
    if (match) {
      setSelectedMeetingTypeId(match.id);
      setEventType(match.event_type);
    }
  }, [resolvedDefaultType, meetingTypeOptions, selectedMeetingTypeId]);

  // Resolve the duration for the chosen meeting context. Drives both the
  // computed end_time at submit and the helper text shown on the form.
  // Prospect meetings are always treated as Discovery Calls (30m default).
  // For client meetings, prefer the selected booking_meeting_types row;
  // fall back to 60m for the legacy "no booking config" path.
  const selectedMeetingType = useMemo(
    () => meetingTypeOptions.find((m) => m.id === selectedMeetingTypeId) ?? null,
    [selectedMeetingTypeId, meetingTypeOptions],
  );
  const durationMinutes = useMemo(() => {
    if (meetingType === "prospect") {
      const discovery = meetingTypeOptions.find((m) => m.event_type === "Discovery Call");
      return discovery?.duration_minutes ?? 30;
    }
    return selectedMeetingType?.duration_minutes ?? 60;
  }, [meetingType, meetingTypeOptions, selectedMeetingType]);

  // Search-mode is only when no defaultHouseholdId is provided
  const searchMode = !defaultHouseholdId;
  const [householdSearch, setHouseholdSearch] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdRow | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [prospectSearch, setProspectSearch] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showProspectDropdown, setShowProspectDropdown] = useState(false);

  const createEvent = useCreateCalendarEvent();
  const { data: households = [] } = useHouseholds();
  const { data: prospects = [] } = useProspects();

  // Pre-selected household (when defaultHouseholdId is passed)
  const preSelectedName =
    defaultHouseholdName ?? households.find((h) => h.id === defaultHouseholdId)?.name ?? "Selected household";

  const filteredHouseholds = useMemo(() => {
    if (!householdSearch.trim()) return [];
    const q = householdSearch.toLowerCase();
    return households.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 8);
  }, [householdSearch, households]);

  const filteredProspects = useMemo(() => {
    if (!prospectSearch.trim()) return [];
    const q = prospectSearch.toLowerCase();
    return prospects
      .filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.company || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [prospects, prospectSearch]);

  // Reset on open change
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setMeetingType("client");
      setTitle(defaultTitle || "");
      setDescription("");
      setMeetingContext("");
      setEventType(resolvedDefaultType);
      setSelectedMeetingTypeId("");
      setHouseholdId(defaultHouseholdId || "");
      setDate(defaultDate || "");
      setStartTime("09:00");
      setHouseholdSearch("");
      setSelectedHousehold(null);
      setShowDropdown(false);
      setProspectSearch("");
      setSelectedProspect(null);
      setShowProspectDropdown(false);
    }
    onOpenChange(isOpen);
  };

  const handleSelectHousehold = (h: HouseholdRow) => {
    setSelectedHousehold(h);
    setHouseholdId(h.id);
    setHouseholdSearch("");
    setShowDropdown(false);
  };

  const handleClearHousehold = () => {
    setSelectedHousehold(null);
    setHouseholdId("");
  };

  const handleSelectProspect = (p: Prospect) => {
    setSelectedProspect(p);
    setProspectSearch("");
    setShowProspectDropdown(false);
  };

  const handleClearProspect = () => {
    setSelectedProspect(null);
  };

  const handlePickClient = () => {
    setMeetingType("client");
    setSelectedProspect(null);
    setProspectSearch("");
  };

  const handlePickProspect = () => {
    setMeetingType("prospect");
    setSelectedHousehold(null);
    setHouseholdId("");
    setHouseholdSearch("");
    setEventType("Discovery Call");
    setSelectedMeetingTypeId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventType || !date) return;
    if (meetingType === "client" && searchMode && !selectedHousehold) return;
    if (meetingType === "prospect" && !selectedProspect) return;

    // End time is derived from the selected meeting type's duration — the
    // advisor doesn't pick it manually anymore. Keeps calendar events
    // consistent with the booking-page contract for the same meeting type.
    const start = new Date(`${date}T${startTime}:00`);
    const start_time = start.toISOString();
    const end_time = new Date(start.getTime() + durationMinutes * 60_000).toISOString();

    createEvent.mutate(
      {
        title: title.trim(),
        description: meetingContext.trim() || description.trim() || undefined,
        start_time,
        end_time,
        event_type: eventType,
        household_id: meetingType === "client" ? householdId || null : null,
        prospect_id: meetingType === "prospect" ? selectedProspect?.id || null : null,
        meeting_context: meetingContext.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Meeting scheduled successfully.");
          // Fire parent callback BEFORE close — close path may reset
          // state the parent's onSuccess relies on.
          onSuccess?.();
          handleOpenChange(false);
        },
        onError: () => toast.error("Failed to schedule meeting."),
      }
    );
  };

  const submitDisabled =
    createEvent.isPending ||
    (meetingType === "client" && searchMode && !selectedHousehold) ||
    (meetingType === "prospect" && !selectedProspect);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Meeting Type selector */}
          <div className="space-y-2">
            <Label>Meeting Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePickClient}
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                  meetingType === "client"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <Users className="w-4 h-4" />
                Client Meeting
              </button>
              <button
                type="button"
                onClick={handlePickProspect}
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                  meetingType === "prospect"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Prospect Meeting
              </button>
            </div>
          </div>

          {/* Client (household) search */}
          {meetingType === "client" && (
            searchMode ? (
              <div className="space-y-2">
                <Label>Household</Label>
                {selectedHousehold ? (
                  <div>
                    <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1 text-sm">
                      {selectedHousehold.name}
                      <button
                        type="button"
                        onClick={handleClearHousehold}
                        className="rounded-full p-0.5 hover:bg-background/60"
                        aria-label="Clear household"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search households..."
                      value={householdSearch}
                      onChange={(e) => {
                        setHouseholdSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                    />
                    {showDropdown && filteredHouseholds.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto">
                        {filteredHouseholds.map((h) => (
                          <button
                            type="button"
                            key={h.id}
                            onClick={() => handleSelectHousehold(h)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                          >
                            {h.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Household</Label>
                <div>
                  <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-2.5 text-sm">
                    {preSelectedName}
                  </Badge>
                </div>
              </div>
            )
          )}

          {/* Prospect search */}
          {meetingType === "prospect" && (
            <>
              <div className="space-y-2">
                <Label>Prospect</Label>
                {selectedProspect ? (
                  <div>
                    <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1 text-sm">
                      {selectedProspect.first_name} {selectedProspect.last_name}
                      {selectedProspect.company ? ` · ${selectedProspect.company}` : ""}
                      <button
                        type="button"
                        onClick={handleClearProspect}
                        className="rounded-full p-0.5 hover:bg-background/60"
                        aria-label="Clear prospect"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search prospects by name or company..."
                      value={prospectSearch}
                      onChange={(e) => {
                        setProspectSearch(e.target.value);
                        setShowProspectDropdown(true);
                      }}
                      onFocus={() => setShowProspectDropdown(true)}
                    />
                    {showProspectDropdown && filteredProspects.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-auto">
                        {filteredProspects.map((p) => {
                          const stage = PIPELINE_STAGES.find((s) => s.key === p.pipeline_stage);
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => handleSelectProspect(p)}
                              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">
                                  {p.first_name} {p.last_name}
                                </div>
                                {p.company && (
                                  <div className="text-xs text-muted-foreground truncate">{p.company}</div>
                                )}
                              </div>
                              {stage && (
                                <Badge className={cn("text-[10px] shrink-0", stage.color)}>{stage.label}</Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Meeting Goal (optional)</Label>
                <Textarea
                  placeholder="What do you want to cover or accomplish in this meeting?"
                  value={meetingContext}
                  onChange={(e) => setMeetingContext(e.target.value)}
                  className="min-h-[70px]"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder={
                meetingType === "prospect"
                  ? "e.g. Discovery Call — Jane Doe"
                  : "e.g. Annual Review — Smith Family"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Meeting Type</Label>
              {meetingType === "prospect" ? (
                <div className="space-y-1">
                  <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40">
                    <Badge className="text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                      Discovery Call
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Prospect meetings are always Discovery Calls
                  </p>
                </div>
              ) : meetingTypeOptions.length > 0 ? (
                <>
                  <Select
                    value={selectedMeetingTypeId}
                    onValueChange={(id) => {
                      setSelectedMeetingTypeId(id);
                      const m = meetingTypeOptions.find((x) => x.id === id);
                      if (m) setEventType(m.event_type);
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select meeting type" />
                    </SelectTrigger>
                    <SelectContent>
                      {meetingTypeOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {m.duration_minutes}m
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Same menu your clients see on /book/{user ? "" : "your-slug"} —
                    edit it in Settings → Booking.
                  </p>
                </>
              ) : (
                // Advisor hasn't set up booking meeting types yet — fall back
                // to the legacy hardcoded EVENT_TYPES enum so the dialog still
                // works.
                <Select value={eventType} onValueChange={setEventType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Start time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {durationMinutes} min — ends at {(() => {
                  const [h, m] = startTime.split(":").map(Number);
                  const total = Math.min(h * 60 + m + durationMinutes, 23 * 60 + 59);
                  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                })()}
              </p>
            </div>
          </div>

          {meetingType === "client" && (
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Meeting notes or agenda..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {createEvent.isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
