import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, DollarSign, Shield, Target, Users, Mail, Phone,
  FileText, Lightbulb, UserPlus, Briefcase,
} from "lucide-react";
import { useHousehold, useHouseholdMembers, useComplianceNotes } from "@/hooks/useHouseholds";
import { useHouseholdAccounts } from "@/hooks/useHouseholdAccounts";
import { formatFullCurrency, formatCurrency } from "@/data/sampleData";
import AddMemberDialog from "@/components/AddMemberDialog";

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

export default function HouseholdProfile() {
  const { id } = useParams();
  const { data: household, isLoading } = useHousehold(id);
  const { data: members = [] } = useHouseholdMembers(id);
  const { data: notes = [] } = useComplianceNotes(id);
  const { data: accounts = [] } = useHouseholdAccounts(id);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

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

  const totalAccountsAUM = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

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
          <Badge variant="secondary" className="text-xs font-medium">{household.status}</Badge>
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
            <p className="text-2xl font-semibold tracking-tight text-foreground">{formatFullCurrency(Number(household.total_aum))}</p>
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
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Annual Review</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {household.annual_review_date
                ? new Date(household.annual_review_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Not set"}
            </p>
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
                <Link
                  key={member.id}
                  to={`/contacts/${member.id}`}
                  className="block p-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
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
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No members added yet.</p>}
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm font-medium text-foreground">{a.account_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{a.account_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{(a as any).owner_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{a.institution || "—"}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-foreground">{formatCurrency(Number(a.balance))}</TableCell>
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
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Compliance Log</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {notes.length > 0 && <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />}
                <div className="space-y-6">
                  {notes.map((note) => (
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
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{note.summary}</p>
                        {note.advisor_name && <p className="text-[11px] text-muted-foreground mt-1.5">— {note.advisor_name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {notes.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No compliance notes yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddMemberDialog open={addMemberOpen} onOpenChange={setAddMemberOpen} householdId={household.id} />
    </div>
  );
}
