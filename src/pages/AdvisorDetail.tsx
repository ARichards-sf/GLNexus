import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, DollarSign, Home, Clock, ShieldCheck, Lock, User, AlertTriangle,
  Trash2, Zap, Star, Settings, Plus, Pencil,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdvisorDetail, useUpdateAdvisorProfile, useResetAdvisorPassword,
  useUpdateAdvisorRole, useToggleInternal, useToggleAdvisorStatus,
  useIsAdmin, useGlProfile,
} from "@/hooks/useAdmin";
import { useDeleteHouseholdAdmin } from "@/hooks/useHouseholds";
import { formatFullCurrency } from "@/data/sampleData";
import { useToast } from "@/hooks/use-toast";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import FirmAssignmentCard from "@/components/FirmAssignmentCard";

interface ServiceProfile {
  is_prime_partner?: boolean;
  prime_partner_since?: string | null;
  prime_revenue_share?: number | null;
  prime_notes?: string | null;
  vpm_enabled?: boolean;
  vpm_billing_type?: string | null;
  vpm_hourly_rate?: number | null;
  vpm_notes?: string | null;
}

export default function AdvisorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();
  const { data: advisor, isLoading } = useAdvisorDetail(id);

  // Profile form state
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileLocation, setProfileLocation] = useState<string | null>(null);

  // Security form state
  const [newPassword, setNewPassword] = useState("");

  const updateProfile = useUpdateAdvisorProfile();
  const resetPassword = useResetAdvisorPassword();
  const updateRole = useUpdateAdvisorRole();
  const toggleInternal = useToggleInternal();
  const toggleStatus = useToggleAdvisorStatus();
  const deleteHouseholdAdmin = useDeleteHouseholdAdmin();
  const { data: glProfile } = useGlProfile();
  const showDangerZone = isAdmin && glProfile?.is_gl_internal === true;
  const isGlInternal = glProfile?.is_gl_internal === true;

  // VPM state
  const advisorVpm = advisor as any;
  const [vpmEditing, setVpmEditing] = useState(false);
  const [vpmEnabled, setVpmEnabled] = useState<boolean>(false);
  const [vpmBillingType, setVpmBillingType] = useState<string>("none");
  const [vpmHourlyRate, setVpmHourlyRate] = useState<string>("");
  const [vpmNotes, setVpmNotes] = useState<string>("");

  const openVpmEdit = () => {
    setVpmEnabled(!!advisorVpm?.vpm_enabled);
    setVpmBillingType(advisorVpm?.vpm_billing_type || "none");
    setVpmHourlyRate(
      advisorVpm?.vpm_hourly_rate != null ? String(advisorVpm.vpm_hourly_rate) : ""
    );
    setVpmNotes(advisorVpm?.vpm_notes || "");
    setVpmEditing(true);
  };

  // Service profile (Prime + VPM) — fetched separately so it stays in sync
  const { data: serviceProfile, refetch: refetchService } = useQuery({
    queryKey: ["advisor_service", id],
    queryFn: async (): Promise<ServiceProfile | null> => {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_advisor_service_profile", user_id: id },
      });
      if (error) throw error;
      return (data || null) as ServiceProfile | null;
    },
    enabled: !!id && isGlInternal,
  });

  // ── Prime Partner edit dialog state ──
  const [primeEditOpen, setPrimeEditOpen] = useState(false);
  const [primeEnabled, setPrimeEnabled] = useState(false);
  const [primeSince, setPrimeSince] = useState("");
  const [primeRevShare, setPrimeRevShare] = useState("");
  const [primeNotes, setPrimeNotes] = useState("");

  const openPrimeEdit = () => {
    setPrimeEnabled(!!serviceProfile?.is_prime_partner);
    setPrimeSince(serviceProfile?.prime_partner_since ?? "");
    setPrimeRevShare(
      serviceProfile?.prime_revenue_share != null
        ? String(serviceProfile.prime_revenue_share)
        : ""
    );
    setPrimeNotes(serviceProfile?.prime_notes ?? "");
    setPrimeEditOpen(true);
  };

  const handleSavePrime = async () => {
    try {
      await updateProfile.mutateAsync({
        user_id: advisor!.user_id,
        is_prime_partner: primeEnabled,
        prime_partner_since: primeEnabled && primeSince ? primeSince : null,
        prime_revenue_share:
          primeEnabled && primeRevShare ? Number(primeRevShare) : null,
        prime_notes: primeNotes || null,
        // If newly Prime, auto-route VPM billing to prime_partner
        ...(primeEnabled && serviceProfile?.vpm_enabled
          ? { vpm_billing_type: "prime_partner" }
          : {}),
      } as any);
      toast({ title: "Prime Partner settings updated" });
      setPrimeEditOpen(false);
      refetchService();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // ── VPM edit dialog state ──
  const [vpmEditOpen, setVpmEditOpen] = useState(false);
  const [vpmEnabled, setVpmEnabled] = useState<boolean>(false);
  const [vpmBillingType, setVpmBillingType] = useState<string>("none");
  const [vpmHourlyRate, setVpmHourlyRate] = useState<string>("");
  const [vpmNotes, setVpmNotes] = useState<string>("");

  const openVpmEdit = () => {
    setVpmEnabled(!!serviceProfile?.vpm_enabled);
    setVpmBillingType(serviceProfile?.vpm_billing_type || "none");
    setVpmHourlyRate(
      serviceProfile?.vpm_hourly_rate != null
        ? String(serviceProfile.vpm_hourly_rate)
        : ""
    );
    setVpmNotes(serviceProfile?.vpm_notes || "");
    setVpmEditOpen(true);
  };

  const handleSaveVpm = async () => {
    try {
      const isPrime = !!serviceProfile?.is_prime_partner;
      const effectiveBilling = vpmEnabled
        ? isPrime
          ? "prime_partner"
          : vpmBillingType
        : "none";
      await updateProfile.mutateAsync({
        user_id: advisor!.user_id,
        vpm_enabled: vpmEnabled,
        vpm_billing_type: effectiveBilling,
        vpm_hourly_rate:
          vpmEnabled && effectiveBilling === "hourly" && vpmHourlyRate
            ? Number(vpmHourlyRate)
            : null,
        vpm_notes: vpmNotes || null,
      } as any);
      toast({ title: "VPM settings updated" });
      setVpmEditOpen(false);
      refetchService();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Danger zone state
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const handleHardDelete = async () => {
    if (!pendingDelete) return;
    if (confirmText !== pendingDelete.name) return;
    try {
      await deleteHouseholdAdmin.mutateAsync(pendingDelete.id);
      toast({ title: `${pendingDelete.name} permanently deleted` });
      setPendingDelete(null);
      setConfirmText("");
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading || !advisor) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="h-32 bg-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  const displayName = profileName ?? advisor.full_name ?? "";
  const displayLocation = profileLocation ?? advisor.office_location ?? "";

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({
        user_id: advisor.user_id,
        full_name: profileName ?? advisor.full_name ?? "",
        office_location: profileLocation ?? advisor.office_location ?? "",
      });
      toast({ title: "Profile updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    try {
      await resetPassword.mutateAsync({ user_id: advisor.user_id, new_password: newPassword });
      setNewPassword("");
      toast({ title: "Password reset successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRoleChange = async (role: string) => {
    try {
      await updateRole.mutateAsync({ user_id: advisor.user_id, role });
      toast({ title: `Role changed to ${role}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleInternal = async (checked: boolean) => {
    try {
      await toggleInternal.mutateAsync({ user_id: advisor.user_id, is_internal: checked });
      toast({ title: checked ? "Marked as GL Corporate" : "Marked as Field Advisor" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = advisor.status === "active" ? "inactive" : "active";
    try {
      await toggleStatus.mutateAsync({ user_id: advisor.user_id, status: newStatus });
      toast({ title: `Advisor ${newStatus === "active" ? "activated" : "deactivated"}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const currentRole = advisor.roles.includes("admin") ? "admin" : advisor.roles.includes("moderator") ? "moderator" : "user";
  const topHouseholds = (advisor.households || []).slice(0, 5);

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      {/* Back */}
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/admin/advisors")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> All Advisors
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-foreground">
            {(advisor.full_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {advisor.full_name || "Unnamed"}
            </h1>
            <p className="text-sm text-muted-foreground">{advisor.email}</p>
          </div>
        </div>
        <Badge
          variant={advisor.status === "active" ? "default" : "secondary"}
          className={advisor.status === "active"
            ? "bg-emerald/10 text-emerald border-emerald/20 text-sm px-3 py-1"
            : "bg-destructive/10 text-destructive border-destructive/20 text-sm px-3 py-1"}
        >
          {advisor.status === "active" ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Book of Business</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {formatFullCurrency(advisor.total_aum)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Home className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Households</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {advisor.household_count}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Last Login</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {advisor.last_sign_in_at
                ? new Date(advisor.last_sign_in_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Never"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-1.5" /> Profile</TabsTrigger>
          {isAdmin && <TabsTrigger value="security"><Lock className="w-4 h-4 mr-1.5" /> Security</TabsTrigger>}
          <TabsTrigger value="performance"><ShieldCheck className="w-4 h-4 mr-1.5" /> Performance</TabsTrigger>
        </TabsList>

        {/* ── PROFILE TAB ── */}
        <TabsContent value="profile">
          <Card className="border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Advisor Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  {isAdmin ? (
                    <Input value={displayName} onChange={(e) => setProfileName(e.target.value)} />
                  ) : (
                    <p className="text-sm text-foreground py-2">{displayName || "—"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="text-sm text-muted-foreground py-2">{advisor.email || "—"}</p>
                </div>
                <div className="space-y-2">
                  <Label>Office Location</Label>
                  {isAdmin ? (
                    <Input value={displayLocation} onChange={(e) => setProfileLocation(e.target.value)} />
                  ) : (
                    <p className="text-sm text-foreground py-2">{displayLocation || "—"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Staff Type</Label>
                  <p className="text-sm text-foreground py-2">
                    {advisor.is_internal ? "GL Corporate" : "Field Advisor"}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button onClick={handleSaveProfile} disabled={updateProfile.isPending} className="mt-2">
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="mt-6">
            <FirmAssignmentCard advisorUserId={advisor.user_id} />
          </div>
        </TabsContent>

        {/* ── SECURITY TAB (Admin only) ── */}
        {isAdmin && (
          <TabsContent value="security">
            <div className="space-y-6">
              {/* Reset Password */}
              <Card className="border-border shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Reset Password</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 items-end max-w-md">
                    <div className="flex-1 space-y-2">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                      />
                    </div>
                    <Button onClick={handleResetPassword} disabled={resetPassword.isPending}>
                      {resetPassword.isPending ? "Resetting..." : "Reset"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Role & Internal */}
              <Card className="border-border shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Role & Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between max-w-md">
                    <div>
                      <Label>GL Corporate (Internal)</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Internal staff have elevated platform visibility.</p>
                    </div>
                    <Switch
                      checked={!!advisor.is_internal}
                      onCheckedChange={handleToggleInternal}
                      disabled={toggleInternal.isPending}
                    />
                  </div>
                  <div className="max-w-md space-y-2">
                    <Label>Role</Label>
                    <Select value={currentRole} onValueChange={handleRoleChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Advisor</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Account Status */}
              <Card className="border-border shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Account Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between max-w-md">
                    <div>
                      <Label>Active Account</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {advisor.status === "active" ? "User can sign in and access the platform." : "User is blocked from signing in."}
                      </p>
                    </div>
                    <Switch
                      checked={advisor.status === "active"}
                      onCheckedChange={handleToggleStatus}
                      disabled={toggleStatus.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ── PERFORMANCE TAB ── */}
        <TabsContent value="performance">
          <Card className="border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Top 5 Households by AUM</CardTitle>
            </CardHeader>
            <CardContent>
              {topHouseholds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No households found for this advisor.</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Household</TableHead>
                        <TableHead className="text-right">Total AUM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topHouseholds.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium text-sm">{h.name}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {formatFullCurrency(h.total_aum)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* VPM Service — GL Internal only */}
      {isGlInternal && advisor && (
        <Card className="border-border shadow-none mt-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-base">VPM Service</CardTitle>
            </div>
            {!vpmEditing && (
              <Button variant="outline" size="sm" onClick={openVpmEdit}>
                Edit VPM Settings
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!vpmEditing ? (
              <>
                {advisorVpm?.vpm_enabled ? (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">VPM Active</p>
                      <p className="text-xs text-muted-foreground">
                        {advisorVpm.vpm_billing_type === "prime_partner"
                          ? "⭐ Prime Partner"
                          : advisorVpm.vpm_billing_type === "hourly"
                          ? `Hourly${
                              advisorVpm.vpm_hourly_rate
                                ? ` · $${advisorVpm.vpm_hourly_rate}/hr`
                                : ""
                            }`
                          : "Custom"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">VPM Not Active</p>
                  </div>
                )}
                {advisorVpm?.vpm_notes && (
                  <p className="text-xs italic text-muted-foreground">
                    {advisorVpm.vpm_notes}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="flex items-center justify-between">
                  <Label>VPM Service Active</Label>
                  <Switch checked={vpmEnabled} onCheckedChange={setVpmEnabled} />
                </div>

                {vpmEnabled && (
                  <div className="space-y-2">
                    <Label>Billing Type</Label>
                    <Select value={vpmBillingType} onValueChange={setVpmBillingType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly Billing</SelectItem>
                        <SelectItem value="prime_partner">Prime Partner (Included)</SelectItem>
                        <SelectItem value="none">Custom / TBD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {vpmEnabled && vpmBillingType === "hourly" && (
                  <div className="space-y-2">
                    <Label>Hourly Rate</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={vpmHourlyRate}
                        onChange={(e) => setVpmHourlyRate(e.target.value)}
                        placeholder="150"
                        className="max-w-[140px]"
                      />
                      <span className="text-sm text-muted-foreground">/ hour</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Textarea
                    rows={3}
                    value={vpmNotes}
                    onChange={(e) => setVpmNotes(e.target.value)}
                    placeholder="Billing arrangement details, special terms..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveVpm} disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? "Saving..." : "Save VPM Settings"}
                  </Button>
                  <Button variant="ghost" onClick={() => setVpmEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* GL Internal Admin — Danger Zone */}
      {showDangerZone && (
        <div className="mt-12 border border-destructive/30 rounded-lg overflow-hidden">
          <div className="bg-destructive/5 border-b border-destructive/20 px-5 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">Danger Zone — GL Internal Only</h3>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              Permanently delete households belonging to this advisor. This is intended only for cleaning up test data
              and is fully irreversible. All compliance notes, accounts, and contacts will also be deleted.
            </p>
            {(advisor.households || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">This advisor has no households.</p>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border">
                {(advisor.households || []).map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFullCurrency(h.total_aum)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/5 shrink-0"
                      onClick={() => {
                        setPendingDelete({ id: h.id, name: h.name });
                        setConfirmText("");
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>PERMANENTLY</strong> delete this household and ALL associated data including
              compliance notes, financial accounts, and contacts. This is irreversible and should only be used to
              remove test data. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">{pendingDelete?.name}</span> to confirm:
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={pendingDelete?.name}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              disabled={
                !pendingDelete ||
                confirmText !== pendingDelete.name ||
                deleteHouseholdAdmin.isPending
              }
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {deleteHouseholdAdmin.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
