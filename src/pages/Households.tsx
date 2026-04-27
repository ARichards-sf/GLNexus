import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, ArrowRight, Users, X,
  ChevronsUpDown, ChevronDown, ChevronUp,
} from "lucide-react";
import { useHouseholds } from "@/hooks/useHouseholds";
import { useAllContacts } from "@/hooks/useContacts";
import { formatCurrency } from "@/data/sampleData";
import CreateHouseholdDialog from "@/components/CreateHouseholdDialog";
import PageLoader from "@/components/PageLoader";
import TierBadge from "@/components/TierBadge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  Inactive: "bg-secondary text-muted-foreground",
  "Review Scheduled": "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  Onboarding: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};

type SortField = "name" | "aum" | "review";
type SortDir = "asc" | "desc";

export default function Households() {
  const { data: households = [], isLoading } = useHouseholds();
  const { data: contacts = [] } = useAllContacts();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("aum");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const headMap = useMemo(() => {
    const map: Record<string, string> = {};
    contacts.forEach((c) => {
      if (c.household_id && c.relationship === "Primary") {
        map[c.household_id] = `${c.first_name} ${c.last_name}`;
      }
    });
    return map;
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = [...households];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (headMap[h.id] || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((h) => h.status === statusFilter);
    }

    if (riskFilter !== "all") {
      result = result.filter((h) => h.risk_tolerance === riskFilter);
    }

    if (tierFilter === "unassigned") {
      result = result.filter(h => !h.wealth_tier);
    } else if (tierFilter !== "all") {
      result = result.filter(h =>
        h.wealth_tier?.toLowerCase() === tierFilter
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "aum") {
        comparison = Number(a.total_aum) - Number(b.total_aum);
      } else if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "review") {
        const aDate = a.annual_review_date ? new Date(a.annual_review_date).getTime() : 0;
        const bDate = b.annual_review_date ? new Date(b.annual_review_date).getTime() : 0;
        comparison = aDate - bDate;
      }
      return sortDir === "desc" ? -comparison : comparison;
    });

    return result;
  }, [households, search, headMap, statusFilter, riskFilter, tierFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/60" />;
    }
    return sortDir === "desc"
      ? <ChevronDown className="w-3.5 h-3.5 text-foreground" />
      : <ChevronUp className="w-3.5 h-3.5 text-foreground" />;
  }

  const hasActiveFilters = statusFilter !== "all" || riskFilter !== "all" || tierFilter !== "all";
  const hasAnyFilter = hasActiveFilters || search.trim();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Households</h1>
          <p className="text-muted-foreground mt-1">{households.length} household{households.length !== 1 ? "s" : ""} in your book</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New Household
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or primary contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Review Scheduled">Review Scheduled</SelectItem>
              <SelectItem value="Onboarding">Onboarding</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk Levels</SelectItem>
              <SelectItem value="Conservative">Conservative</SelectItem>
              <SelectItem value="Moderate">Moderate</SelectItem>
              <SelectItem value="Aggressive">Aggressive</SelectItem>
              <SelectItem value="Very Aggressive">Very Aggressive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="platinum">🏆 Platinum</SelectItem>
              <SelectItem value="gold">⭐ Gold</SelectItem>
              <SelectItem value="silver">◆ Silver</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setStatusFilter("all");
                setRiskFilter("all");
                setTierFilter("all");
              }}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          )}

          {hasAnyFilter && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {households.length}
            </span>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Household
                    <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead>Primary Contact</TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("aum")}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors ml-auto"
                  >
                    Total AUM
                    <SortIcon field="aum" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("review")}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Last Review
                    <SortIcon field="review" />
                  </button>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h) => (
                <TableRow key={h.id} className="group bg-card hover:bg-secondary/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Link to={`/household/${h.id}`} className="flex items-center gap-3 hover:underline">
                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                          {h.name.split(" ")[1]?.[0] || h.name[0]}
                        </div>
                        <span className="text-sm font-medium text-foreground">{h.name}</span>
                      </Link>
                      <TierBadge tier={h.wealth_tier} size="sm" showUnassigned pending={!!(h as any).tier_pending_review} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {headMap[h.id] || <span className="italic">Not assigned</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-foreground">
                    {formatCurrency(Number(h.total_aum))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0 font-medium",
                        STATUS_STYLES[h.status] || "bg-secondary text-muted-foreground"
                      )}
                    >
                      {h.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {h.annual_review_date
                      ? new Date(h.annual_review_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Link to={`/household/${h.id}`}>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : households.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No households yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first household to get started.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create Household
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">No results found</p>
      )}

      <CreateHouseholdDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
