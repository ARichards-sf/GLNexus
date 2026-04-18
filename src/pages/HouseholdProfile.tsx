import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarCheck, AlertTriangle, CalendarPlus, MoreHorizontal, Archive,
  ArrowRightLeft, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, DollarSign, Shield, Target, Users, Mail, Phone,
  FileText, Lightbulb, UserPlus, Briefcase, Plus, Lock, Search, HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useHousehold, useHouseholdMembers, useComplianceNotes, useHouseholdSnapshots,
  useAccountSnapshots, useArchiveHousehold,
  useArchiveContact, useArchivedHouseholdMembers,
  type MemberRow,
} from "@/hooks/useHouseholds";
import { useDeleteAccount } from "@/hooks/useContacts";
import { useHouseholdAccounts } from "@/hooks/useHouseholdAccounts";
import { formatFullCurrency, formatCurrency } from "@/data/sampleData";
import AddMemberDialog from "@/components/AddMemberDialog";
import AddComplianceNoteDialog from "@/components/AddComplianceNoteDialog";
import QuickScheduleReviewDialog from "@/components/QuickScheduleReviewDialog";
import RequestAssistanceDialog from "@/components/RequestAssistanceDialog";
import ReparentContactDialog from "@/components/ReparentContactDialog";

const noteTypeColors: Record<string, string> = {
  Prospecting: "bg-amber-muted text-amber",
  Review: "bg-emerald-muted text-emerald",
  Service: "bg-secondary text-muted-foreground",
  Compliance: "bg-secondary text-muted-foreground",
  Onboarding: "bg-emerald-muted text-emerald",
};

const riskColors: Record<string, string> = {
  Conservative: "text-muted-foreground",
  Moderate: "text-foreground",
  "Moderate-Aggressive": "text-amber",
  Aggressive: "text-destructive",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(330, 81%, 60%)",
];

function AccountSparkline({ data }: { data: { date: string; balance: number }[] }) {
  if (data.length < 2) return <span className="text-[10px] text-muted-foreground">—</span>;
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Compute the next Tuesday or Wednesday at 10:00 AM from today */
function getNextAdvisorSlot(): { date: string; startTime: string; endTime: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  // days until next Tue(2) or Wed(3)
  let daysUntilTue = (2 - day + 7) % 7 || 7;
  let daysUntilWed = (3 - day + 7) % 7 || 7;
  const daysAhead = Math.min(daysUntilTue, daysUntilWed);
  const target = new Date(now);
  target.setDate(target.getDate() + daysAhead);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, startTime: "10:00", endTime: "11:00" };
}

function AnnualReviewWidget({
  annualReviewDate,
  lastReviewDate,
  onSchedule,
}: {
  annualReviewDate: string | null;
  lastReviewDate: string | null;
  onSchedule: () => void;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const isScheduled = annualReviewDate && new Date(annualReviewDate) > new Date();
  const isOverdue =
    lastReviewDate && (Date.now() - new Date(lastReviewDate).getTime()) / (1000 * 60 * 60 * 24 * 365) > 1;
  const isNotSet = !annualReviewDate && !lastReviewDate;
  const isClickable = !isScheduled && (isOverdue || isNotSet || !annualReviewDate);

  const icon =
    isNotSet || isOverdue ? (
      <CalendarPlus className="w-4 h-4 text-muted-foreground" />
    ) : (
      <Target className="w-4 h-4 text-muted-foreground" />
    );

  return (
    <Card
      className={`border-border shadow-none transition-all ${
        isClickable ? "cursor-pointer hover:scale-[1.02] hover:border-primary/40 hover:shadow-md" : ""
      }`}
      onClick={isClickable ? onSchedule : undefined}
    >
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-sm text-muted-foreground font-medium">Annual Review</span>
        </div>
        {isScheduled ? (
          <div>
            <p className="text-2xl font-semibold tracking-tight text-blue-600">
              Scheduled: {fmt(annualReviewDate!)}
            </p>
            {lastReviewDate && (
              <p className="text-xs text-muted-foreground mt-1">Last review: {fmt(lastReviewDate)}</p>
            )}
          </div>
        ) : isOverdue || isNotSet ? (
          <div>
            <p className="text-2xl font-semibold tracking-tight text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> {isNotSet ? "Not set" : "Overdue"}
            </p>
            {lastReviewDate && (
              <p className="text-xs text-muted-foreground mt-1">Last review: {fmt(lastReviewDate)}</p>
            )}
            <p className="text-xs text-primary mt-1.5 font-medium">Click to schedule →</p>
          </div>
        ) : (
          <p className="text-2xl font-semibold tracking-tight text-emerald-600">
            Last Review: {fmt(lastReviewDate!)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function HouseholdProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: household, isLoading } = useHousehold(id);
  const { data: members = [] } = useHouseholdMembers(id);
  const { data: archivedMembers = [] } = useArchivedHouseholdMembers(id);
  const { data: notes = [] } = useComplianceNotes(id);
  const { data: accounts = [] } = useHouseholdAccounts(id);
  const { data: hhSnapshots = [] } = useHouseholdSnapshots(id);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [deleteHouseholdOpen, setDeleteHouseholdOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Reparent + archive contact state
  const [reparentMember, setReparentMember] = useState<MemberRow | null>(null);
  const [reparentOpen, setReparentOpen] = useState(false);
  const [archiveMember, setArchiveMember] = useState<MemberRow | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Account close/archive state
  const [closeAccountId, setCloseAccountId] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [archiveAccountId, setArchiveAccountId] = useState<string | null>(null);

  const archiveHousehold = useArchiveHousehold();
  const archiveContact = useArchiveContact();
  const deleteAccount = useDeleteAccount();

  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const { data: accSnapshots = [] } = useAccountSnapshots(accountIds);

  const filteredNotes = useMemo(() => {
    if (!noteSearch.trim()) return notes;
    const q = noteSearch.toLowerCase();
    return notes.filter(
      (n) => n.summary.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    );
  }, [notes, noteSearch]);

  const totalAccountsAUM = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  // AUM trend chart data
  const aumChartData = useMemo(() => {
    return hhSnapshots.map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      aum: Number(s.total_aum),
    }));
  }, [hhSnapshots]);

  // Asset allocation pie data
  const allocationData = useMemo(() => {
    const byType: Record<string, number> = {};
    accounts.forEach((a) => {
      const t = a.account_type || "Other";
      byType[t] = (byType[t] || 0) + Number(a.balance);
    });
    return Object.entries(byType)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [accounts]);

  // Account sparkline data map
  const accountSparkData = useMemo(() => {
    const map: Record<string, { date: string; balance: number }[]> = {};
    accSnapshots.forEach((s) => {
      if (!map[s.account_id]) map[s.account_id] = [];
      map[s.account_id].push({
        date: s.snapshot_date,
        balance: Number(s.balance),
      });
    });
    // Keep last 30 entries per account
    Object.keys(map).forEach((k) => {
      map[k] = map[k].slice(-30);
    });
    return map;
  }, [accSnapshots]);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-secondary rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Household not found.</p>
        <Link to="/households" className="text-sm text-foreground underline mt-2 inline-block">Back to Households</Link>
      </div>
    );
  }

  const memberAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Link to="/households" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Households
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{household.name}</h1>
            <p className="text-muted-foreground mt-1">{household.investment_objective}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssistOpen(true)}>
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Request GL Assistance
            </Button>
            <Badge variant="secondary" className="text-xs font-medium">{household.status}</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Total Assets</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-emerald-600">{formatFullCurrency(totalAccountsAUM)}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Risk Tolerance</span>
            </div>
            <p className={`text-2xl font-semibold tracking-tight ${riskColors[household.risk_tolerance] || "text-foreground"}`}>{household.risk_tolerance}</p>
          </CardContent>
        </Card>
        <AnnualReviewWidget
          annualReviewDate={household.annual_review_date}
          lastReviewDate={household.last_review_date}
          onSchedule={() => setScheduleOpen(true)}
        />
      </div>

      {/* Charts Row: AUM Trend + Asset Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
        <Card className="lg:col-span-3 border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">AUM Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {aumChartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={aumChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11 }} className="fill-muted-foreground" width={70} />
                  <Tooltip
                    formatter={(value: number) => [formatFullCurrency(value), "AUM"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Line type="monotone" dataKey="aum" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                Not enough snapshot data yet. Generate snapshots to see trends.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatFullCurrency(value)}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend
                    formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                No accounts to display.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Next Action */}
      {household.next_action && (
        <Card className="border-emerald/30 bg-emerald-muted/50 shadow-none mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald/10 flex items-center justify-center shrink-0">
                <Lightbulb className="w-4.5 h-4.5 text-emerald" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">Next Best Action</h3>
                  {household.next_action_date && (
                    <span className="text-xs text-muted-foreground">
                      Due {new Date(household.next_action_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{household.next_action}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 text-xs">Mark Complete</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Layout */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="notes">Notes & Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card className="border-border shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Family Members</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAddMemberOpen(true)}>
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="relative p-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors group"
                >
                  <Link to={`/contacts/${member.id}`} className="block">
                    <div className="flex items-center justify-between mb-1 pr-8">
                      <p className="text-sm font-medium text-foreground hover:underline">{member.first_name} {member.last_name}</p>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{member.relationship}</Badge>
                    </div>
                    {member.date_of_birth && <p className="text-xs text-muted-foreground">Age {memberAge(member.date_of_birth)}</p>}
                    {member.email && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{member.phone}</span>
                      </div>
                    )}
                  </Link>
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/contacts/${member.id}`)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setReparentMember(member);
                            setReparentOpen(true);
                          }}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Move to Another Household
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setArchiveMember(member);
                            setArchiveOpen(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Archive className="w-3.5 h-3.5 mr-2" /> Archive Contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No members added yet.</p>}

              {/* Archived Contacts collapsible */}
              {archivedMembers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    {showArchived ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {archivedMembers.length} archived contact{archivedMembers.length !== 1 ? "s" : ""}
                  </button>

                  {showArchived && (
                    <div className="mt-3 space-y-2">
                      {archivedMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 opacity-60"
                        >
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {m.first_name} {m.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Archived {m.archived_at ? new Date(m.archived_at).toLocaleDateString() : "—"}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            Archived
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card className="border-border shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Household Accounts</CardTitle>
                </div>
                {accounts.length > 0 && (
                  <span className="text-sm font-semibold text-foreground">{formatFullCurrency(totalAccountsAUM)}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {accounts.length > 0 ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Institution</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">30d Trend</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((a) => (
                        <TableRow
                          key={a.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors group"
                          onClick={() => navigate(`/accounts/${a.id}`)}
                        >
                          <TableCell className="text-sm font-medium text-foreground">{a.account_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{a.account_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{(a as any).owner_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{a.institution || "—"}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-emerald-600">{formatCurrency(Number(a.balance))}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <AccountSparkline data={accountSparkData[a.id] || []} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCloseReason("");
                                    setCloseAccountId(a.id);
                                  }}
                                >
                                  <X className="w-3.5 h-3.5 mr-2" /> Close Account
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setArchiveAccountId(a.id)}>
                                  <Archive className="w-3.5 h-3.5 mr-2" /> Archive Account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No accounts linked to this household yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card className="border-border shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Compliance Log</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAddNoteOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
                </Button>
              </div>
              {notes.length > 0 && (
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search notes..."
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="relative">
                {filteredNotes.length > 0 && <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />}
                <div className="space-y-6">
                  {filteredNotes.map((note) => {
                    const isLocked = Date.now() - new Date(note.created_at).getTime() > 24 * 60 * 60 * 1000;
                    return (
                      <div key={note.id} className="flex gap-4 relative">
                        <div className="w-[31px] flex justify-center shrink-0 z-10">
                          <div className="w-2.5 h-2.5 rounded-full bg-border mt-1.5 ring-4 ring-card" />
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${noteTypeColors[note.type] || ""}`}>
                              {note.type}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(note.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            {isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{note.summary}</p>
                          {note.advisor_name && <p className="text-[11px] text-muted-foreground mt-1.5">— {note.advisor_name}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {notes.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No compliance notes yet.</p>}
              {notes.length > 0 && filteredNotes.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No notes match your search.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Archive Household</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Removes this household from your active book. All data is retained for compliance.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/5 shrink-0"
            onClick={() => setDeleteHouseholdOpen(true)}
          >
            <Archive className="w-3.5 h-3.5 mr-1.5" />
            Archive Household
          </Button>
        </div>
      </div>

      <AddMemberDialog open={addMemberOpen} onOpenChange={setAddMemberOpen} householdId={household.id} />
      <AddComplianceNoteDialog open={addNoteOpen} onOpenChange={setAddNoteOpen} householdId={household.id} />
      <QuickScheduleReviewDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        householdId={household.id}
        householdName={household.name}
      />
      <RequestAssistanceDialog
        open={assistOpen}
        onOpenChange={setAssistOpen}
        context={{
          householdName: household.name,
          householdAum: Number(household.total_aum),
          householdId: household.id,
        }}
      />

      {/* Archive Household Confirmation */}
      <AlertDialog open={deleteHouseholdOpen} onOpenChange={setDeleteHouseholdOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {household.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This household will be removed from your active book of business. All compliance notes,
              accounts, and client data will be retained as required by regulations. You can view
              archived households in Reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await archiveHousehold.mutateAsync({ householdId: household.id });
                  toast.success(`${household.name} has been archived`);
                  navigate("/households");
                } catch (e: any) {
                  toast.error(e?.message || "Failed to archive household");
                }
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Archive Contact Confirmation */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {archiveMember?.first_name} {archiveMember?.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This contact will be archived and hidden from your active view. Their history will be
              retained for compliance. You can view archived contacts in the household profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!archiveMember) return;
                try {
                  await archiveContact.mutateAsync({ memberId: archiveMember.id });
                  toast.success(
                    `${archiveMember.first_name} ${archiveMember.last_name} archived`
                  );
                  setArchiveOpen(false);
                  setArchiveMember(null);
                } catch (e: any) {
                  toast.error(e?.message || "Failed to archive contact");
                }
              }}
            >
              Archive Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Account Confirmation */}
      <AlertDialog open={!!closeAccountId} onOpenChange={(o) => !o && setCloseAccountId(null)}>
        <AlertDialogContent>
          {(() => {
            const a = accounts.find((x) => x.id === closeAccountId);
            const name = a?.account_name || "this account";
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close {name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This account will be marked as closed. The record will be retained for compliance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="close-reason" className="text-xs">
                    Reason (optional)
                  </Label>
                  <Textarea
                    id="close-reason"
                    placeholder="e.g. Account transferred, client request..."
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (!closeAccountId) return;
                      try {
                        await deleteAccount.mutateAsync({
                          accountId: closeAccountId,
                          action: "close",
                          reason: closeReason || undefined,
                        });
                        toast.success(`${name} closed`);
                        setCloseAccountId(null);
                        setCloseReason("");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to close account");
                      }
                    }}
                  >
                    Close Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Account Confirmation */}
      <AlertDialog open={!!archiveAccountId} onOpenChange={(o) => !o && setArchiveAccountId(null)}>
        <AlertDialogContent>
          {(() => {
            const a = accounts.find((x) => x.id === archiveAccountId);
            const name = a?.account_name || "this account";
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This account will be archived and hidden from active views. The record will be
                    retained for compliance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (!archiveAccountId) return;
                      try {
                        await deleteAccount.mutateAsync({
                          accountId: archiveAccountId,
                          action: "archive",
                        });
                        toast.success(`${name} archived`);
                        setArchiveAccountId(null);
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to archive account");
                      }
                    }}
                  >
                    Archive Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Reparent Contact Dialog */}
      {reparentOpen && reparentMember && id && (
        <ReparentContactDialog
          open={reparentOpen}
          onOpenChange={setReparentOpen}
          contact={{
            id: reparentMember.id,
            first_name: reparentMember.first_name,
            last_name: reparentMember.last_name,
            household_id: id,
            household_name: household.name,
          }}
          accounts={accounts.filter((a: any) => a.member_id === reparentMember.id)}
          onComplete={() => {
            setReparentOpen(false);
            setReparentMember(null);
          }}
        />
      )}
    </div>
  );
}
