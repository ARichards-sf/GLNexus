import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Search,
  MoreHorizontal,
  Edit,
  ArrowRight,
  XCircle,
  UserCheck,
  Trash2,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  PIPELINE_STAGES,
  PROSPECT_SOURCES,
  Prospect,
  useProspects,
  useUpdateProspect,
  useDeleteProspect,
  useConvertProspect,
} from "@/hooks/useProspects";
import { formatCurrency } from "@/data/sampleData";
import AddProspectDialog from "@/components/AddProspectDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function getInitials(first: string, last: string): string {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase();
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [lostDialog, setLostDialog] = useState<{ prospect: Prospect | null }>({
    prospect: null,
  });
  const [lostReason, setLostReason] = useState("");

  const { data: prospects = [], isLoading } = useProspects(showAll);

  const updateMut = useUpdateProspect();
  const deleteMut = useDeleteProspect();
  const convertMut = useConvertProspect();

  const activeProspects = useMemo(
    () =>
      prospects.filter(
        (p) => p.pipeline_stage !== "converted" && p.pipeline_stage !== "lost"
      ),
    [prospects]
  );

  const totalEstimatedAum = useMemo(
    () => activeProspects.reduce((s, p) => s + (Number(p.estimated_aum) || 0), 0),
    [activeProspects]
  );

  const stageStats = useMemo(() => {
    const stats: Record<ActiveStage, { count: number; aum: number }> = {
      lead: { count: 0, aum: 0 },
      contacted: { count: 0, aum: 0 },
      meeting_scheduled: { count: 0, aum: 0 },
      discovery_complete: { count: 0, aum: 0 },
      proposal_sent: { count: 0, aum: 0 },
    };
    for (const p of activeProspects) {
      const s = p.pipeline_stage as ActiveStage;
      if (stats[s]) {
        stats[s].count += 1;
        stats[s].aum += Number(p.estimated_aum) || 0;
      }
    }
    return stats;
  }, [activeProspects]);

  const filtered = useMemo(() => {
    let result = [...prospects];

    if (stageFilter !== "all") {
      result = result.filter((p) => p.pipeline_stage === stageFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((p) => p.source === sourceFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.company || "").toLowerCase().includes(q) ||
          (p.email || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [prospects, stageFilter, sourceFilter, search]);

  const handleAdvanceStage = async (prospect: Prospect) => {
    const next = NEXT_STAGE[prospect.pipeline_stage as ActiveStage];
    if (!next) return;
    try {
      await updateMut.mutateAsync({
        id: prospect.id,
        updates: { pipeline_stage: next },
      });
      toast.success(
        `Moved to ${PIPELINE_STAGES.find((s) => s.key === next)?.label}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to advance stage");
    }
  };

  const handleMarkLost = async () => {
    if (!lostDialog.prospect) return;
    try {
      await updateMut.mutateAsync({
        id: lostDialog.prospect.id,
        updates: {
          pipeline_stage: "lost",
          lost_reason: lostReason.trim() || null,
        },
      });
      toast.success("Marked as lost");
      setLostDialog({ prospect: null });
      setLostReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to mark as lost");
    }
  };

  const handleConvert = async (prospect: Prospect) => {
    try {
      const { householdId } = await convertMut.mutateAsync(prospect);
      toast.success("Converted to client");
      navigate(`/household/${householdId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to convert");
    }
  };

  const handleDelete = async (prospect: Prospect) => {
    if (!confirm(`Delete prospect "${prospect.first_name} ${prospect.last_name}"?`)) {
      return;
    }
    try {
      await deleteMut.mutateAsync(prospect.id);
      toast.success("Prospect deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const stageMeta = (key: string) =>
    PIPELINE_STAGES.find((s) => s.key === key);

  const isEmpty = !isLoading && prospects.length === 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div
          className="pl-4 border-l-2"
          style={{ borderColor: "var(--firm-accent, hsl(var(--primary)))" }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Pipeline</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {activeProspects.length} active prospects ·{" "}
            {formatCurrency(totalEstimatedAum)} estimated AUM
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Prospect
        </Button>
      </div>

      {isEmpty ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">No prospects yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first prospect to start building your pipeline
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Prospect
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Stage stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {ACTIVE_STAGES.map((key) => {
              const meta = stageMeta(key)!;
              const stat = stageStats[key];
              const isSelected = stageFilter === key;
              return (
                <button
                  key={key}
                  onClick={() =>
                    setStageFilter(isSelected ? "all" : key)
                  }
                  className={cn(
                    "text-left rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-accent/30",
                    isSelected && "border-primary bg-accent/40"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {meta.label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold">
                      {stat.count}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stat.aum > 0 ? formatCurrency(stat.aum) : "—"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, company, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {(showAll
                  ? PIPELINE_STAGES
                  : PIPELINE_STAGES.filter(
                      (s) => s.key !== "converted" && s.key !== "lost"
                    )
                ).map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {PROSPECT_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="show-all"
                checked={showAll}
                onCheckedChange={(v) => {
                  setShowAll(v);
                  if (
                    !v &&
                    (stageFilter === "converted" || stageFilter === "lost")
                  ) {
                    setStageFilter("all");
                  }
                }}
              />
              <Label htmlFor="show-all" className="text-sm cursor-pointer">
                Show Converted & Lost
              </Label>
            </div>
          </div>

          {/* Prospect list */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Est. AUM</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No prospects match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const meta = stageMeta(p.pipeline_stage)!;
                    const canConvert =
                      p.pipeline_stage === "discovery_complete" ||
                      p.pipeline_stage === "proposal_sent";
                    const nextStage =
                      NEXT_STAGE[p.pipeline_stage as ActiveStage];
                    const isClosed =
                      p.pipeline_stage === "converted" ||
                      p.pipeline_stage === "lost";
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/prospects/${p.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(p.first_name, p.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {p.first_name} {p.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {p.company || "—"}
                                {p.referred_by && (
                                  <span className="ml-2 italic">
                                    via {p.referred_by}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn("font-normal", meta.color)}
                          >
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.source ? (
                            <Badge variant="secondary" className="font-normal">
                              {SOURCE_LABELS[p.source] || p.source}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {p.estimated_aum
                            ? formatCurrency(Number(p.estimated_aum))
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatRelativeTime(p.created_at)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => navigate(`/prospects/${p.id}`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {nextStage && !isClosed && (
                                <DropdownMenuItem
                                  onClick={() => handleAdvanceStage(p)}
                                >
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Move to{" "}
                                  {
                                    PIPELINE_STAGES.find(
                                      (s) => s.key === nextStage
                                    )?.label
                                  }
                                </DropdownMenuItem>
                              )}
                              {canConvert && (
                                <DropdownMenuItem
                                  onClick={() => handleConvert(p)}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Convert to Client
                                </DropdownMenuItem>
                              )}
                              {!isClosed && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setLostDialog({ prospect: p })
                                  }
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Mark as Lost
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(p)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Mark as Lost Dialog */}
      <Dialog
        open={!!lostDialog.prospect}
        onOpenChange={(open) => {
          if (!open) {
            setLostDialog({ prospect: null });
            setLostReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Lost</DialogTitle>
            <DialogDescription>
              Why did{" "}
              {lostDialog.prospect &&
                `${lostDialog.prospect.first_name} ${lostDialog.prospect.last_name}`}{" "}
              not become a client?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lostReason">Reason (optional)</Label>
            <Textarea
              id="lostReason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Went with competitor, timing not right..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLostDialog({ prospect: null });
                setLostReason("");
              }}
            >
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

      {/* Add Prospect Dialog */}
      <AddProspectDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
