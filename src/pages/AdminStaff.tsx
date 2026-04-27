import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { UserPlus, Pencil } from "lucide-react";
import { useInternalUsers } from "@/hooks/useAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import InviteStaffDialog from "@/components/InviteStaffDialog";

const DEPT_META: Record<string, { label: string; className: string }> = {
  vpm:         { label: "VPM",         className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  wam:         { label: "WAM",         className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  marketing:   { label: "Marketing",   className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  transitions: { label: "Transitions", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  compliance:  { label: "Compliance",  className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  accounting:  { label: "Accounting",  className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  operations:  { label: "Operations",  className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  super_admin: "Super Admin",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 604800)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminStaff() {
  const { data: staff = [], isLoading } = useInternalUsers();
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">GL Staff</h1>
          <p className="text-muted-foreground mt-1">Manage internal Good Life Companies staff members.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Invite Staff Member
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Platform Role</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((member) => {
              const dept = member.department ? DEPT_META[member.department] : null;
              const initials = (member.full_name || "?")
                .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/staff/${member.user_id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                        {initials}
                      </div>
                      <span className="text-sm font-medium text-foreground">{member.full_name || "Unnamed"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    {dept ? (
                      <Badge variant="secondary" className={`text-[11px] font-medium ${dept.className}`}>
                        {dept.label}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.platform_role ? (
                      <Badge variant="outline" className="text-[11px] font-medium">
                        {ROLE_LABELS[member.platform_role] ?? member.platform_role}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {relativeTime(member.last_sign_in_at)}
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/admin/staff/${member.user_id}`)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {isLoading && staff.length === 0 && (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`staff-skeleton-${i}`}>
                  <TableCell colSpan={6} className="py-3">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            )}
            {!isLoading && staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                  No GL staff members yet. Click "Invite Staff Member" to add one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <InviteStaffDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
