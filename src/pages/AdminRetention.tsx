import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Database, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlProfile } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatFullCurrency } from "@/data/sampleData";

const DEV_MODE = true; // Set to false before production

type EligibleAccount = {
  id: string;
  account_name: string;
  account_type: string;
  balance: number;
  archived_at: string;
  contact_name: string;
  household_name: string;
  advisor_name: string;
};
type EligibleMember = {
  id: string;
  name: string;
  relationship: string;
  household_name: string;
  archived_at: string;
  archived_reason: string;
  advisor_name: string;
};
type EligibleHousehold = {
  id: string;
  name: string;
  total_aum: number;
  archived_at: string;
  archived_reason: string;
  advisor_name: string;
};
type ReviewResponse = {
  eligible_accounts: EligibleAccount[];
  eligible_members: EligibleMember[];
  eligible_households: EligibleHousehold[];
  total_count: number;
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminRetention() {
  const { data: glProfile, isLoading: glLoading } = useGlProfile();
  const queryClient = useQueryClient();

  const cutoffIso = useMemo(() => {
    if (DEV_MODE) return new Date().toISOString();
    const d = new Date();
    d.setFullYear(d.getFullYear() - 6);
    return d.toISOString();
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["retention_review", cutoffIso],
    queryFn: async (): Promise<ReviewResponse> => {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "retention_review", cutoff_iso: cutoffIso },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as ReviewResponse;
    },
    enabled: !!glProfile?.is_gl_internal && glProfile?.platform_role === "super_admin",
  });

  const [selAccounts, setSelAccounts] = useState<Set<string>>(new Set());
  const [selMembers, setSelMembers] = useState<Set<string>>(new Set());
  const [selHouseholds, setSelHouseholds] = useState<Set<string>>(new Set());

  const [dialogStep, setDialogStep] = useState<0 | 1 | 2>(0); // 0 closed, 1 summary, 2 confirm
  const [confirmText, setConfirmText] = useState("");

  const purgeMutation = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "execute_purge",
          account_ids: Array.from(selAccounts),
          member_ids: Array.from(selMembers),
          household_ids: Array.from(selHouseholds),
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      return res as { purged_count: number; errors: string[] };
    },
    onSuccess: (res) => {
      toast.success(`${res.purged_count} records purged and logged to audit trail`);
      if (res.errors?.length) {
        toast.error(`${res.errors.length} record(s) failed: ${res.errors.slice(0, 2).join("; ")}`);
      }
      setSelAccounts(new Set());
      setSelMembers(new Set());
      setSelHouseholds(new Set());
      setDialogStep(0);
      setConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["retention_review"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Purge failed"),
  });

  if (glLoading) {
    return <div className="p-10"><div className="animate-pulse h-8 bg-secondary rounded w-48" /></div>;
  }
  if (!glProfile?.is_gl_internal || glProfile?.platform_role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  const accounts = data?.eligible_accounts ?? [];
  const members = data?.eligible_members ?? [];
  const households = data?.eligible_households ?? [];

  const totalSelected = selAccounts.size + selMembers.size + selHouseholds.size;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };
  const toggleAll = (
    ids: string[],
    set: Set<string>,
    setter: (s: Set<string>) => void,
  ) => {
    const allSelected = ids.length > 0 && ids.every((id) => set.has(id));
    setter(allSelected ? new Set() : new Set(ids));
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Database className="w-6 h-6 text-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Data Retention</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Review and approve purging of archived records past the retention period.
        </p>
      </div>

      {DEV_MODE && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Dev Mode: Showing all archived records regardless of age.
            Set <code className="font-mono text-xs">DEV_MODE = false</code> before production.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Eligible Accounts", count: accounts.length },
          { label: "Eligible Contacts", count: members.length },
          { label: "Eligible Households", count: households.length },
        ].map((s) => (
          <Card key={s.label} className="border-border shadow-none">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground font-medium mb-1">{s.label}</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-secondary rounded-lg" />
          <div className="h-32 bg-secondary rounded-lg" />
        </div>
      ) : (
        <div className="space-y-8 pb-32">
          {/* Section 1 — Accounts */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Financial Accounts</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={accounts.length > 0 && accounts.every((a) => selAccounts.has(a.id))}
                        onCheckedChange={() => toggleAll(accounts.map((a) => a.id), selAccounts, setSelAccounts)}
                      />
                    </TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Household</TableHead>
                    <TableHead>Archived</TableHead>
                    <TableHead>Advisor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No eligible accounts.</TableCell></TableRow>
                  ) : accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Checkbox
                          checked={selAccounts.has(a.id)}
                          onCheckedChange={() => toggle(selAccounts, setSelAccounts, a.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{a.account_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.account_type}</TableCell>
                      <TableCell className="text-right text-sm">{formatFullCurrency(a.balance)}</TableCell>
                      <TableCell className="text-sm">{a.contact_name}</TableCell>
                      <TableCell className="text-sm">{a.household_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(a.archived_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.advisor_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Section 2 — Contacts */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Contacts</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={members.length > 0 && members.every((m) => selMembers.has(m.id))}
                        onCheckedChange={() => toggleAll(members.map((m) => m.id), selMembers, setSelMembers)}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Household</TableHead>
                    <TableHead>Archived</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Advisor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No eligible contacts.</TableCell></TableRow>
                  ) : members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Checkbox
                          checked={selMembers.has(m.id)}
                          onCheckedChange={() => toggle(selMembers, setSelMembers, m.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{m.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.relationship}</TableCell>
                      <TableCell className="text-sm">{m.household_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(m.archived_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.archived_reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.advisor_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Section 3 — Households */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Households</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={households.length > 0 && households.every((h) => selHouseholds.has(h.id))}
                        onCheckedChange={() => toggleAll(households.map((h) => h.id), selHouseholds, setSelHouseholds)}
                      />
                    </TableHead>
                    <TableHead>Household Name</TableHead>
                    <TableHead className="text-right">Last Known AUM</TableHead>
                    <TableHead>Archived</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Advisor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {households.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No eligible households.</TableCell></TableRow>
                  ) : households.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Checkbox
                          checked={selHouseholds.has(h.id)}
                          onCheckedChange={() => toggle(selHouseholds, setSelHouseholds, h.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{h.name}</TableCell>
                      <TableCell className="text-right text-sm">{formatFullCurrency(h.total_aum)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(h.archived_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{h.archived_reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{h.advisor_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      )}

      {/* Footer action bar */}
      {totalSelected > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-card border-t border-border shadow-lg z-40">
          <div className="px-6 lg:px-10 py-4 flex items-center justify-between max-w-7xl">
            <p className="text-sm font-medium text-foreground">{totalSelected} record{totalSelected === 1 ? "" : "s"} selected</p>
            <Button variant="destructive" onClick={() => setDialogStep(1)}>
              Purge Selected
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={dialogStep > 0} onOpenChange={(o) => { if (!o) { setDialogStep(0); setConfirmText(""); } }}>
        <DialogContent>
          {dialogStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm purge</DialogTitle>
                <DialogDescription>
                  You are about to permanently delete {totalSelected} record{totalSelected === 1 ? "" : "s"}:
                </DialogDescription>
              </DialogHeader>
              <ul className="text-sm text-foreground space-y-1 pl-2">
                <li>• {selAccounts.size} financial account{selAccounts.size === 1 ? "" : "s"}</li>
                <li>• {selMembers.size} contact{selMembers.size === 1 ? "" : "s"}</li>
                <li>• {selHouseholds.size} household{selHouseholds.size === 1 ? "" : "s"}</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. All deletions will be logged to the audit trail.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogStep(0)}>Cancel</Button>
                <Button onClick={() => setDialogStep(2)}>Continue →</Button>
              </DialogFooter>
            </>
          )}
          {dialogStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>Type to confirm</DialogTitle>
                <DialogDescription>
                  Type <span className="font-mono font-semibold text-foreground">CONFIRM PURGE</span> to proceed:
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="CONFIRM PURGE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogStep(1)}>Back</Button>
                <Button
                  variant="destructive"
                  disabled={confirmText !== "CONFIRM PURGE" || purgeMutation.isPending}
                  onClick={() => purgeMutation.mutate()}
                >
                  {purgeMutation.isPending ? "Purging..." : "Purge Records"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
