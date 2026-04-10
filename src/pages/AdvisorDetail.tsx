import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  ArrowLeft, DollarSign, Home, Clock, ShieldCheck, Lock, User,
} from "lucide-react";
import {
  useAdvisorDetail, useUpdateAdvisorProfile, useResetAdvisorPassword,
  useUpdateAdvisorRole, useToggleInternal, useToggleAdvisorStatus,
  useIsAdmin,
} from "@/hooks/useAdmin";
import { formatFullCurrency } from "@/data/sampleData";
import { useToast } from "@/hooks/use-toast";

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
    </div>
  );
}
