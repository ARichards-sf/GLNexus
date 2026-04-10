export interface HouseholdMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship: "Head of Household" | "Spouse" | "Dependent" | "Other";
  dateOfBirth: string;
  age: number;
  email?: string;
  phone?: string;
}

export interface ComplianceNote {
  id: string;
  date: string;
  type: "Prospecting" | "Review" | "Service" | "Onboarding" | "Compliance";
  summary: string;
  advisor: string;
}

export interface Household {
  id: string;
  name: string;
  totalAUM: number;
  riskTolerance: "Conservative" | "Moderate" | "Moderate-Aggressive" | "Aggressive";
  investmentObjective: string;
  members: HouseholdMember[];
  complianceLog: ComplianceNote[];
  nextAction: string;
  nextActionDate: string;
  annualReviewDate: string;
  status: "Active" | "Prospect" | "Inactive";
}

export const sampleHouseholds: Household[] = [
  {
    id: "hh-001",
    name: "The Miller Family",
    totalAUM: 2400000,
    riskTolerance: "Moderate-Aggressive",
    investmentObjective: "Long-term Growth with Income",
    status: "Active",
    annualReviewDate: "2026-05-15",
    nextAction: "Prepare Q2 portfolio rebalance proposal — equity allocation drifted 4% above target.",
    nextActionDate: "2026-04-18",
    members: [
      { id: "m-001", firstName: "Robert", lastName: "Miller", relationship: "Head of Household", dateOfBirth: "1968-03-12", age: 58, email: "robert.miller@email.com", phone: "(555) 234-5678" },
      { id: "m-002", firstName: "Catherine", lastName: "Miller", relationship: "Spouse", dateOfBirth: "1970-07-22", age: 55, email: "catherine.miller@email.com", phone: "(555) 234-5679" },
      { id: "m-003", firstName: "Emily", lastName: "Miller", relationship: "Dependent", dateOfBirth: "2002-11-05", age: 23 },
      { id: "m-004", firstName: "James", lastName: "Miller", relationship: "Dependent", dateOfBirth: "2005-09-18", age: 20 },
    ],
    complianceLog: [
      { id: "n-001", date: "2026-04-02", type: "Service", summary: "Client called regarding RMD distribution from IRA. Confirmed $42,000 distribution scheduled for December.", advisor: "Sarah Chen" },
      { id: "n-002", date: "2026-03-15", type: "Review", summary: "Annual review completed. Discussed estate plan updates, college funding for James, and Catherine's Roth conversion strategy.", advisor: "Sarah Chen" },
      { id: "n-003", date: "2026-02-10", type: "Service", summary: "Updated beneficiary designations on all accounts per client request after estate attorney review.", advisor: "Sarah Chen" },
      { id: "n-004", date: "2026-01-08", type: "Compliance", summary: "Suitability review completed. Risk tolerance confirmed as Moderate-Aggressive. No changes required.", advisor: "Sarah Chen" },
      { id: "n-005", date: "2025-11-20", type: "Prospecting", summary: "Robert referred colleague David Park. Scheduled introductory meeting for December.", advisor: "Sarah Chen" },
    ],
  },
  {
    id: "hh-002",
    name: "The Chen Family",
    totalAUM: 5800000,
    riskTolerance: "Moderate",
    investmentObjective: "Balanced Growth & Preservation",
    status: "Active",
    annualReviewDate: "2026-06-20",
    nextAction: "Review tax-loss harvesting opportunities before Q2 close.",
    nextActionDate: "2026-04-25",
    members: [
      { id: "m-005", firstName: "Wei", lastName: "Chen", relationship: "Head of Household", dateOfBirth: "1962-01-15", age: 64, email: "wei.chen@email.com" },
      { id: "m-006", firstName: "Lin", lastName: "Chen", relationship: "Spouse", dateOfBirth: "1965-08-30", age: 60 },
    ],
    complianceLog: [
      { id: "n-006", date: "2026-03-28", type: "Review", summary: "Mid-year check-in. Client interested in ESG allocation shift.", advisor: "Sarah Chen" },
    ],
  },
  {
    id: "hh-003",
    name: "The Johnson Family",
    totalAUM: 1200000,
    riskTolerance: "Conservative",
    investmentObjective: "Capital Preservation & Income",
    status: "Active",
    annualReviewDate: "2026-04-28",
    nextAction: "Prepare annual review deck with Social Security claiming analysis.",
    nextActionDate: "2026-04-14",
    members: [
      { id: "m-007", firstName: "Thomas", lastName: "Johnson", relationship: "Head of Household", dateOfBirth: "1955-06-10", age: 70 },
      { id: "m-008", firstName: "Margaret", lastName: "Johnson", relationship: "Spouse", dateOfBirth: "1957-12-03", age: 68 },
    ],
    complianceLog: [
      { id: "n-007", date: "2026-04-05", type: "Service", summary: "Client requested cash distribution of $15,000 for home repair.", advisor: "Sarah Chen" },
    ],
  },
  {
    id: "hh-004",
    name: "The Patel Family",
    totalAUM: 3100000,
    riskTolerance: "Aggressive",
    investmentObjective: "Maximum Growth",
    status: "Active",
    annualReviewDate: "2026-07-10",
    nextAction: "Schedule onboarding for new 401(k) rollover account ($450K).",
    nextActionDate: "2026-04-20",
    members: [
      { id: "m-009", firstName: "Raj", lastName: "Patel", relationship: "Head of Household", dateOfBirth: "1975-04-22", age: 51, email: "raj.patel@email.com" },
    ],
    complianceLog: [],
  },
];

export const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export const formatFullCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
};
