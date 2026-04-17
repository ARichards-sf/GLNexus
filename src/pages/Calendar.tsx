import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Plus, CheckCircle2, Trash2, CalendarDays, FileText, Bot,
} from "lucide-react";
import {
  useCalendarEvents, useCompleteEvent, useDeleteCalendarEvent,
  EVENT_TYPE_COLORS, type CalendarEvent,
} from "@/hooks/useCalendarEvents";
import { useCreateComplianceNote } from "@/hooks/useHouseholds";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";
import AddComplianceNoteDialog from "@/components/AddComplianceNoteDialog";
import { useBrief } from "@/contexts/BriefContext";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells: { day: number; current: boolean; date: Date }[] = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, current: false, date: new Date(year, month - 1, prevDays - i) });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, date: new Date(year, month, d) });
  }
  // Next month padding
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false, date: new Date(year, month + 1, d) });
  }

  return cells;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CalendarEvent | null>(null);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const { openBrief } = useBrief();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const { data: events = [] } = useCalendarEvents(currentMonth);
  const completeEvent = useCompleteEvent();
  const deleteEvent = useDeleteCalendarEvent();

  const cells = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const today = formatDateKey(new Date());

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      const key = formatDateKey(new Date(e.start_time));
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const prev = () => setCurrentMonth(new Date(year, month - 1, 1));
  const next = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToday = () => setCurrentMonth(new Date());

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    setScheduleOpen(true);
  };

  const handleComplete = (event: CalendarEvent) => {
    setCompleteTarget(event);
  };

  const confirmComplete = () => {
    if (!completeTarget) return;
    completeEvent.mutate(
      { eventId: completeTarget.id, householdId: completeTarget.household_id },
      {
        onSuccess: () => {
          toast.success("Meeting marked as completed.");
          // Open compliance note dialog if linked to a household
          if (completeTarget.household_id) {
            setComplianceOpen(true);
          }
          setSelectedEvent(null);
        },
        onError: () => toast.error("Failed to complete event."),
      }
    );
    setCompleteTarget(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteEvent.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Event deleted.");
        setSelectedEvent(null);
      },
      onError: () => toast.error("Failed to delete event."),
    });
    setDeleteTarget(null);
  };

  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1">Manage your meetings and reviews.</p>
        </div>
        <Button onClick={() => { setSelectedDate(today); setScheduleOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Schedule Meeting
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {Object.entries(EVENT_TYPE_COLORS).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            <span className="text-xs text-muted-foreground">{type}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold text-foreground ml-2">{monthLabel}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
            {cells.map((cell, i) => {
              const key = formatDateKey(cell.date);
              const isToday = key === today;
              const dayEvents = eventsByDate[key] || [];

              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r border-border p-1.5 cursor-pointer hover:bg-secondary/40 transition-colors ${
                    !cell.current ? "bg-muted/30" : ""
                  }`}
                  onClick={() => handleDayClick(key)}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? "bg-primary text-primary-foreground" : cell.current ? "text-foreground" : "text-muted-foreground/50"
                  }`}>
                    {cell.day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const colors = EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS["Discovery Call"];
                      return (
                        <div
                          key={ev.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer ${colors.bg} ${colors.text} ${
                            ev.status === "completed" ? "line-through opacity-60" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1.5">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — Selected Event Detail */}
        <div className="space-y-4">
          {selectedEvent ? (
            <Card className="border-border shadow-none">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Badge className={`text-[11px] mb-2 ${EVENT_TYPE_COLORS[selectedEvent.event_type]?.bg || ""} ${EVENT_TYPE_COLORS[selectedEvent.event_type]?.text || ""}`}>
                    {selectedEvent.event_type}
                  </Badge>
                  <h3 className="text-sm font-semibold text-foreground">{selectedEvent.title}</h3>
                  {selectedEvent.households?.name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedEvent.households.name}</p>
                  )}
                </div>

                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>
                    {new Date(selectedEvent.start_time).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  <p>
                    {new Date(selectedEvent.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {" — "}
                    {new Date(selectedEvent.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>

                {selectedEvent.description && (
                  <p className="text-xs text-muted-foreground border-t pt-3">{selectedEvent.description}</p>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant={selectedEvent.status === "completed" ? "secondary" : "outline"} className="text-[10px]">
                    {selectedEvent.status === "completed" ? "✓ Completed" : "Scheduled"}
                  </Badge>
                </div>

                <div className="pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => openBrief(selectedEvent)}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> View Pre-Meeting Brief
                  </Button>
                </div>

                {selectedEvent.status === "scheduled" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setBriefEvent(selectedEvent)}
                    >
                      <Bot className="w-3.5 h-3.5 mr-1.5" /> Pre-Meeting Brief
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleComplete(selectedEvent)}
                      disabled={completeEvent.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Completed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(selectedEvent)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border shadow-none">
              <CardContent className="pt-6 text-center py-12">
                <CalendarDays className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Click an event to view details</p>
                <p className="text-xs text-muted-foreground mt-1">or click a day to schedule a meeting.</p>
              </CardContent>
            </Card>
          )}

          {/* Today's Events */}
          <Card className="border-border shadow-none">
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Today's Events</h3>
              <div className="space-y-2">
                {(eventsByDate[today] || []).map((ev) => {
                  const colors = EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS["Discovery Call"];
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedEvent(ev)}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                      <div className="min-w-0">
                        <p className={`text-xs font-medium text-foreground truncate ${ev.status === "completed" ? "line-through opacity-60" : ""}`}>
                          {ev.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(ev.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {!(eventsByDate[today] || []).length && (
                  <p className="text-xs text-muted-foreground text-center py-3">No events today</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ScheduleEventDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultDate={selectedDate}
      />

      {/* Complete confirmation */}
      <AlertDialog open={!!completeTarget} onOpenChange={(open) => !open && setCompleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the meeting as completed
              {completeTarget?.household_id ? " and update the household's last review date" : ""}.
              {completeTarget?.household_id ? " You'll be prompted to log a compliance note." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmComplete}>Complete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compliance note after completing */}
      {completeEvent.isSuccess && selectedEvent?.household_id && (
        <AddComplianceNoteDialog
          open={complianceOpen}
          onOpenChange={setComplianceOpen}
          householdId={selectedEvent.household_id}
        />
      )}
      {/* Pre-Meeting Brief Sheet */}
      <Sheet open={!!briefEvent} onOpenChange={(open) => !open && setBriefEvent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Pre-Meeting Brief</SheetTitle>
          </SheetHeader>
          {briefEvent && (
            briefEvent.household_id ? (
              <PreMeetingBriefPanel
                event={briefEvent}
                householdId={briefEvent.household_id}
                onClose={() => setBriefEvent(null)}
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <Badge className={`text-[11px] ${EVENT_TYPE_COLORS[briefEvent.event_type]?.bg || ""} ${EVENT_TYPE_COLORS[briefEvent.event_type]?.text || ""}`}>
                    {briefEvent.event_type}
                  </Badge>
                  <h3 className="text-sm font-semibold text-foreground">{briefEvent.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(briefEvent.start_time).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  {briefEvent.description && (
                    <p className="text-xs text-muted-foreground pt-2 border-t">{briefEvent.description}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground italic">
                  No household linked to this meeting — link a household to generate a brief.
                </p>
              </div>
            )
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
