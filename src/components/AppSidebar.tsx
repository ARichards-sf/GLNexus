import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useUnreadRequestCounts } from "@/hooks/useUnreadRequestCounts";
import {
  LayoutDashboard, Users, UserRound, CalendarDays, FileText, Settings, TrendingUp, LogOut, ShieldCheck, TicketCheck,
} from "lucide-react";
import glLogo from "@/assets/gl-logo.png";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/households", label: "Households", icon: Users },
  { to: "/contacts", label: "Contacts", icon: UserRound },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/my-requests", label: "My Requests", icon: TicketCheck, badgeKey: "myRequests" as const },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/performance", label: "Performance", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminItems = [
  { to: "/admin/advisors", label: "Advisors", icon: ShieldCheck },
  { to: "/admin/requests", label: "All Requests", icon: TicketCheck, badgeKey: "allRequests" as const },
];

export default function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: unreadCounts } = useUnreadRequestCounts();

  const displayName = user?.user_metadata?.full_name || user?.email || "Advisor";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card min-h-screen px-4 py-6">
      <div className="flex items-center gap-2.5 px-3 mb-10">
        <img src={glLogo} alt="Good Life Companies" className="h-8 w-auto" />
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
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
              {badgeCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-full">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
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
                  {badgeCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-full">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
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
