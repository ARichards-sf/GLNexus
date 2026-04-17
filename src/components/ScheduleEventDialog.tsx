import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCalendarEvent, EVENT_TYPES } from "@/hooks/useCalendarEvents";
import { useHouseholds, type HouseholdRow } from "@/hooks/useHouseholds";
import { toast } from "sonner";
import { X } from "lucide-react";

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
}

export default function ScheduleEventDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultHouseholdId,
  defaultHouseholdName,
  defaultEventType,
  defaultType,
  defaultTitle,
}: Props) {
  const resolvedDefaultType = defaultEventType ?? defaultType ?? "";
  const [title, setTitle] = useState(defaultTitle || "");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState(resolvedDefaultType);
  const [householdId, setHouseholdId] = useState(defaultHouseholdId || "");
  const [date, setDate] = useState(defaultDate || "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  // Search-mode is only when no defaultHouseholdId is provided
  const searchMode = !defaultHouseholdId;
  const [householdSearch, setHouseholdSearch] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdRow | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const createEvent = useCreateCalendarEvent();
  const { data: households = [] } = useHouseholds();

  // Pre-selected household (when defaultHouseholdId is passed)
  const preSelectedName =
    defaultHouseholdName ?? households.find((h) => h.id === defaultHouseholdId)?.name ?? "Selected household";

  const filteredHouseholds = useMemo(() => {
    if (!householdSearch.trim()) return [];
    const q = householdSearch.toLowerCase();
    return households.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 8);
  }, [householdSearch, households]);

  // Reset on open change
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTitle(defaultTitle || "");
      setDescription("");
      setEventType(resolvedDefaultType);
      setHouseholdId(defaultHouseholdId || "");
      setDate(defaultDate || "");
      setStartTime("09:00");
      setEndTime("10:00");
      setHouseholdSearch("");
      setSelectedHousehold(null);
      setShowDropdown(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventType || !date) return;
    if (searchMode && !selectedHousehold) return;

    const start_time = new Date(`${date}T${startTime}:00`).toISOString();
    const end_time = new Date(`${date}T${endTime}:00`).toISOString();

    createEvent.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        start_time,
        end_time,
        event_type: eventType,
        household_id: householdId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Meeting scheduled successfully.");
          handleOpenChange(false);
        },
        onError: () => toast.error("Failed to schedule meeting."),
      }
    );
  };

  const submitDisabled = createEvent.isPending || (searchMode && !selectedHousehold);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {searchMode ? (
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
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Annual Review — Smith Family"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={setEventType} required>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Meeting notes or agenda..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitDisabled}>
              {createEvent.isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
