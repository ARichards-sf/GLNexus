import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useIsGlInternal } from "@/hooks/useAdmin";
import { useUnreadRequestCounts } from "@/hooks/useUnreadRequestCounts";
import { useFirmContext } from "@/hooks/useFirmContext";
import { useSelectedFirm } from "@/contexts/FirmContext";
import { useTaskNotificationCount } from "@/hooks/useTasks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, Users, UserRound, CalendarDays, FileText, Settings, TrendingUp, LogOut, ShieldCheck, TicketCheck, Building2, X, UsersRound, CheckSquare, BarChart3,
} from "lucide-react";
import glLogo from "@/assets/gl-logo.png";

const DEFAULT_FIRM_VALUE = "__default__";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/households", label: "Households", icon: Users },
  { to: "/contacts", label: "Contacts", icon: UserRound },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/my-requests", label: "My Requests", icon: TicketCheck, badgeKey: "myRequests" as const },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, badgeKey: "tasks" as const },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/performance", label: "Performance", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminItems = [
  { to: "/admin/advisors", label: "Advisors", icon: ShieldCheck },
  { to: "/admin/requests", label: "All Requests", icon: TicketCheck, badgeKey: "allRequests" as const },
];

const bdItems = [
  { to: "/pipeline", label: "Pipeline", icon: TrendingUp },
];

const internalItems = [
  { to: "/admin/staff", label: "GL Staff", icon: UsersRound },
  { to: "/admin/firms", label: "Firm Management", icon: Building2 },
];

export default function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: isGlInternal = false } = useIsGlInternal();
  const { data: unreadCounts } = useUnreadRequestCounts();
  const { data: taskNotifCount = 0 } = useTaskNotificationCount();
  const { currentFirm, allFirms } = useFirmContext();
  const { selectedFirmId, setSelectedFirmId, clearSelectedFirm } = useSelectedFirm();

  const showInternal = isAdmin || isGlInternal;

  const displayName = user?.user_metadata?.full_name || user?.email || "Advisor";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const isVpm = allFirms.length > 1;
  const selectedFirm = selectedFirmId ? allFirms.find((f) => f.id === selectedFirmId) ?? null : null;

  // Branding follows the selected firm (VPM scoped view), else current firm
  const brandingFirm = selectedFirm ?? currentFirm;
  const logoUrl = brandingFirm?.logo_url || glLogo;
  const firmName = brandingFirm?.name;
  const showFirmName = firmName && firmName !== "Good Life Companies";

  return (
    <aside
      className="hidden lg:flex flex-col w-64 border-r border-border bg-card min-h-screen px-4 py-6"
      style={brandingFirm?.accent_color ? { "--firm-accent": brandingFirm.accent_color } as React.CSSProperties : undefined}
    >
      <div className="flex flex-col gap-1 px-3 mb-4">
        <div className="flex items-center gap-2.5">
          <img src={logoUrl} alt={firmName || "Good Life Companies"} className="h-8 w-auto" />
        </div>
        {showFirmName && (
          <p className="text-xs text-muted-foreground">{firmName}</p>
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

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-full">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </RouterNavLink>
          );
        })}

        <div className="mt-6 mb-2 px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Business Development</span>
        </div>
        {bdItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to);
          return (
            <RouterNavLink
              key={item.label}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span className="flex-1">{item.label}</span>
            </RouterNavLink>
          );
        })}

        {isAdmin && (
          <>
            <div className="mt-6 mb-2 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</span>
            </div>
            {adminItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              const badgeCount = item.badgeKey && unreadCounts ? unreadCounts[item.badgeKey] : 0;
              return (
                <RouterNavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  <span className="flex items-center gap-1">
                    {item.badgeKey === "allRequests" && (unreadCounts?.newRequests ?? 0) > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-destructive text-destructive-foreground rounded-full">
                        {(unreadCounts?.newRequests ?? 0) > 9 ? "9+" : unreadCounts?.newRequests}
                      </span>
                    )}
                    {badgeCount > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-full">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    )}
                  </span>
                </RouterNavLink>
              );
            })}
          </>
        )}

        {showInternal && (
          <>
            <div className="mt-6 mb-2 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Internal</span>
            </div>
            {internalItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <RouterNavLink
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span className="flex-1">{item.label}</span>
                </RouterNavLink>
              );
            })}
          </>
        )}
      </nav>

      <div className="mt-auto px-3 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">{initials}</div>
            <div>
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Advisor"}</p>
            </div>
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
