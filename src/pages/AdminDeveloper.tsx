import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlProfile } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Terminal,
  ShieldAlert,
  AlertTriangle,
  Trash2,
  Search,
} from "lucide-react";

type DevTable =
  | "households"
  | "prospects"
  | "compliance_notes"
  | "tasks"
  | "firms"
  | "deletion_audit_log";

function formatCurrency(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  search: string;
  onSearchChange: (v: string) => void;
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
  recordTypeLabel: string;
  extraWarning?: string;
  children: React.ReactNode;
}

function SectionCard({
  title,
  icon,
  count,
  search,
  onSearchChange,
  selectedIds,
  onClearSelection,
  onConfirmDelete,
  isDeleting,
  recordTypeLabel,
  extraWarning,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const selectedCount = selectedIds.size;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedCount} selected
              </span>
            )}
            <Button
              size="sm"
              variant="destructive"
              disabled={selectedCount === 0 || isDeleting}
              onClick={() => {
                setConfirmText("");
                setOpen(true);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="pl-8 h-9"
          />
        </div>
        <ScrollArea className="h-[280px] rounded-md border border-border">
          <div className="divide-y divide-border">{children}</div>
        </ScrollArea>
      </CardContent>

      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setConfirmText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} record{selectedCount === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCount} {recordTypeLabel} record{selectedCount === 1 ? "" : "s"}. This cannot be undone.
              {extraWarning && (
                <span className="block mt-2 text-destructive font-medium">{extraWarning}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder='Type "DELETE" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "DELETE" || isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                await onConfirmDelete();
                setOpen(false);
                setConfirmText("");
                onClearSelection();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Row({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onToggle(!!v)}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function AdminDeveloper() {
  const { data: glProfile } = useGlProfile();
  const isDeveloper =
    !!glProfile?.is_gl_internal &&
    (glProfile?.platform_role === "developer" ||
      glProfile?.platform_role === "super_admin");

  const queryClient = useQueryClient();
  const [deletingTable, setDeletingTable] = useState<string | null>(null);

  // Per-section state
  const [profilesSel, setProfilesSel] = useState<Set<string>>(new Set());
  const [hhSel, setHhSel] = useState<Set<string>>(new Set());
  const [prospectsSel, setProspectsSel] = useState<Set<string>>(new Set());
  const [notesSel, setNotesSel] = useState<Set<string>>(new Set());
  const [tasksSel, setTasksSel] = useState<Set<string>>(new Set());
  const [firmsSel, setFirmsSel] = useState<Set<string>>(new Set());
  const [auditSel, setAuditSel] = useState<Set<string>>(new Set());

  const [profilesQ, setProfilesQ] = useState("");
  const [hhQ, setHhQ] = useState("");
  const [prospectsQ, setProspectsQ] = useState("");
  const [notesQ, setNotesQ] = useState("");
  const [tasksQ, setTasksQ] = useState("");
  const [firmsQ, setFirmsQ] = useState("");
  const [auditQ, setAuditQ] = useState("");

  // Queries — only enabled when developer
  const profilesQuery = useQuery({
    queryKey: ["dev_profiles"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, platform_role, is_gl_internal, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const householdsQuery = useQuery({
    queryKey: ["dev_households"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select("id, name, total_aum, status, advisor_id, archived_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const prospectsQuery = useQuery({
    queryKey: ["dev_prospects"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("id, first_name, last_name, company, pipeline_stage, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const notesQuery = useQuery({
    queryKey: ["dev_notes"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_notes")
        .select("id, type, summary, date, household_id, households(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["dev_tasks"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, priority, created_at, households(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const firmsQuery = useQuery({
    queryKey: ["dev_firms"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firms")
        .select("id, name, created_at")
        .eq("is_gl_internal", false)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const auditQuery = useQuery({
    queryKey: ["dev_audit"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_audit_log")
        .select("*")
        .order("deleted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Filtered lists
  const filteredProfiles = useMemo(() => {
    const q = profilesQ.toLowerCase();
    return (profilesQuery.data || []).filter(
      (p: any) =>
        !q ||
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [profilesQuery.data, profilesQ]);

  const filteredHh = useMemo(() => {
    const q = hhQ.toLowerCase();
    return (householdsQuery.data || []).filter((h: any) => !q || h.name?.toLowerCase().includes(q));
  }, [householdsQuery.data, hhQ]);

  const filteredProspects = useMemo(() => {
    const q = prospectsQ.toLowerCase();
    return (prospectsQuery.data || []).filter((p: any) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      return !q || name.includes(q) || p.company?.toLowerCase().includes(q);
    });
  }, [prospectsQuery.data, prospectsQ]);

  const filteredNotes = useMemo(() => {
    const q = notesQ.toLowerCase();
    return (notesQuery.data || []).filter(
      (n: any) =>
        !q ||
        n.type?.toLowerCase().includes(q) ||
        n.summary?.toLowerCase().includes(q) ||
        (n.households as any)?.name?.toLowerCase().includes(q)
    );
  }, [notesQuery.data, notesQ]);

  const filteredTasks = useMemo(() => {
    const q = tasksQ.toLowerCase();
    return (tasksQuery.data || []).filter(
      (t: any) => !q || t.title?.toLowerCase().includes(q)
    );
  }, [tasksQuery.data, tasksQ]);

  const filteredFirms = useMemo(() => {
    const q = firmsQ.toLowerCase();
    return (firmsQuery.data || []).filter((f: any) => !q || f.name?.toLowerCase().includes(q));
  }, [firmsQuery.data, firmsQ]);

  const filteredAudit = useMemo(() => {
    const q = auditQ.toLowerCase();
    return (auditQuery.data || []).filter(
      (a: any) =>
        !q ||
        a.record_type?.toLowerCase().includes(q) ||
        a.deleted_by?.toLowerCase().includes(q)
    );
  }, [auditQuery.data, auditQ]);

  if (!isDeveloper) {
    return (
      <div className="p-10 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-destructive/40" />
        <p className="text-sm font-medium">Access Denied</p>
        <p className="text-xs text-muted-foreground mt-1">Developer role required</p>
      </div>
    );
  }

  function toggleInSet(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function devDelete(table: DevTable, ids: string[], invalidateKey: string) {
    setDeletingTable(table);
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "dev_delete", table, ids },
      });
      if (error) throw error;
      toast.success(`Deleted ${data?.deleted ?? ids.length} ${table} record${ids.length === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      queryClient.invalidateQueries({ queryKey: ["dev_audit"] });
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeletingTable(null);
    }
  }

  async function devDeleteUsers(userIds: string[]) {
    setDeletingTable("profiles");
    try {
      let success = 0;
      const errors: string[] = [];
      for (const uid of userIds) {
        const { error } = await supabase.functions.invoke("admin-operations", {
          body: { action: "dev_delete_user", user_id: uid },
        });
        if (error) errors.push(error.message);
        else success++;
      }
      toast.success(`Deleted ${success} user${success === 1 ? "" : "s"}${errors.length ? ` (${errors.length} failed)` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["dev_profiles"] });
      queryClient.invalidateQueries({ queryKey: ["dev_audit"] });
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeletingTable(null);
    }
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Terminal className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Developer Tools</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Permanent destructive operations across all tables.
      </p>

      <div className="mb-6 p-4 rounded-lg border border-destructive/40 bg-destructive/5">
        <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-1">
          <AlertTriangle className="w-4 h-4" />
          Developer Use Only
        </div>
        <p className="text-xs text-muted-foreground">
          This page allows permanent deletion of all data. Actions are logged to the audit trail but cannot be undone. Do not use in production with real client data.
        </p>
      </div>

      <div className="space-y-6">
        {/* SECTION 1 — Profiles */}
        <SectionCard
          title="Users / Profiles"
          icon={<Terminal className="w-4 h-4 text-muted-foreground" />}
          count={profilesQuery.data?.length || 0}
          search={profilesQ}
          onSearchChange={setProfilesQ}
          selectedIds={profilesSel}
          onClearSelection={() => setProfilesSel(new Set())}
          isDeleting={deletingTable === "profiles"}
          recordTypeLabel="user"
          extraWarning="Deleting users removes their auth account and all linked data."
          onConfirmDelete={() => devDeleteUsers(Array.from(profilesSel))}
        >
          {filteredProfiles.map((p: any) => (
            <Row
              key={p.user_id}
              checked={profilesSel.has(p.user_id)}
              onToggle={() => toggleInSet(profilesSel, p.user_id, setProfilesSel)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email || "no email"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.platform_role && <Badge variant="outline" className="text-xs">{p.platform_role}</Badge>}
                  {p.is_gl_internal && <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">GL</Badge>}
                  <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
                </div>
              </div>
            </Row>
          ))}
          {filteredProfiles.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">No records</p>
          )}
        </SectionCard>

        {/* SECTION 2 — Households */}
        <SectionCard
          title="Households"
          icon={<Terminal className="w-4 h-4 text-muted-foreground" />}
          count={householdsQuery.data?.length || 0}
          search={hhQ}
          onSearchChange={setHhQ}
          selectedIds={hhSel}
          onClearSelection={() => setHhSel(new Set())}
          isDeleting={deletingTable === "households"}
          recordTypeLabel="household"
          onConfirmDelete={() => devDelete("households", Array.from(hhSel), "dev_households")}
        >
          {filteredHh.map((h: any) => (
            <Row
              key={h.id}
              checked={hhSel.has(h.id)}
              onToggle={() => toggleInSet(hhSel, h.id, setHhSel)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(h.total_aum)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{h.status}</Badge>
                  {h.archived_at && <Badge variant="secondary" className="text-xs">Archived</Badge>}
                  <span className="text-xs text-muted-foreground">{formatDate(h.created_at)}</span>
                </div>
              </div>
            </Row>
          ))}
          {filteredHh.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">No records</p>
          )}
        </SectionCard>

        {/* SECTION 3 — Prospects */}
        <SectionCard
          title="Prospects"
          icon={<Terminal className="w-4 h-4 text-muted-foreground" />}
          count={prospectsQuery.data?.length || 0}
          search={prospectsQ}
          onSearchChange={setProspectsQ}
          selectedIds={prospectsSel}
          onClearSelection={() => setProspectsSel(new Set())}
          isDeleting={deletingTable === "prospects"}
          recordTypeLabel="prospect"
          onConfirmDelete={() => devDelete("prospects", Array.from(prospectsSel), "dev_prospects")}
        >
          {filteredProspects.map((p: any) => (
            <Row
              key={p.id}
              checked={prospectsSel.has(p.id)}
              onToggle={() => toggleInSet(prospectsSel, p.id, setProspectsSel)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.company || "—"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{p.pipeline_stage}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
                </div>
              </div>
            </Row>
          ))}
          {filteredProspects.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">No records</p>
          )}
        </SectionCard>

        {/* SECTION 4 — Compliance Notes */}
        <SectionCard
          title="Compliance Notes"
          icon={<Terminal className="w-4 h-4 text-muted-foreground" />}
          count={notesQuery.data?.length || 0}
          search={notesQ}
          onSearchChange={setNotesQ}
          selectedIds={notesSel}
          onClearSelection={() => setNotesSel(new Set())}
          isDeleting={deletingTable === "compliance_notes"}
          recordTypeLabel="compliance note"
          onConfirmDelete={() => devDelete("compliance_notes", Array.from(notesSel), "dev_notes")}
        >
          {filteredNotes.map((n: any) => (
            <Row
              key={n.id}
              checked={notesSel.has(n.id)}
              onToggle={() => toggleInSet(notesSel, n.id, setNotesSel)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {(n.households as any)?.name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(n.summary || "").slice(0, 60)}{(n.summary || "").length > 60 ? "…" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{n.type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(n.date)}</span>
                </div>
              </div>
            </Row>
          ))}
          {filteredNotes.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">No records</p>
          )}
        </SectionCard>

        {/* SECTION 5 — Tasks */}
        <SectionCard
          title="Tasks"
          icon={<Terminal className="w-4 h-4 text-muted-foreground" />}
          count={tasksQuery.data?.length || 0}
          search={tasksQ}
          onSearchChange={setTasksQ}
          selectedIds={tasksSel}
          onClearSelection={() => setTasksSel(new Set())}
          isDeleting={deletingTable === "tasks"}
          recordTypeLabel="task"
          onConfirmDelete={() => devDelete("tasks", Array.from(tasksSel), "dev_tasks")}
        >
          {filteredTasks.map((t: any) => (
            <Row
              key={t.id}
              checked={tasksSel.has(t.id)}
              onToggle={() => toggleInSet(tasksSel, t.id, setTasksSel)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(t.households as any)?.name || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
                </div>
              </div>
            </Row>
          ))}
          {filteredTasks.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">No records</p>
          )}
        </SectionCard>

        {/* SECTION 6 — Firms */}
        <SectionCard
          title="Firms (non-GL)"
          icon={<Terminal className="w-4 h-4 text-muted-foreground" />}
          count={firmsQuery.data?.length || 0}
          search={firmsQ}
          onSearchChange={setFirmsQ}
          selectedIds={firmsSel}
          onClearSelection={() => setFirmsSel(new Set())}
          isDeleting={deletingTable === "firms"}
          recordTypeLabel="firm"
          extraWarning="Deleting a firm does not delete its users — only the firm and its memberships."
          onConfirmDelete={() => devDelete("firms", Array.from(firmsSel), "dev_firms")}
        >
          {filteredFirms.map((f: any) => (
            <Row
              key={f.id}
              checked={firmsSel.has(f.id)}
              onToggle={() => toggleInSet(firmsSel, f.id, setFirmsSel)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDate(f.created_at)}</span>
                </div>
              </div>
            </Row>
          ))}
          {filteredFirms.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">No records</p>
          )}
        </SectionCard>

        {/* SECTION 7 — Audit Log */}
        <SectionCard
          title="Deletion Audit Log"
          icon={<Terminal className="w-4 h-4 text-muted-foreground" />}
          count={auditQuery.data?.length || 0}
          search={auditQ}
          onSearchChange={setAuditQ}
          selectedIds={auditSel}
          onClearSelection={() => setAuditSel(new Set())}
          isDeleting={deletingTable === "deletion_audit_log"}
          recordTypeLabel="audit log"
          extraWarning="Deleting audit logs removes the permanent record of deletions."
          onConfirmDelete={() => devDelete("deletion_audit_log", Array.from(auditSel), "dev_audit")}
        >
          {filteredAudit.map((a: any) => (
            <Row
              key={a.id}
              checked={auditSel.has(a.id)}
              onToggle={() => toggleInSet(auditSel, a.id, setAuditSel)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.deleted_by}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.deletion_reason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{a.record_type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(a.deleted_at)}</span>
                </div>
              </div>
            </Row>
          ))}
          {filteredAudit.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">No records</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
