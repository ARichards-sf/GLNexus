import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Settings,
  TrendingUp,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/households", label: "Households", icon: Users },
  { to: "#", label: "Calendar", icon: CalendarDays },
  { to: "#", label: "Reports", icon: FileText },
  { to: "#", label: "Performance", icon: TrendingUp },
  { to: "#", label: "Settings", icon: Settings },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card min-h-screen px-4 py-6">
      <div className="flex items-center gap-2.5 px-3 mb-10">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">WealthFlow</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
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
              {item.label}
            </RouterNavLink>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">SC</div>
          <div>
            <p className="text-sm font-medium text-foreground">Sarah Chen</p>
            <p className="text-xs text-muted-foreground">Senior Advisor</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
