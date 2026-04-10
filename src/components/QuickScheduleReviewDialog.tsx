import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateCalendarEvent } from "@/hooks/useCalendarEvents";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  householdName: string;
}

/** Next Tuesday or Wednesday at 10 AM */
function getNextAdvisorSlot() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilTue = (2 - day + 7) % 7 || 7;
  const daysUntilWed = (3 - day + 7) % 7 || 7;
  const daysAhead = Math.min(daysUntilTue, daysUntilWed);
  const target = new Date(now);
  target.setDate(target.getDate() + daysAhead);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, startTime: "10:00", endTime: "11:00" };
}

export default function QuickScheduleReviewDialog({ open, onOpenChange, householdId, householdName }: Props) {
  const slot = getNextAdvisorSlot();
  const [date, setDate] = useState(slot.date);
  const [startTime, setStartTime] = useState(slot.startTime);
  const [endTime, setEndTime] = useState(slot.endTime);
  const [description, setDescription] = useState("");
  const [addTeams, setAddTeams] = useState(true);

  const createEvent = useCreateCalendarEvent();

  useEffect(() => {
    if (open) {
      const s = getNextAdvisorSlot();
      setDate(s.date);
      setStartTime(s.startTime);
      setEndTime(s.endTime);
      setDescription("");
      setAddTeams(true);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    const title = `Annual Review — ${householdName}`;
    const start_time = new Date(`${date}T${startTime}:00`).toISOString();
    const end_time = new Date(`${date}T${endTime}:00`).toISOString();
    const desc = [
      description.trim(),
      addTeams ? "📹 Teams Meeting: link will be added" : "",
    ].filter(Boolean).join("\n");

    createEvent.mutate(
      {
        title,
        description: desc || undefined,
        start_time,
        end_time,
        event_type: "Annual Review",
        household_id: householdId,
      },
      {
        onSuccess: () => {
          toast.success(`Annual Review scheduled for ${new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to schedule review."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Annual Review</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-lg bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">Household</p>
            <p className="text-sm font-medium text-foreground">{householdName}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Add Teams Meeting</p>
              <p className="text-xs text-muted-foreground">Include a Microsoft Teams link</p>
            </div>
            <Switch checked={addTeams} onCheckedChange={setAddTeams} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              placeholder="Agenda items or prep notes…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[70px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? "Scheduling…" : "Schedule Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
