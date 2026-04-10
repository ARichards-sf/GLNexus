import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  DollarSign,
  Shield,
  Target,
  Users,
  Mail,
  Phone,
  Calendar,
  FileText,
  CalendarCheck,
  Lightbulb,
  ArrowRight,
  Clock,
} from "lucide-react";
import { sampleHouseholds, formatFullCurrency } from "@/data/sampleData";

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
  const household = sampleHouseholds.find((h) => h.id === id);

  if (!household) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Household not found.</p>
        <Link to="/" className="text-sm text-foreground underline mt-2 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{household.name}</h1>
            <p className="text-muted-foreground mt-1">{household.investmentObjective}</p>
          </div>
          <Badge variant="secondary" className="text-xs font-medium">{household.status}</Badge>
        </div>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Total Assets</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{formatFullCurrency(household.totalAUM)}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Risk Tolerance</span>
            </div>
            <p className={`text-2xl font-semibold tracking-tight ${riskColors[household.riskTolerance]}`}>{household.riskTolerance}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Annual Review</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {new Date(household.annualReviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Next Best Action */}
      <Card className="border-emerald/30 bg-emerald-muted/50 shadow-none mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4.5 h-4.5 text-emerald" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">Next Best Action</h3>
                <span className="text-xs text-muted-foreground">
                  Due {new Date(household.nextActionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{household.nextAction}</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 text-xs">
              Mark Complete
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Members */}
        <Card className="lg:col-span-2 border-border shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Family Members</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {household.members.map((member) => (
              <div key={member.id} className="p-3 rounded-lg bg-secondary/40">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-foreground">{member.firstName} {member.lastName}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{member.relationship}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Age {member.age}</p>
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
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Compliance Log */}
        <Card className="lg:col-span-3 border-border shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Compliance Log</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-6">
                {household.complianceLog.map((note) => (
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
                      <p className="text-[11px] text-muted-foreground mt-1.5">— {note.advisor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {household.complianceLog.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No compliance notes yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
