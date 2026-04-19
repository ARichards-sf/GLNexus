import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pencil, Building2, Clock, Calendar, Info, AlertTriangle } from "lucide-react";
import {
  useInternalUsers, useUpdateInternalUser, useToggleAdvisorStatus, useGlProfile,
} from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import ManageStaffFirmsDialog from "@/components/ManageStaffFirmsDialog";

const DEPARTMENTS = ["vpm", "wam", "marketing", "transitions", "compliance", "accounting", "operations"] as const;

const ROLE_LABELS: Record<string, string> = {
  user:        "Standard User",
  manager:     "Manager",
  admin:       "Admin",
  super_admin: "Super Admin",
  developer:   "Developer",
};

const FIRM_OPTIONAL_DEPTS = new Set(["marketing", "transitions", "compliance", "accounting", "operations"]);


function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: staff = [], isLoading } = useInternalUsers();
  const { data: myProfile } = useGlProfile();
  const isSuperAdmin = myProfile?.platform_role === "super_admin";
  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter((r) => r !== "developer");
  const updateUser = useUpdateInternalUser();
  const toggleStatus = useToggleAdvisorStatus();

  const member = staff.find((s) => s.user_id === id);

  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState<string>("");
  const [formDept, setFormDept] = useState<string>("");
  const [formRole, setFormRole] = useState<string>("");
  const [firmsOpen, setFirmsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="h-32 bg-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/admin/staff")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> All Staff
        </Button>
        <p className="text-sm text-muted-foreground">Staff member not found.</p>
      </div>
    );
  }

  const dept = member.department ? DEPT_META[member.department] : null;
  const isStatusActive = (member as any).status !== "inactive";
  const firmOptional = member.department ? FIRM_OPTIONAL_DEPTS.has(member.department) : false;
  const currentFirmIds = member.firm_assignments.map((a) => a.firm_id);

  const startEdit = () => {
    setFormName(member.full_name ?? "");
    setFormDept(member.department ?? "");
    setFormRole(member.platform_role ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateUser.mutateAsync({
        user_id: member.user_id,
        full_name: formName,
        department: formDept || undefined,
        platform_role: formRole || undefined,
      });
      toast({ title: "Profile updated" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = isStatusActive ? "inactive" : "active";
    try {
      await toggleStatus.mutateAsync({ user_id: member.user_id, status: newStatus });
      toast({ title: `Staff member ${newStatus === "active" ? "activated" : "deactivated"}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/admin/staff")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> All Staff
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-foreground">
            {(member.full_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {member.full_name || "Unnamed"}
            </h1>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={isStatusActive ? "default" : "secondary"}
            className={isStatusActive
              ? "bg-emerald/10 text-emerald border-emerald/20 text-sm px-3 py-1"
              : "bg-destructive/10 text-destructive border-destructive/20 text-sm px-3 py-1"}
          >
            {isStatusActive ? "Active" : "Inactive"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={toggleStatus.isPending}
          >
            {isStatusActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>

      {/* Profile Section */}
      <Card className="border-border shadow-none mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Profile</CardTitle>
          {!editing && (
            <Button variant="ghost" size="sm" className="h-8" onClick={startEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <p className="text-sm text-foreground">{member.full_name || "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm text-foreground">{member.email || "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Department</Label>
                {dept ? (
                  <Badge variant="secondary" className={`text-[11px] font-medium ${dept.className}`}>
                    {dept.label}
                  </Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Platform Role</Label>
                {member.platform_role ? (
                  <Badge variant="outline" className="text-[11px] font-medium">
                    {ROLE_LABELS[member.platform_role] ?? member.platform_role}
                  </Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="text-sm text-muted-foreground py-2">{member.email || "—"}</p>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={formDept} onValueChange={setFormDept}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{DEPT_META[d].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Platform Role</Label>
                  <Select value={formRole} onValueChange={setFormRole}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formRole === "developer" && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Developer role grants full data deletion access. Assign with caution.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={updateUser.isPending}>
                  {updateUser.isPending ? "Saving…" : "Save Changes"}
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Firm Assignments Section */}
      <Card className="border-border shadow-none mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Firm Assignments
          </CardTitle>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setFirmsOpen(true)}>
            Manage Firms
          </Button>
        </CardHeader>
        <CardContent>
          {firmOptional && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/60 border border-border mb-4">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                This role has access to all advisor requests by default. Firm assignment is optional.
              </p>
            </div>
          )}
          {member.firm_assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No firms assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {member.firm_assignments.map((a) => (
                <div
                  key={a.firm_id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card"
                >
                  {a.firm?.accent_color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: a.firm.accent_color }}
                    />
                  )}
                  <span className="text-sm font-medium text-foreground">{a.firm?.name ?? "Unknown firm"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Section */}
      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Last Sign In
              </Label>
              <p className="text-sm text-foreground">{formatDate(member.last_sign_in_at)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Account Created
              </Label>
              <p className="text-sm text-foreground">{formatDate(member.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ManageStaffFirmsDialog
        open={firmsOpen}
        onOpenChange={setFirmsOpen}
        userId={member.user_id}
        currentFirmIds={currentFirmIds}
      />
    </div>
  );
}
