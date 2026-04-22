export const REQUEST_TYPE_LABELS: Record<string, string> = {
  financial_planning_review: "Financial Planning Review",
  portfolio_analysis: "Portfolio Analysis",
  client_meeting_prep: "Client Meeting Prep",
  proposal_preparation: "Proposal Preparation",
  tax_planning_support: "Tax Planning Support",
  estate_planning_support: "Estate Planning Support",
  general_advisory_support: "General Advisory Support",
  other: "Other",
};

export const TIMELINE_LABELS: Record<string, string> = {
  asap: "ASAP",
  "24_hours": "24 hours",
  "3_days": "3 days",
  this_week: "This week",
  no_rush: "No rush",
};

export const TIMELINE_STYLES: Record<string, string> = {
  asap: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "24_hours": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "3_days": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  this_week: "bg-secondary text-muted-foreground",
  no_rush: "bg-secondary text-muted-foreground",
};

export const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-secondary text-muted-foreground",
};

export interface VpmRequestRow {
  id: string;
  ticket_number?: number | null;
  advisor_id: string;
  category: string;
  description: string;
  status: string;
  is_vpm: boolean;
  vpm_request_type: string | null;
  vpm_timeline: string | null;
  vpm_hours_logged: number | null;
  vpm_hours_notes: string | null;
  household_id: string | null;
  household_name: string | null;
  household_aum: number | null;
  created_at: string;
  priority?: string | null;
  advisor_name?: string | null;
  advisor_billing_type?: string | null;
}

export function getSubject(description: string) {
  const firstLine = description.split("\n")[0];
  return firstLine.length > 100 ? `${firstLine.slice(0, 100)}…` : firstLine;
}
