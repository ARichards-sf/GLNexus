import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, Users, Mail, Phone } from "lucide-react";
import { useAllContacts } from "@/hooks/useContacts";
import CreateContactDialog from "@/components/CreateContactDialog";
import PageLoader from "@/components/PageLoader";

export default function Contacts() {
  const { data: contacts = [], isLoading } = useAllContacts();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = contacts;

    if (filter === "assigned") list = list.filter((c) => c.household_id);
    if (filter === "unassigned") list = list.filter((c) => !c.household_id);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [contacts, search, filter]);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Contacts</h1>
          <p className="text-muted-foreground mt-1">{contacts.length} contacts in your book</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> New Contact
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contacts</SelectItem>
            <SelectItem value="assigned">In a Household</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {contacts.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No contacts yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs text-center">
            Add your first contact to start building your client relationships.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Create your first contact
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No contacts match your search.</p>
        </div>
      ) : (
        /* Data Table */
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Household</TableHead>
                <TableHead className="font-semibold">Email & Phone</TableHead>
                <TableHead className="font-semibold">Job Title</TableHead>
                <TableHead className="font-semibold">Last Contacted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow key={contact.id} className="group bg-card hover:bg-secondary/40">
                  <TableCell>
                    <Link to={`/contacts/${contact.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                        {contact.first_name[0]}{contact.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{contact.first_name} {contact.last_name}</p>
                        <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {contact.households ? (
                      <Link to={`/household/${contact.household_id}`}>
                        <Badge variant="secondary" className="text-xs font-medium hover:bg-secondary/80 transition-colors">
                          {contact.households.name}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{contact.phone}</span>
                        </div>
                      )}
                      {!contact.email && !contact.phone && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{contact.job_title || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {contact.last_contacted
                        ? new Date(contact.last_contacted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
