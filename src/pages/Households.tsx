import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Plus, ArrowRight, Users } from "lucide-react";
import { useHouseholds } from "@/hooks/useHouseholds";
import { useAllContacts } from "@/hooks/useContacts";
import { formatCurrency } from "@/data/sampleData";
import CreateHouseholdDialog from "@/components/CreateHouseholdDialog";

const tierColors: Record<string, string> = {
  "Mass Affluent": "bg-secondary text-muted-foreground",
  HNW: "bg-emerald-muted text-emerald",
  UHNW: "bg-amber-muted text-amber",
};

export default function Households() {
  const { data: households = [], isLoading } = useHouseholds();
  const { data: contacts = [] } = useAllContacts();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const headMap = useMemo(() => {
    const map: Record<string, string> = {};
    contacts.forEach((c) => {
      if (c.household_id && c.relationship === "Head of Household") {
        map[c.household_id] = `${c.first_name} ${c.last_name}`;
      }
    });
    return map;
  }, [contacts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return households;
    const q = search.toLowerCase();
    return households.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (headMap[h.id] || "").toLowerCase().includes(q)
    );
  }, [households, search, headMap]);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-48" />
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-secondary rounded-lg" />)}
        </div>
      </div>
    );
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

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or head of household..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Household</TableHead>
                <TableHead>Head of Household</TableHead>
                <TableHead className="text-right">Total AUM</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Last Review</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h) => (
                <TableRow key={h.id} className="group">
                  <TableCell>
                    <Link to={`/household/${h.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                        {h.name.split(" ")[1]?.[0] || h.name[0]}
                      </div>
                      <span className="text-sm font-medium text-foreground">{h.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {headMap[h.id] || <span className="italic">Not assigned</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-foreground">
                    {formatCurrency(Number(h.total_aum))}
                  </TableCell>
                  <TableCell>
                    {(h as any).wealth_tier && (
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${tierColors[(h as any).wealth_tier] || ""}`}>
                        {(h as any).wealth_tier}
                      </Badge>
                    )}
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
        <p className="text-sm text-muted-foreground py-8 text-center">No results for "{search}"</p>
      )}

      <CreateHouseholdDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
