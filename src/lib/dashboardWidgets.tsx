import {
  LayoutDashboard,
  CheckSquare,
  TrendingUp,
  Users,
  BarChart3,
  GitBranch,
  FileText,
  Zap,
} from "lucide-react";

export type WidgetSize = "small" | "large";

export interface WidgetDefinition {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  defaultOn: boolean;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: "morning_briefing",
    label: "Morning Briefing",
    description: "AI-generated daily briefing with tasks, meetings and pipeline",
    icon: Zap,
    defaultSize: "large",
    allowedSizes: ["large"],
    defaultOn: true,
  },
  {
    id: "kpi_cards",
    label: "Practice Overview",
    description: "AUM, household count and upcoming reviews at a glance",
    icon: LayoutDashboard,
    defaultSize: "large",
    allowedSizes: ["large"],
    defaultOn: true,
  },
  {
    id: "pending_tasks",
    label: "Pending Tasks",
    description: "Your highest priority tasks due today and this week",
    icon: CheckSquare,
    defaultSize: "small",
    allowedSizes: ["small", "large"],
    defaultOn: true,
  },
  {
    id: "pipeline_summary",
    label: "Pipeline Summary",
    description: "Active prospects by stage and total pipeline value",
    icon: GitBranch,
    defaultSize: "small",
    allowedSizes: ["small", "large"],
    defaultOn: true,
  },
  {
    id: "top_households",
    label: "Top Households",
    description: "Your Platinum and Gold tier clients at a glance",
    icon: Users,
    defaultSize: "small",
    allowedSizes: ["small", "large"],
    defaultOn: false,
  },
  {
    id: "overdue_reviews",
    label: "Overdue Reviews",
    description: "Households past their annual review date",
    icon: FileText,
    defaultSize: "small",
    allowedSizes: ["small", "large"],
    defaultOn: false,
  },
  {
    id: "recent_activity",
    label: "Recent Activity",
    description: "Latest compliance notes and client interactions",
    icon: BarChart3,
    defaultSize: "small",
    allowedSizes: ["small", "large"],
    defaultOn: false,
  },
  {
    id: "client_scorecard",
    label: "Client Scorecard",
    description: "Households with active touchpoints, overdue engagements, and timeline progress",
    icon: BarChart3,
    defaultSize: "large",
    allowedSizes: ["small", "large"],
    defaultOn: false,
  },
  {
    id: "referral_leaderboard",
    label: "Referral Leaderboard",
    description: "Top referring households in your book",
    icon: TrendingUp,
    defaultSize: "small",
    allowedSizes: ["small", "large"],
    defaultOn: false,
  },
];

export interface WidgetInstance {
  id: string;
  widgetId: string;
  size: WidgetSize;
}

export const DEFAULT_LAYOUT: WidgetInstance[] = WIDGET_REGISTRY.filter((w) => w.defaultOn).map((w) => ({
  id: w.id,
  widgetId: w.id,
  size: w.defaultSize,
}));
