import { useMemo } from "react";
import {
  useHousehold,
  useHouseholdMembers,
  useComplianceNotes,
  type MemberRow,
  type NoteRow,
  type HouseholdRow,
} from "@/hooks/useHouseholds";
import { useHouseholdAccounts } from "@/hooks/useHouseholdAccounts";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

export interface BriefMember {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  date_of_birth: string | null;
  age: number | null;
}

export interface BriefAccount {
  id: string;
  account_type: string;
  balance: number;
}

export interface BriefMemberAccountGroup {
  member_id: string;
  member_name: string;
  accounts: BriefAccount[];
  subtotal: number;
}

export interface BriefAccountSummary {
  totalAum: number;
  byMember: BriefMemberAccountGroup[];
}

export interface BriefNote {
  id: string;
  date: string;
  type: string;
  summary: string;
}

export interface PreMeetingBrief {
  event: CalendarEvent | null;
  household: HouseholdRow | null;
  members: BriefMember[];
  accountSummary: BriefAccountSummary;
  recentNotes: BriefNote[];
  isLoading: boolean;
  error: Error | null;
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function usePreMeetingBrief(
  event: CalendarEvent | null | undefined,
  householdId: string | undefined
): PreMeetingBrief {
  const householdQ = useHousehold(householdId);
  const membersQ = useHouseholdMembers(householdId);
  const accountsQ = useHouseholdAccounts(householdId);
  const notesQ = useComplianceNotes(householdId);

  const isLoading =
    householdQ.isLoading ||
    membersQ.isLoading ||
    accountsQ.isLoading ||
    notesQ.isLoading;

  const error =
    (householdQ.error as Error | null) ||
    (membersQ.error as Error | null) ||
    (accountsQ.error as Error | null) ||
    (notesQ.error as Error | null) ||
    null;

  const members = useMemo<BriefMember[]>(() => {
    return (membersQ.data ?? []).map((m: MemberRow) => ({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      relationship: m.relationship,
      date_of_birth: m.date_of_birth,
      age: calcAge(m.date_of_birth),
    }));
  }, [membersQ.data]);

  const accountSummary = useMemo<BriefAccountSummary>(() => {
    const accounts = accountsQ.data ?? [];
    const groups = new Map<string, BriefMemberAccountGroup>();
    let totalAum = 0;

    for (const a of accounts) {
      const balance = Number(a.balance) || 0;
      totalAum += balance;
      const memberId = a.member_id;
      const memberName = (a as { owner_name?: string }).owner_name || "Unknown";
      if (!groups.has(memberId)) {
        groups.set(memberId, {
          member_id: memberId,
          member_name: memberName,
          accounts: [],
          subtotal: 0,
        });
      }
      const g = groups.get(memberId)!;
      g.accounts.push({
        id: a.id,
        account_type: a.account_type,
        balance,
      });
      g.subtotal += balance;
    }

    return { totalAum, byMember: Array.from(groups.values()) };
  }, [accountsQ.data]);

  const recentNotes = useMemo<BriefNote[]>(() => {
    return (notesQ.data ?? []).slice(0, 3).map((n: NoteRow) => ({
      id: n.id,
      date: n.date,
      type: n.type,
      summary: n.summary,
    }));
  }, [notesQ.data]);

  return {
    event: event ?? null,
    household: (householdQ.data as HouseholdRow | undefined) ?? null,
    members,
    accountSummary,
    recentNotes,
    isLoading,
    error,
  };
}
