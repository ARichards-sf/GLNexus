import { useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  DollarSign,
  CalendarCheck,
  Users,
  ArrowUpRight,
  Clock,
  FileText,
  Phone,
  ArrowRight,
  Camera,
  CalendarDays,
  HelpCircle,
  TicketCheck,
  CheckSquare,
  Plus,
  Zap,
  Settings2,
  X,
  GripVertical,
  RotateCcw,
  Check,
} from "lucide-react";
import VpmRequestDialog from "@/components/VpmRequestDialog";
import { useVpmStatus } from "@/hooks/useAdmin";
import CreateHouseholdDialog from "@/components/CreateHouseholdDialog";
import QuickLogNoteDialog from "@/components/QuickLogNoteDialog";
import { useInSession } from "@/contexts/InSessionContext";
import { useQueryClient } from "@tanstack/react-query";
import { useHouseholds, useAllComplianceNotes, useGenerateSnapshot } from "@/hooks/useHouseholds";
import { useUpcomingEvents, EVENT_TYPE_COLORS } from "@/hooks/useCalendarEvents";
import { useMyServiceRequests } from "@/hooks/useServiceRequests";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";
import { toast } from "sonner";
import RequestAssistanceDialog from "@/components/RequestAssistanceDialog";
import GoodieSuggests from "@/components/GoodieSuggests";
import MorningBriefing from "@/components/MorningBriefing";
import { useTasks } from "@/hooks/useTasks";
import { useProspects } from "@/hooks/useProspects";
import { useFirmContext } from "@/hooks/useFirmContext";
import { useSelectedFirm } from "@/contexts/FirmContext";
import { useFirms } from "@/hooks/useFirms";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  WIDGET_REGISTRY,
  DEFAULT_LAYOUT,
  type WidgetInstance,
  type WidgetSize,
} from "@/lib/dashboardWidgets";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const noteTypeColors: Record<string, string> = {
  Prospecting: "bg-amber-muted text-amber",
  Review: "bg-emerald-muted text-emerald",
  Service: "bg-secondary text-muted-foreground",
  Compliance: "bg-secondary text-muted-foreground",
  Onboarding: "bg-emerald-muted text-emerald",
};

const noteTypeIcons: Record<string, React.ElementType> = {
  Prospecting: Users,
  Review: CalendarCheck,
  Service: Phone,
  Compliance: FileText,
  Onboarding: FileText,
};

function SortableWidget({
  instance,
  editMode,
  onRemove,
  onToggleSize,
  children,
}: {
  instance: WidgetInstance;
  editMode: boolean;
  onRemove: (id: string) => void;
  onToggleSize: (id: string) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instance.id });

  const def = WIDGET_REGISTRY.find((d) => d.id === instance.widgetId);
  const canResize = (def?.allowedSizes.length ?? 0) > 1;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: instance.size === "large" ? "span 2" : "span 1",
  } as const;

  return (
    <div ref={setNodeRef} style={style} className="relative min-w-0">
      {editMode && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          {canResize && (
            <button
              type="button"
              onClick={() => onToggleSize(instance.id)}
              className="bg-background border border-border rounded-md p-1 text-xs text-muted-foreground hover:text-foreground shadow-sm"
              title={instance.size === "small" ? "Make full width" : "Make half width"}
            >
              {instance.size === "small" ? "↔" : "↕"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemove(instance.id)}
            className="bg-background border border-border rounded-md p-1 text-muted-foreground hover:text-destructive shadow-sm"
            title="Remove widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {editMode && (
        <div
          className="absolute left-3 top-3 z-20 cursor-grab rounded-md border border-border bg-background p-1 text-muted-foreground shadow-sm active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { impersonatedUser } = useImpersonation();
  const { data: households = [], isLoading } = useHouseholds();
  const { data: recentNotes = [] } = useAllComplianceNotes();
  const { data: upcomingEvents = [] } = useUpcomingEvents(20);
  const { data: myRequests = [] } = useMyServiceRequests();
  const { data: myTasks = [] } = useTasks("mine");
  const { data: prospects = [] } = useProspects();
  const generateSnapshot = useGenerateSnapshot();
  const [assistOpen, setAssistOpen] = useState(false);
  const [createHouseholdOpen, setCreateHouseholdOpen] = useState(false);
  const [logNoteOpen, setLogNoteOpen] = useState(false);
  const [vpmOpen, setVpmOpen] = useState(false);
  const { data: vpmStatus } = useVpmStatus();
  const { startSession } = useInSession();

  const { currentFirm } = useFirmContext();
  const { selectedFirmId } = useSelectedFirm();
  const { data: firms = [] } = useFirms();
  const brandingFirm = selectedFirmId ? firms.find((f) => f.id === selectedFirmId) ?? currentFirm : currentFirm;
  const firmAccentColor = (brandingFirm as any)?.accent_color || undefined;
  const firmAccent = (brandingFirm as any)?.accent_color || null;

  const openRequests = useMemo(() => {
    return myRequests.filter((r) => r.status !== "resolved" && r.status !== "closed");
  }, [myRequests]);

  const pendingTasks = useMemo(() => {
    return myTasks.filter((t) => t.status === "todo").slice(0, 3);
  }, [myTasks]);

  const allPendingTasks = useMemo(() => {
    return myTasks.filter((t) => t.status !== "done");
  }, [myTasks]);

  const imminentMeeting = useMemo(() => {
    const now = Date.now();
    const cutoff = now + 60 * 60 * 1000;
    return (
      upcomingEvents.find((ev) => {
        const t = new Date(ev.start_time).getTime();
        return t >= now && t <= cutoff;
      }) ?? null
    );
  }, [upcomingEvents]);

  const minutesUntilMeeting = imminentMeeting
    ? Math.max(0, Math.round((new Date(imminentMeeting.start_time).getTime() - Date.now()) / 60000))
    : 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const totalAUM = households.reduce((sum, h) => sum + Number(h.total_aum), 0);
  const totalHouseholds = households.length;
  const activeHouseholds = households.filter((h) => h.status === "Active").length;

  const upcomingReviews = households
    .filter((h) => {
      if (!h.annual_review_date) return false;
      const d = new Date(h.annual_review_date);
      const now = new Date();
      const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 60;
    })
    .sort((a, b) => new Date(a.annual_review_date!).getTime() - new Date(b.annual_review_date!).getTime());

  const firstName = impersonatedUser?.name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "Advisor";

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const [editMode, setEditMode] = useState(false);
  const [localLayout, setLocalLayout] = useState<WidgetInstance[]>([]);
  const { layout, saveLayout, resetLayout, isSaving } = useDashboardLayout();
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleEnterEdit = useCallback(() => {
    setLocalLayout([...layout]);
    setEditMode(true);
  }, [layout]);

  const handleSaveAndExit = useCallback(async () => {
    await saveLayout(localLayout);
    setEditMode(false);
  }, [localLayout, saveLayout]);

  const handleResetLayout = useCallback(() => {
    setLocalLayout([...DEFAULT_LAYOUT]);
  }, []);

  const handleRemoveWidget = useCallback((instanceId: string) => {
    setLocalLayout((prev) => prev.filter((w) => w.id !== instanceId));
  }, []);

  const handleToggleSize = useCallback((instanceId: string) => {
    setLocalLayout((prev) =>
      prev.map((w) => {
        if (w.id !== instanceId) return w;
        const def = WIDGET_REGISTRY.find((d) => d.id === w.widgetId);
        if (!def || def.allowedSizes.length < 2) return w;
        const newSize: WidgetSize = w.size === "small" ? "large" : "small";
        return { ...w, size: newSize };
      }),
    );
  }, []);

  const handleAddWidget = useCallback((widgetId: string) => {
    const def = WIDGET_REGISTRY.find((d) => d.id === widgetId);
    if (!def) return;
    const newInstance: WidgetInstance = {
      id: `${widgetId}-${Date.now()}`,
      widgetId,
      size: def.defaultSize,
    };
    setLocalLayout((prev) => [...prev, newInstance]);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalLayout((prev) => {
        const oldIndex = prev.findIndex((w) => w.id === active.id);
        const newIndex = prev.findIndex((w) => w.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const activeLayout = editMode ? localLayout : layout;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-secondary rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className={cn("min-w-0", firmAccent && "pl-4 border-l-2")} style={firmAccent ? { borderColor: firmAccent } : undefined}>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Good {timeOfDay}, {firstName}</h1>
          <p className="text-muted-foreground mt-1">Here's your practice overview for today.</p>
        </div>

        <div className="flex items-center gap-2 self-start">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={handleResetLayout} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSaveAndExit} className="gap-2">
                <Check className="w-4 h-4" />
                {isSaving ? "Saving..." : "Done"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleEnterEdit} className="gap-2">
              <Settings2 className="w-4 h-4" />
              Customize
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/40 mb-6",
          firmAccent && "border-l-[3px]",
        )}
        style={firmAccent ? { borderColor: firmAccent } : undefined}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setLogNoteOpen(true)}>
            <FileText className="w-4 h-4 mr-1.5" />
            Log a Note
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/calendar")}>
            <CalendarDays className="w-4 h-4 mr-1.5" />
            Schedule Meeting
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreateHouseholdOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Household
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssistOpen(true)}>
            <HelpCircle className="w-4 h-4 mr-1.5" />
            Request GL Assistance
          </Button>
          {vpmStatus?.isVpm && (
            <Button variant="outline" size="sm" onClick={() => setVpmOpen(true)} className="gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              {vpmStatus.isPrimePartner ? "VPM Support ⭐" : "VPM Support"}
            </Button>
          )}
        </div>
        {openRequests.length > 0 && (
          <Link
            to="/my-requests"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 transition-colors shrink-0"
          >
            <TicketCheck className="w-3.5 h-3.5" />
            {openRequests.length} open {openRequests.length === 1 ? "request" : "requests"}
          </Link>
        )}
      </div>

      {imminentMeeting && (
        <Card className="mb-6 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/10 shadow-none">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                    Starting Soon
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{imminentMeeting.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(imminentMeeting.households?.name ||
                      (imminentMeeting.prospects
                        ? `${imminentMeeting.prospects.first_name} ${imminentMeeting.prospects.last_name}`
                        : null)) || "No client linked"}
                    {" · "}
                    {minutesUntilMeeting === 0
                      ? "Starting now"
                      : `In ${minutesUntilMeeting} ${minutesUntilMeeting === 1 ? "minute" : "minutes"}`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => imminentMeeting && startSession(imminentMeeting)}
                disabled={!imminentMeeting.household_id && !imminentMeeting.prospect_id}
              >
                Start Session
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeLayout.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min">
            {activeLayout.map((instance) => (
              <SortableWidget
                key={instance.id}
                instance={instance}
                editMode={editMode}
                onRemove={handleRemoveWidget}
                onToggleSize={handleToggleSize}
              >
                <WidgetRenderer
                  instance={instance}
                  households={households as any}
                  recentNotes={recentNotes as any}
                  upcomingEvents={upcomingEvents as any}
                  pendingTasks={allPendingTasks as any}
                  prospects={prospects as any}
                  firstName={firstName}
                  userId={user?.id || "anonymous"}
                  firmAccentColor={firmAccentColor}
                  totalAUM={totalAUM}
                  totalHouseholds={totalHouseholds}
                  activeHouseholds={activeHouseholds}
                  upcomingReviews={upcomingReviews as any}
                />
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editMode && (
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="mt-4 w-full border-2 border-dashed border-border rounded-lg py-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Widget
        </button>
      )}

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add Widgets</SheetTitle>
          </SheetHeader>

          <div className="mt-6 grid gap-3">
            {WIDGET_REGISTRY.map((def) => {
              const Icon = def.icon;
              const isOnDashboard = localLayout.some((w) => w.widgetId === def.id);
              return (
                <button
                  key={def.id}
                  type="button"
                  className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-secondary/50 disabled:opacity-60"
                  disabled={isOnDashboard}
                  onClick={() => {
                    if (!isOnDashboard) {
                      handleAddWidget(def.id);
                      setLibraryOpen(false);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{def.label}</p>
                        {isOnDashboard && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{def.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <RequestAssistanceDialog open={assistOpen} onOpenChange={setAssistOpen} />
      <VpmRequestDialog open={vpmOpen} onOpenChange={setVpmOpen} />
      <QuickLogNoteDialog open={logNoteOpen} onOpenChange={setLogNoteOpen} />
      <CreateHouseholdDialog
        open={createHouseholdOpen}
        onOpenChange={(open) => {
          setCreateHouseholdOpen(open);
          if (!open) queryClient.invalidateQueries({ queryKey: ["households"] });
        }}
      />
    </div>
  );
}
