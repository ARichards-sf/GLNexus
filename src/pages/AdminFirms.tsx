import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, Plus, Pencil } from "lucide-react";
import { useFirms } from "@/hooks/useFirms";
import CreateFirmDialog from "@/components/CreateFirmDialog";

export default function AdminFirms() {
  const { data: firms = [], isLoading } = useFirms();
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="h-64 bg-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Firms
          </h1>
          <p className="text-muted-foreground mt-1">Manage firms and their branding.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Create Firm
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firm</TableHead>
              <TableHead>Advisors</TableHead>
              <TableHead>Accent</TableHead>
              <TableHead>Book Sharing</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {firms.map((firm) => (
              <TableRow key={firm.id}>
                <TableCell>
                  <span className="text-sm font-medium text-foreground">{firm.name}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{firm.advisor_count}</TableCell>
                <TableCell>
                  {firm.accent_color ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: firm.accent_color }}
                      />
                      <span className="text-xs font-mono text-muted-foreground">{firm.accent_color}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {firm.allow_book_sharing ? "Enabled" : "Disabled"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-xs h-7" disabled>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {firms.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  No firms yet. Click "Create Firm" to add one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateFirmDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
