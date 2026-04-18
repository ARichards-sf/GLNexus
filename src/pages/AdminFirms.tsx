import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Building2, Plus, Pencil, ChevronDown, ChevronRight, Crown } from "lucide-react";
import { useFirms, type Firm } from "@/hooks/useFirms";
import CreateFirmDialog from "@/components/CreateFirmDialog";
import EditFirmDialog from "@/components/EditFirmDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FirmAdvisor {
  user_id: string;
  is_lead_advisor: boolean;
  full_name: string | null;
  email: string | null;
}

function useFirmAdvisors(firmId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["firm_advisors", firmId],
    enabled,
    queryFn: async (): Promise<FirmAdvisor[]> => {
      const { data: memberships, error } = await supabase
        .from("firm_memberships")
        .select("user_id, is_lead_advisor")
        .eq("firm_id", firmId)
        .eq("role", "advisor");
      if (error) throw error;
      if (!memberships || memberships.length === 0) return [];

      const userIds = memberships.map((m) => m.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (pErr) throw pErr;

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      return memberships.map((m) => ({
        user_id: m.user_id,
        is_lead_advisor: m.is_lead_advisor,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
        email: profileMap.get(m.user_id)?.email ?? null,
      }));
    },
  });
}

function FirmAdvisorsList({ firmId }: { firmId: string }) {
  const { data: advisors = [], isLoading } = useFirmAdvisors(firmId, true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const setLead = useMutation({
    mutationFn: async ({ userId, makeLead }: { userId: string; makeLead: boolean }) => {
      if (makeLead) {
        // Clear other leads in this firm first
        const { error: clearErr } = await supabase
          .from("firm_memberships")
          .update({ is_lead_advisor: false })
          .eq("firm_id", firmId)
          .neq("user_id", userId);
        if (clearErr) throw clearErr;
      }
      const { error } = await supabase
        .from("firm_memberships")
        .update({ is_lead_advisor: makeLead })
        .eq("firm_id", firmId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firm_advisors", firmId] });
      toast({ title: "Lead advisor updated" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading advisors…</div>;
  }

  if (advisors.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No advisors in this firm.</div>;
  }

  return (
    <div className="divide-y divide-border">
      {advisors.map((advisor) => (
        <div
          key={advisor.user_id}
          className="flex items-center justify-between px-4 py-2.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            {advisor.is_lead_advisor && (
              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {advisor.full_name || "Unnamed advisor"}
              </p>
              {advisor.email && (
                <p className="text-xs text-muted-foreground truncate">{advisor.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Lead Advisor</span>
            <Switch
              checked={advisor.is_lead_advisor}
              disabled={setLead.isPending}
              onCheckedChange={(checked) =>
                setLead.mutate({ userId: advisor.user_id, makeLead: checked })
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminFirms() {
  const { data: firms = [], isLoading } = useFirms();
  const [createOpen, setCreateOpen] = useState(false);
  const [editFirm, setEditFirm] = useState<Firm | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
              <TableHead className="w-10" />
              <TableHead>Firm</TableHead>
              <TableHead>Advisors</TableHead>
              <TableHead>Accent</TableHead>
              <TableHead>Book Sharing</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {firms.map((firm) => {
              const isOpen = expanded.has(firm.id);
              return (
                <Fragment key={firm.id}>
                  <TableRow>
                    <TableCell className="w-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleExpand(firm.id)}
                        aria-label={isOpen ? "Collapse advisors" : "Expand advisors"}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
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
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditFirm(firm)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6} className="p-0">
                        <FirmAdvisorsList firmId={firm.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {firms.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                  No firms yet. Click "Create Firm" to add one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateFirmDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editFirm && (
        <EditFirmDialog
          open={!!editFirm}
          onOpenChange={(o) => !o && setEditFirm(null)}
          firm={editFirm}
        />
      )}
    </div>
  );
}
