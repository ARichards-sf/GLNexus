import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useIsGlInternal, useGlProfile } from "@/hooks/useAdmin";
import { useUnreadRequestCounts } from "@/hooks/useUnreadRequestCounts";
import { useFirmContext } from "@/hooks/useFirmContext";
import { useSelectedFirm } from "@/contexts/FirmContext";
import { useTaskNotificationCount } from "@/hooks/useTasks";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, Users, UserRound, CalendarDays, FileText, TrendingUp, ShieldCheck, TicketCheck, Building2, X, UsersRound, CheckSquare, BarChart3, Database, Terminal, Zap, LayoutGrid, ClipboardList, Sparkles, Settings,
} from "lucide-react";
import glLogo from "@/assets/nexus_logo.png";

const DEFAULT_FIRM_VALUE = "__default__";

const clientServiceItems = [
  { to: "/households", label: "Households", icon: Users },
  { to: "/contacts", label: "Contacts", icon: UserRound },
];

const activityItems = [
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, badgeKey: "tasks" as const },
  { to: "/my-requests", label: "My Requests", icon: TicketCheck, badgeKey: "myRequests" as const },
];

const insightsItems = [
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

const bdItems = [
  { to: "/pipeline", label: "Pipeline", icon: TrendingUp },
];

const internalItems = [
  { to: "/admin/advisors", label: "Advisors", icon: ShieldCheck },
  { to: "/admin/requests", label: "All Requests", icon: TicketCheck, badgeKey: "allRequests" as const },
  { to: "/admin/staff", label: "GL Staff", icon: UsersRound },
  { to: "/admin/firms", label: "Firm Management", icon: Building2 },
  { to: "/vpm/workspace", label: "VPM Workspace", icon: LayoutGrid },
  { to: "/admin/vpm-requests", label: "VPM Requests", icon: Zap },
  { to: "/admin/retention", label: "Data Retention", icon: Database },
  { to: "/admin/developer", label: "Developer Tools", icon: Terminal },
];

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isManager, isSuperAdmin, isDeveloper } = useIsAdmin();
  const { data: isGlInternal = false } = useIsGlInternal();
  const { data: glProfile } = useGlProfile();
  const { data: unreadCounts } = useUnreadRequestCounts();
  const { data: taskNotifCount = 0 } = useTaskNotificationCount();
  const { currentFirm, allFirms, membershipRole } = useFirmContext();
  const { selectedFirmId, setSelectedFirmId, clearSelectedFirm } = useSelectedFirm();
  const { impersonatedUser, vpmAdvisor, startVpmSession, stopVpmSession, isVpmSession } = useImpersonation();

  // ── Expanded role model ──
  const platformRole = glProfile?.platform_role || "user";
  const department = glProfile?.department || null;
  const isGlUser = !!glProfile?.is_gl_internal;

  // Feature access flags
  const hasVpmAccess = isGlUser && (department === "vpm" || isAdmin);
  const hasFirmAccess = isGlUser;
  const hasAdvisorAccess = isGlUser;
  const hasAllRequestsAccess = isGlUser && isAdmin;
  const hasStaffAccess = isGlUser && isAdmin;
  const hasRetentionAccess = isGlUser && isSuperAdmin;
  const hasDevAccess = isGlUser && isDeveloper;

  // Fetch VPM-enrolled advisors for the switcher
  const { data: vpmAdvisors = [] } = useQuery({
    queryKey: ["vpm_advisors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(`
          user_id,
          full_name,
          email,
          vpm_billing_type,
          is_prime_partner,
          firm_id,
          firms(name)
        `)
        .eq("vpm_enabled", true)
        .eq("is_gl_internal", false)
        .order("full_name");
      return (data || []).map((p: any) => ({
        id: p.user_id,
        name: p.full_name || p.email?.split("@")[0] || "Advisor",
        firmName: p.firms?.name || null,
        vpmBillingType: p.vpm_billing_type,
        isPrime: !!p.is_prime_partner,
      }));
    },
    enabled: hasVpmAccess,
    staleTime: 5 * 60 * 1000,
  });

  // User has an advisor role when they have a firm membership AND are not GL internal
  const hasAdvisorRole = !!currentFirm && !isGlInternal;

  // Show advisor nav when:
  // - user is an advisor (has firm, not GL internal)
  // - OR a GL internal user is currently impersonating an advisor
  // - OR a GL internal user is in a VPM session
  const showAdvisorNav = hasAdvisorRole || !!impersonatedUser || isVpmSession;

  // Show internal section to any GL internal user
  const showInternal = isGlUser;

  // Determine role label for the user footer
  const roleLabel = (() => {
    if (!isGlUser) {
      return membershipRole === "advisor_admin" ? "Firm Admin" : "Advisor";
    }
    const deptLabels: Record<string, string> = {
      vpm: "VPM",
      wam: "WAM",
      marketing: "Marketing",
      transitions: "Transitions",
      compliance: "Compliance",
      accounting: "Accounting",
      operations: "Operations",
    };
    const deptLabel = department ? deptLabels[department] : null;
    const roleLabels: Record<string, string> = {
      user: "GL Internal",
      manager: "Manager",
      admin: "Admin",
      super_admin: "Super Admin",
      developer: "Developer",
    };
    const rl = roleLabels[platformRole] || "GL Internal";
    return deptLabel ? `${deptLabel} · ${rl}` : rl;
  })();

  const fullName = glProfile?.full_name || user?.user_metadata?.full_name || null;
  const displayName = fullName || user?.email || "Advisor";
  const initials = (fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("")
    : displayName.slice(0, 2)
  ).slice(0, 2).toUpperCase();

  const isVpm = allFirms.length > 1;
  const selectedFirm = selectedFirmId ? allFirms.find((f) => f.id === selectedFirmId) ?? null : null;

  // Branding follows the selected firm (VPM scoped view), else current firm
  const brandingFirm = selectedFirm ?? currentFirm;
  const logoUrl = brandingFirm?.logo_url || glLogo;
  const firmName = brandingFirm?.name;
  const showFirmName = firmName && firmName !== "Good Life Companies";

  return (
    <aside
      className="hidden lg:flex flex-col w-64 border-r border-sidebar-border bg-sidebar h-screen px-4 py-6 shrink-0"
      style={brandingFirm?.accent_color ? { "--firm-accent": brandingFirm.accent_color } as React.CSSProperties : undefined}
    >
      <div className="flex flex-col gap-1 px-3 mb-4">
        <div className="flex items-center gap-2.5">
          <img src={logoUrl} alt={firmName || "Good Life Companies"} className="h-24 w-auto max-w-[220px] object-contain" />
        </div>
        {showFirmName && (
          <p
            className="text-xs font-semibold"
            style={{ color: brandingFirm?.accent_color || "hsl(var(--muted-foreground))" }}
          >
            {firmName}
          </p>
        )}
      </div>

      {isVpm && (
        <div className="px-3 mb-3">
          <Select
            value={selectedFirmId ?? DEFAULT_FIRM_VALUE}
            onValueChange={(val) => {
              if (val === DEFAULT_FIRM_VALUE) clearSelectedFirm();
              else setSelectedFirmId(val);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select firm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_FIRM_VALUE}>Good Life Companies</SelectItem>
              {allFirms.map((firm) => (
                <SelectItem key={firm.id} value={firm.id}>
                  {firm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedFirm && (
        <div
          className="mx-3 mb-4 px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 text-xs font-medium border"
          style={{
            backgroundColor: selectedFirm.accent_color ? `${selectedFirm.accent_color}15` : undefined,
            borderColor: selectedFirm.accent_color ? `${selectedFirm.accent_color}40` : undefined,
            color: selectedFirm.accent_color ?? undefined,
          }}
        >
          <span className="truncate">Viewing: {selectedFirm.name}</span>
          <button
            onClick={clearSelectedFirm}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            title="Clear firm view"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {hasVpmAccess && (
        <div className="px-3 mb-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/70">
            {isVpmSession ? "Serving" : "VPM Advisor"}
          </div>
          <Select
            value={vpmAdvisor?.id ?? "__none__"}
            onValueChange={(val) => {
              if (val === "__none__") {
                stopVpmSession();
              } else {
                const advisor = vpmAdvisors.find((a) => a.id === val);
                if (advisor) startVpmSession(advisor);
              }
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select advisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No advisor selected</SelectItem>
              {vpmAdvisors.map((advisor) => (
                <SelectItem key={advisor.id} value={advisor.id}>
                  <div className="flex items-center gap-1.5">
                    <span>{advisor.name}</span>
                    {advisor.isPrime && <span>⭐</span>}
                    {advisor.firmName && (
                      <span className="text-sidebar-foreground/70 text-[11px]">· {advisor.firmName}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isVpmSession && (
            <button
              onClick={stopVpmSession}
              className="flex items-center gap-1 text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              End session
            </button>
          )}
        </div>
      )}

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border">
        {/* Dashboard - standalone at top */}
        <RouterNavLink
          to="/"
          className={cn(
            "flex items-center gap-3 pl-[9px] pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            brandingFirm?.accent_color ? "border-l-[3px]" : "border-l-[3px] border-transparent",
            location.pathname === "/"
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            location.pathname !== "/" && "border-transparent"
          )}
          style={
            location.pathname === "/" && brandingFirm?.accent_color
              ? { borderColor: brandingFirm.accent_color }
              : undefined
          }
        >
          <LayoutDashboard className={cn(
            "w-[18px] h-[18px] text-[#1B3A6B] dark:text-blue-300",
            location.pathname === "/" ? "opacity-100" : "opacity-70 group-hover:opacity-100 transition-opacity"
          )} />
          <span className="flex-1">Dashboard</span>
        </RouterNavLink>
        <RouterNavLink
          to="/scorecard"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
              isActive
                ? "bg-primary/10 text-primary border-primary/20"
                : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent border-transparent"
            )
          }
        >
          <ClipboardList
            className={cn(
              "w-[18px] h-[18px]",
              location.pathname === "/scorecard"
                ? "opacity-100"
                : "opacity-70 group-hover:opacity-100 transition-opacity"
            )}
          />
          <span className="flex-1">Scorecard</span>
        </RouterNavLink>
        <RouterNavLink
          to="/goodie"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
              isActive
                ? "bg-sidebar-accent text-sidebar-foreground border-sidebar-accent-foreground/20"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent border-transparent"
            )
          }
        >
          <Sparkles className={cn(
            "w-[18px] h-[18px]",
            location.pathname === "/goodie"
              ? "opacity-100 text-amber-500"
              : "opacity-70 group-hover:opacity-100 transition-opacity"
          )} />
          <span className="flex-1">Goodie</span>
        </RouterNavLink>
        {showAdvisorNav && (
          <>
            <div className="mx-3 my-2 border-b border-sidebar-border/50" />

            {/* GROUP 1 — Client Service */}
            <div className="mt-4 mb-1 px-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70">Client Service</span>
            </div>
            {clientServiceItems.map((item) => {
              const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
              return (
                <RouterNavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 pl-[9px] pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px]",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "border-transparent text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive && !brandingFirm?.accent_color && "border-transparent"
                  )}
                  style={
                    isActive && brandingFirm?.accent_color
                      ? { borderColor: brandingFirm.accent_color }
                      : undefined
                  }
                >
                  <item.icon className={cn(
                    "w-[18px] h-[18px] text-blue-500 dark:text-blue-400",
                    isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100 transition-opacity"
                  )} />
                  <span className="flex-1">{item.label}</span>
                </RouterNavLink>
              );
            })}

            {/* GROUP 2 — Activity */}
            <div className="mt-4 mb-1 px-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70">Activity</span>
            </div>
            {activityItems.map((item) => {
              const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
              const badgeCount = item.badgeKey === "tasks"
                ? taskNotifCount
                : item.badgeKey && unreadCounts
                  ? (unreadCounts as any)[item.badgeKey]
                  : 0;
              return (
                <RouterNavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 pl-[9px] pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px]",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "border-transparent text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive && !brandingFirm?.accent_color && "border-transparent"
                  )}
                  style={
                    isActive && brandingFirm?.accent_color
                      ? { borderColor: brandingFirm.accent_color }
                      : undefined
                  }
                >
                  <item.icon className={cn(
                    "w-[18px] h-[18px] text-amber-500 dark:text-amber-400",
                    isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100 transition-opacity"
                  )} />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-sidebar-foreground/20 text-sidebar-foreground rounded-full">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </RouterNavLink>
              );
            })}

            {/* GROUP 3 — Insights */}
            <div className="mt-4 mb-1 px-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70">Insights</span>
            </div>
            {insightsItems.map((item) => {
              const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
              return (
                <RouterNavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 pl-[9px] pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px]",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "border-transparent text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive && !brandingFirm?.accent_color && "border-transparent"
                  )}
                  style={
                    isActive && brandingFirm?.accent_color
                      ? { borderColor: brandingFirm.accent_color }
                      : undefined
                  }
                >
                  <item.icon className={cn(
                    "w-[18px] h-[18px] text-emerald-500 dark:text-emerald-400",
                    isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100 transition-opacity"
                  )} />
                  <span className="flex-1">{item.label}</span>
                </RouterNavLink>
              );
            })}

            {/* GROUP 4 — Business Development */}
            <div className="mt-4 mb-2 px-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70">Business Development</span>
            </div>
            {bdItems.map((item) => {
              const isActive = location.pathname === item.to || location.pathname.startsWith(item.to);
              return (
                <RouterNavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 pl-[9px] pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px]",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "border-transparent text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive && !brandingFirm?.accent_color && "border-transparent"
                  )}
                  style={
                    isActive && brandingFirm?.accent_color
                      ? { borderColor: brandingFirm.accent_color }
                      : undefined
                  }
                >
                  <item.icon className={cn(
                    "w-[18px] h-[18px] text-purple-500 dark:text-purple-400",
                    isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100 transition-opacity"
                  )} />
                  <span className="flex-1">{item.label}</span>
                </RouterNavLink>
              );
            })}
          </>
        )}

        {showInternal && (
          <>
            <div className="mt-6 mb-2 px-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70">Internal</span>
            </div>
            {internalItems.map((item) => {
              if (item.to === "/admin/advisors" && !hasAdvisorAccess) return null;
              if (item.to === "/admin/requests" && !hasAllRequestsAccess) return null;
              if (item.to === "/admin/staff" && !hasStaffAccess) return null;
              if (item.to === "/admin/firms" && !hasFirmAccess) return null;
              if (item.to === "/vpm/workspace" && !hasVpmAccess) return null;
              if (item.to === "/admin/vpm-requests" && !hasVpmAccess) return null;
              if (item.to === "/admin/retention" && !hasRetentionAccess) return null;
              if (item.to === "/admin/developer" && !hasDevAccess) return null;
              const isActive = location.pathname.startsWith(item.to);
              const badgeKey = (item as any).badgeKey as string | undefined;
              const badgeCount = badgeKey && unreadCounts ? (unreadCounts as any)[badgeKey] : 0;
              return (
                <RouterNavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 pl-[9px] pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-[3px]",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "border-transparent text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive && !brandingFirm?.accent_color && "border-transparent"
                  )}
                  style={
                    isActive && brandingFirm?.accent_color
                      ? { borderColor: brandingFirm.accent_color }
                      : undefined
                  }
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {badgeKey && (
                    <span className="flex items-center gap-1">
                      {badgeKey === "allRequests" && (unreadCounts?.newRequests ?? 0) > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-destructive text-destructive-foreground rounded-full">
                          {(unreadCounts?.newRequests ?? 0) > 9 ? "9+" : unreadCounts?.newRequests}
                        </span>
                      )}
                      {badgeCount > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-sidebar-foreground/20 text-sidebar-foreground rounded-full">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </span>
                  )}
                </RouterNavLink>
              );
            })}
          </>
        )}

      </nav>

      <div className="px-3 pt-6 border-t border-sidebar-border">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="group w-full flex items-center gap-3 min-w-0 rounded-md px-1 py-1 -mx-1 hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-foreground/20 transition-colors text-left"
          title="Account settings"
        >
          <div className="shrink-0 w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-foreground">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate" title={displayName}>{displayName}</p>
            <p className="text-xs text-sidebar-foreground/80 truncate">{roleLabel}</p>
          </div>
          <Settings className="shrink-0 w-4 h-4 text-sidebar-foreground/60 group-hover:text-sidebar-foreground transition-colors" />
        </button>
      </div>
    </aside>
  );
}
