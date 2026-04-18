import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Edit,
  Mail,
  MoreHorizontal,
  Phone,
  Trash2,
  TrendingUp,
  UserCheck,
  XCircle,
  CalendarPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PIPELINE_STAGES,
  PROSPECT_SOURCES,
  Prospect,
  useConvertProspect,
  useDeleteProspect,
  useProspect,
  useUpdateProspect,
} from "@/hooks/useProspects";
import { formatCurrency } from "@/data/sampleData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ScheduleEventDialog from "@/components/ScheduleEventDialog";

const SOURCE_LABELS: Record<string, string> = {
  referral: "Referral",
  event: "Event",
  cold_outreach: "Cold Outreach",
  social_media: "Social Media",
  existing_client: "Existing Client",
  other: "Other",
};

const ACTIVE_STAGES = [
  "lead",
  "contacted",
  "meeting_scheduled",
  "discovery_complete",
  "proposal_sent",
] as const;

type ActiveStage = (typeof ACTIVE_STAGES)[number];

const NEXT_STAGE: Record<ActiveStage, ActiveStage | null> = {
  lead: "contacted",
  contacted: "meeting_scheduled",
  meeting_scheduled: "discovery_complete",
  discovery_complete: "proposal_sent",
  proposal_sent: null,
};

function getInitials(first: string, last: string): string {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function useConvertedHousehold(householdId: string | null) {
  return useQuery({
    queryKey: ["household_name", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("id, name")
        .eq("id", householdId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

function useProspectEvents(prospect: Prospect | undefined) {
  const fullName = prospect
    ? `${prospect.first_name} ${prospect.last_name}`
    : "";
  return useQuery({
    queryKey: ["prospect_events", prospect?.id, fullName],
    enabled: !!prospect,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .or(`title.ilike.%${fullName}%,description.ilike.%${fullName}%`)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export default function ProspectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: prospect, isLoading } = useProspect(id);
  const updateMut = useUpdateProspect();
  const deleteMut = useDeleteProspect();
  const convertMut = useConvertProspect();

  const { data: convertedHousehold } = useConvertedHousehold(
    prospect?.converted_household_id ?? null
  );
  const { data: events = [] } = useProspectEvents(prospect);

  const [editOpen, setEditOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const stageMeta = useMemo(
    () =>
      prospect
        ? PIPELINE_STAGES.find((s) => s.key === prospect.pipeline_stage)
        : null,
    [prospect]
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Card className="p-12 text-center">
          <h2 className="text-lg font-semibold">Prospect not found</h2>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/pipeline")}
          >
            Back to Pipeline
          </Button>
        </Card>
      </div>
    );
  }

  const isClosed =
    prospect.pipeline_stage === "converted" ||
    prospect.pipeline_stage === "lost";
  const canConvert =
    prospect.pipeline_stage === "discovery_complete" ||
    prospect.pipeline_stage === "proposal_sent";
  const nextStage = NEXT_STAGE[prospect.pipeline_stage as ActiveStage];

  const currentStageIndex = ACTIVE_STAGES.indexOf(
    prospect.pipeline_stage as ActiveStage
  );

  const handleAdvance = async () => {
    if (!nextStage) return;
    try {
      await updateMut.mutateAsync({
        id: prospect.id,
        updates: { pipeline_stage: nextStage },
      });
      toast.success(
        `Advanced to ${PIPELINE_STAGES.find((s) => s.key === nextStage)?.label}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to advance");
    }
  };

  const handleConvert = async () => {
    try {
      const { householdId } = await convertMut.mutateAsync(prospect);
      toast.success("Converted to client");
      navigate(`/household/${householdId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to convert");
    }
  };

  const handleMarkLost = async () => {
    try {
      await updateMut.mutateAsync({
        id: prospect.id,
        updates: {
          pipeline_stage: "lost",
          lost_reason: lostReason.trim() || null,
        },
      });
      toast.success("Marked as lost");
      setLostOpen(false);
      setLostReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${prospect.first_name} ${prospect.last_name}?`)) return;
    try {
      await deleteMut.mutateAsync(prospect.id);
      toast.success("Prospect deleted");
      navigate("/pipeline");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const upcomingEvents = events.filter(
    (e: any) => new Date(e.start_time) >= new Date()
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/pipeline")}
        className="-ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Pipeline
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {getInitials(prospect.first_name, prospect.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight">
              {prospect.first_name} {prospect.last_name}
            </h1>
            {(prospect.company || prospect.job_title) && (
              <p className="text-sm text-muted-foreground">
                {[prospect.job_title, prospect.company]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {stageMeta && (
                <Badge
                  variant="secondary"
                  className={cn("font-normal", stageMeta.color)}
                >
                  {stageMeta.label}
                </Badge>
              )}
              {prospect.source && (
                <Badge variant="secondary" className="font-normal">
                  {SOURCE_LABELS[prospect.source] || prospect.source}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          {canConvert && (
            <Button
              onClick={handleConvert}
              disabled={convertMut.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Convert to Client
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isClosed && (
                <DropdownMenuItem onClick={() => setLostOpen(true)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Mark as Lost
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pipeline stepper — only when not lost */}
      {prospect.pipeline_stage !== "lost" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              {ACTIVE_STAGES.map((stage, idx) => {
                const meta = PIPELINE_STAGES.find((s) => s.key === stage)!;
                const isComplete =
                  prospect.pipeline_stage === "converted" ||
                  idx < currentStageIndex;
                const isCurrent =
                  idx === currentStageIndex &&
                  prospect.pipeline_stage !== "converted";
                return (
                  <div
                    key={stage}
                    className="flex-1 flex flex-col items-center text-center min-w-0"
                  >
                    <div className="flex items-center w-full">
                      <div
                        className={cn(
                          "flex-1 h-0.5",
                          idx === 0 ? "invisible" : "",
                          isComplete || isCurrent
                            ? "bg-primary"
                            : "bg-border"
                        )}
                      />
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2",
                          isComplete &&
                            "bg-primary border-primary text-primary-foreground",
                          isCurrent &&
                            "bg-primary/10 border-primary text-primary ring-4 ring-primary/10",
                          !isComplete &&
                            !isCurrent &&
                            "bg-background border-border text-muted-foreground"
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex-1 h-0.5",
                          idx === ACTIVE_STAGES.length - 1 ? "invisible" : "",
                          isComplete ? "bg-primary" : "bg-border"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-2 truncate w-full",
                        isCurrent
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {nextStage && !isClosed && (
              <div className="mt-6 flex justify-center">
                <Button onClick={handleAdvance} disabled={updateMut.isPending}>
                  Advance to{" "}
                  {PIPELINE_STAGES.find((s) => s.key === nextStage)?.label}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lost banner */}
      {prospect.pipeline_stage === "lost" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Marked as Lost</p>
              {prospect.lost_reason && (
                <p className="text-sm text-muted-foreground mt-1">
                  {prospect.lost_reason}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversion card */}
      {prospect.pipeline_stage === "converted" && (
        <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Converted to Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Converted on {formatDate(prospect.converted_at)}
            </p>
            {convertedHousehold && (
              <Link
                to={`/household/${convertedHousehold.id}`}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                View {convertedHousehold.name}
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prospect Details */}
      <Card>
        <CardHeader>
          <CardTitle>Prospect Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <DetailRow label="Email">
              {prospect.email ? (
                <a
                  href={`mailto:${prospect.email}`}
                  className="text-primary hover:underline"
                >
                  {prospect.email}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Phone">
              {prospect.phone ? (
                <a
                  href={`tel:${prospect.phone}`}
                  className="text-primary hover:underline"
                >
                  {prospect.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Company">
              {prospect.company || (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Job Title">
              {prospect.job_title || (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Estimated AUM">
              {prospect.estimated_aum ? (
                formatCurrency(Number(prospect.estimated_aum))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Source">
              {prospect.source ? (
                SOURCE_LABELS[prospect.source] || prospect.source
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            {prospect.referred_by && (
              <DetailRow label="Referred By">{prospect.referred_by}</DetailRow>
            )}
            <DetailRow label="Added">{formatDate(prospect.created_at)}</DetailRow>
            {prospect.notes && (
              <div className="md:col-span-2 space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Notes
                </dt>
                <dd className="text-sm whitespace-pre-wrap">
                  {prospect.notes}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Activity</CardTitle>
          {upcomingEvents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScheduleOpen(true)}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <p className="text-sm text-muted-foreground">
                No meetings scheduled
              </p>
              <Button onClick={() => setScheduleOpen(true)}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {upcomingEvents.map((e: any) => (
                <li
                  key={e.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className="font-normal">
                      {e.event_type}
                    </Badge>
                    <span className="font-medium truncate">{e.title}</span>
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {new Date(e.start_time).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {new Date(e.start_time).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      <EditProspectSheet
        prospect={prospect}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Mark as Lost Dialog */}
      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Lost</DialogTitle>
            <DialogDescription>
              Why did {prospect.first_name} {prospect.last_name} not become a
              client?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lostReason">Reason (optional)</Label>
            <Textarea
              id="lostReason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleMarkLost}
              disabled={updateMut.isPending}
            >
              Mark as Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule meeting dialog */}
      <ScheduleEventDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultTitle={`Meeting with ${prospect.first_name} ${prospect.last_name}`}
        defaultEventType="Discovery Call"
      />
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function EditProspectSheet({
  prospect,
  open,
  onOpenChange,
}: {
  prospect: Prospect;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMut = useUpdateProspect();

  const [firstName, setFirstName] = useState(prospect.first_name);
  const [lastName, setLastName] = useState(prospect.last_name);
  const [email, setEmail] = useState(prospect.email || "");
  const [phone, setPhone] = useState(prospect.phone || "");
  const [company, setCompany] = useState(prospect.company || "");
  const [jobTitle, setJobTitle] = useState(prospect.job_title || "");
  const [stage, setStage] = useState<string>(prospect.pipeline_stage);
  const [source, setSource] = useState<string>(prospect.source || "");
  const [estimatedAum, setEstimatedAum] = useState(
    prospect.estimated_aum ? String(prospect.estimated_aum) : ""
  );
  const [referredBy, setReferredBy] = useState(prospect.referred_by || "");
  const [notes, setNotes] = useState(prospect.notes || "");

  // Reset when sheet opens with a new prospect
  useMemo(() => {
    if (open) {
      setFirstName(prospect.first_name);
      setLastName(prospect.last_name);
      setEmail(prospect.email || "");
      setPhone(prospect.phone || "");
      setCompany(prospect.company || "");
      setJobTitle(prospect.job_title || "");
      setStage(prospect.pipeline_stage);
      setSource(prospect.source || "");
      setEstimatedAum(
        prospect.estimated_aum ? String(prospect.estimated_aum) : ""
      );
      setReferredBy(prospect.referred_by || "");
      setNotes(prospect.notes || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prospect.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: prospect.id,
        updates: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          company: company.trim() || null,
          job_title: jobTitle.trim() || null,
          pipeline_stage: stage as Prospect["pipeline_stage"],
          source: source || null,
          estimated_aum: estimatedAum ? Number(estimatedAum) : null,
          referred_by:
            source === "referral" && referredBy.trim()
              ? referredBy.trim()
              : null,
          notes: notes.trim() || null,
        },
      });
      toast.success("Prospect updated");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Prospect</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ef">First Name</Label>
              <Input
                id="ef"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el">Last Name</Label>
              <Input
                id="el"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ee">Email</Label>
              <Input
                id="ee"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep">Phone</Label>
              <Input
                id="ep"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ec">Company</Label>
              <Input
                id="ec"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ej">Job Title</Label>
              <Input
                id="ej"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="es">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger id="es">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eso">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="eso">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ea">Estimated AUM</Label>
              <Input
                id="ea"
                type="number"
                min="0"
                value={estimatedAum}
                onChange={(e) => setEstimatedAum(e.target.value)}
              />
            </div>
            {source === "referral" && (
              <div className="space-y-2">
                <Label htmlFor="er">Referred By</Label>
                <Input
                  id="er"
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="en">Notes</Label>
            <Textarea
              id="en"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <SheetFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMut.isPending}>
              {updateMut.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
