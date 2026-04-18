import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Building2,
  Crown,
  ChevronRight,
  UserRound,
  Globe,
  Phone,
  Mail,
  ExternalLink,
  Pencil,
  Plus,
  Shield,
  X,
} from "lucide-react";
import EditFirmDialog from "@/components/EditFirmDialog";
import InviteAdvisorDialog from "@/components/InviteAdvisorDialog";
import AddFirmAdminDialog from "@/components/AddFirmAdminDialog";
import { formatFullCurrency } from "@/data/sampleData";
import { useToast } from "@/hooks/use-toast";
import type { Firm } from "@/hooks/useFirms";

interface FirmAdvisor {
  user_id: string;
  is_lead_advisor: boolean;
  full_name: string | null;
  email: string | null;
  last_sign_in: string | null;
  status: string | null;
}

interface FirmAdmin {
  membership_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function getInitials(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function FirmDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [addAdminOpen, setAddAdminOpen] = useState(false);

  const { data: firm, isLoading: firmLoading } = useQuery({
    queryKey: ["firm", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firms")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Firm;
    },
    enabled: !!id,
  });

  const { data: advisors = [] } = useQuery({
    queryKey: ["firm_advisors", id],
    enabled: !!id,
    queryFn: async (): Promise<FirmAdvisor[]> => {
      const { data: memberships, error } = await supabase
        .from("firm_memberships")
        .select("user_id, is_lead_advisor")
        .eq("firm_id", id!)
        .eq("role", "advisor");
      if (error) throw error;
      if (!memberships || memberships.length === 0) return [];

      const userIds = memberships.map((m) => m.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, last_sign_in, status")
        .in("user_id", userIds);
      if (pErr) throw pErr;

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      return memberships.map((m) => {
        const p = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          is_lead_advisor: m.is_lead_advisor,
          full_name:
            p?.full_name || p?.email?.split("@")[0] || "Advisor",
          email: p?.email ?? null,
          last_sign_in: p?.last_sign_in ?? null,
          status: p?.status ?? null,
        };
      });
    },
  });

  const { data: admins = [] } = useQuery({
    queryKey: ["firm_admins", id],
    enabled: !!id,
    queryFn: async (): Promise<FirmAdmin[]> => {
      const { data: memberships, error } = await supabase
        .from("firm_memberships")
        .select("id, user_id, role")
        .eq("firm_id", id!)
        .in("role", ["admin", "advisor_admin"]);
      if (error) throw error;
      if (!memberships || memberships.length === 0) return [];

      const userIds = memberships.map((m) => m.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (pErr) throw pErr;

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      return memberships.map((m) => {
        const p = profileMap.get(m.user_id);
        return {
          membership_id: m.id,
          user_id: m.user_id,
          full_name:
            p?.full_name || p?.email?.split("@")[0] || "User",
          email: p?.email ?? null,
        };
      });
    },
  });

  const { data: firmStats } = useQuery({
    queryKey: ["firm_stats", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("firm_memberships")
        .select("user_id")
        .eq("firm_id", id!)
        .eq("role", "advisor");

      if (!memberships?.length) return { totalAum: 0, householdCount: 0 };

      const advisorIds = memberships.map((m) => m.user_id);
      const { data: households } = await supabase
        .from("households")
        .select("total_aum")
        .in("advisor_id", advisorIds)
        .is("archived_at", null);

      const totalAum = (households || []).reduce(
        (sum, h) => sum + Number(h.total_aum),
        0,
      );
      return { totalAum, householdCount: households?.length || 0 };
    },
  });

  const setLead = useMutation({
    mutationFn: async ({
      userId,
      makeLead,
    }: {
      userId: string;
      makeLead: boolean;
    }) => {
      if (makeLead) {
        const { error: clearErr } = await supabase
          .from("firm_memberships")
          .update({ is_lead_advisor: false })
          .eq("firm_id", id!)
          .neq("user_id", userId);
        if (clearErr) throw clearErr;
      }
      const { error } = await supabase
        .from("firm_memberships")
        .update({ is_lead_advisor: makeLead })
        .eq("firm_id", id!)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firm_advisors", id] });
      toast({ title: "Lead advisor updated" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (firmLoading || !firm) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="h-32 bg-secondary rounded-lg" />
          <div className="h-64 bg-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  // Cast for new columns not yet in generated types
  const f = firm as Firm & {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    bd_number?: string | null;
    crd_number?: string | null;
    notes?: string | null;
    founded_year?: number | null;
  };

  const addressParts = [
    f.address_line1,
    f.address_line2,
    [f.city, f.state, f.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  const addressText = addressParts.length ? addressParts.join(" · ") : null;

  const previewAccent = f.accent_color || "#1B3A6B";

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <Link
        to="/admin/firms"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> All Firms
      </Link>

      {/* HEADER */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {f.logo_url ? (
            <img
              src={f.logo_url}
              alt={`${f.name} logo`}
              className="h-12 w-auto object-contain"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {f.name}
              </h1>
              {f.is_gl_internal && (
                <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 border-0">
                  GL Internal
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Created {new Date(f.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {f.accent_color && (
            <div
              className="w-6 h-6 rounded-full border border-border"
              style={{ backgroundColor: f.accent_color }}
              title={f.accent_color}
            />
          )}
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1.5" /> Edit Firm
          </Button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Total AUM
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {formatFullCurrency(firmStats?.totalAum || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Across firm</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Households
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {firmStats?.householdCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Active households</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Advisors
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {advisors.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Registered advisors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Book Sharing
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {f.allow_book_sharing ? "Enabled" : "Disabled"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Household sharing</p>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1 — Firm Information */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Firm Information</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Phone">
              {f.phone ? (
                <a
                  href={`tel:${f.phone}`}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {f.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="BD Number">
              {f.bd_number ? f.bd_number : <span className="text-muted-foreground">—</span>}
            </Field>
            <Field label="Email">
              {f.email ? (
                <a
                  href={`mailto:${f.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  {f.email}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="CRD Number">
              {f.crd_number ? f.crd_number : <span className="text-muted-foreground">—</span>}
            </Field>
            <Field label="Website">
              {f.website ? (
                <a
                  href={f.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  {f.website}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Book Sharing">
              <Badge
                variant="outline"
                className={
                  f.allow_book_sharing
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {f.allow_book_sharing ? "Enabled" : "Disabled"}
              </Badge>
            </Field>
            <Field label="Founded Year">
              {f.founded_year ? f.founded_year : <span className="text-muted-foreground">—</span>}
            </Field>
            <div />

            <div className="md:col-span-2">
              <Field label="Address">
                {addressText ? addressText : <span className="text-muted-foreground">—</span>}
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Notes">
                {f.notes ? (
                  <p className="italic text-foreground/80 whitespace-pre-wrap">{f.notes}</p>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2 — Advisors */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <UserRound className="w-4 h-4" /> Advisors
          </CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Invite Advisor
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {advisors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <UserRound className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">No advisors yet</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setInviteOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Invite Advisor
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {advisors.map((a) => (
                <div
                  key={a.user_id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                      {getInitials(a.full_name, a.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {a.full_name || "Unnamed advisor"}
                        </p>
                        {a.is_lead_advisor && (
                          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                      {a.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {a.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        Lead Advisor
                      </span>
                      <Switch
                        checked={a.is_lead_advisor}
                        disabled={setLead.isPending}
                        onCheckedChange={(checked) =>
                          setLead.mutate({ userId: a.user_id, makeLead: checked })
                        }
                      />
                    </div>
                    <Link
                      to={`/admin/advisors/${a.user_id}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View advisor"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3 — Branding */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <Field label="Logo">
                {f.logo_url ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                    <img
                      src={f.logo_url}
                      alt="Firm logo"
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground">No logo set</span>
                )}
              </Field>
              <Field label="Accent Color">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full border border-border"
                    style={{ backgroundColor: previewAccent }}
                  />
                  <span className="font-mono text-sm">{previewAccent}</span>
                </div>
              </Field>
            </div>

            {/* Mini sidebar preview */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-2">
                How It Looks
              </p>
              <div className="rounded-lg border border-border overflow-hidden bg-card max-w-xs">
                <div className="p-3 border-b border-border flex items-center gap-2 bg-secondary/30">
                  {f.logo_url ? (
                    <img
                      src={f.logo_url}
                      alt="Logo preview"
                      className="h-6 w-auto object-contain"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ backgroundColor: previewAccent }}
                    >
                      <Building2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-foreground truncate">
                    {f.name}
                  </span>
                </div>
                <div className="p-2 space-y-1">
                  {["Dashboard", "Households", "Contacts"].map((item, idx) => {
                    const isActive = idx === 0;
                    return (
                      <div
                        key={item}
                        className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        style={
                          isActive
                            ? {
                                backgroundColor: `${previewAccent}1A`,
                                color: previewAccent,
                              }
                            : undefined
                        }
                      >
                        <span className={isActive ? "" : "text-muted-foreground"}>
                          {item}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditFirmDialog open={editOpen} onOpenChange={setEditOpen} firm={firm} />
      <InviteAdvisorDialog open={inviteOpen} onOpenChange={setInviteOpen} defaultFirmId={id} />
    </div>
  );
}
