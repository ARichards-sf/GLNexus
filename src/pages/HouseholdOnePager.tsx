import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatFullCurrency } from "@/data/sampleData";

const ALLOC_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const formatLongDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const formatShortDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

interface OnePagerData {
  household: {
    id: string;
    name: string;
    total_aum: number | null;
    wealth_tier: string | null;
    risk_tolerance: string | null;
    investment_objective: string | null;
    status: string | null;
    annual_review_date: string | null;
    next_action: string | null;
    advisor_id: string | null;
  } | null;
  members: { first_name: string; last_name: string; relationship: string | null; date_of_birth: string | null }[];
  accounts: { account_name: string; account_type: string; balance: number; institution: string | null }[];
  notes: { date: string; type: string; summary: string | null }[];
  snapshots: { snapshot_date: string; total_aum: number }[];
}

export default function HouseholdOnePager() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const advisorName =
    user?.user_metadata?.full_name || user?.email || "Your advisor";

  const printedRef = useRef(false);
  const [chartReady, setChartReady] = useState(false);

  const { data, isLoading, isError } = useQuery<OnePagerData>({
    queryKey: ["household_onepager", id],
    queryFn: async () => {
      if (!id) throw new Error("No household id");
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [
        { data: household },
        { data: members },
        { data: accounts },
        { data: notes },
        { data: snapshots },
      ] = await Promise.all([
        supabase
          .from("households")
          .select(
            "id, name, total_aum, wealth_tier, risk_tolerance, investment_objective, status, annual_review_date, next_action, advisor_id",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("household_members")
          .select("first_name, last_name, relationship, date_of_birth")
          .eq("household_id", id)
          .is("archived_at", null)
          .order("relationship", { ascending: true }),
        supabase
          .from("contact_accounts")
          .select(
            "account_name, account_type, balance, institution, household_members!inner(household_id)",
          )
          .eq("household_members.household_id", id)
          .eq("status", "active")
          .order("balance", { ascending: false }),
        supabase
          .from("compliance_notes")
          .select("date, type, summary")
          .eq("household_id", id)
          .order("date", { ascending: false })
          .limit(5),
        supabase
          .from("household_snapshots")
          .select("snapshot_date, total_aum")
          .eq("household_id", id)
          .gte("snapshot_date", ninetyDaysAgo.toISOString().split("T")[0])
          .order("snapshot_date", { ascending: true }),
      ]);

      return {
        household: household as any,
        members: (members ?? []) as any,
        accounts: (accounts ?? []).map((a: any) => ({
          account_name: a.account_name,
          account_type: a.account_type,
          balance: Number(a.balance),
          institution: a.institution,
        })),
        notes: (notes ?? []) as any,
        snapshots: ((snapshots ?? []) as any[]).map((s) => ({
          snapshot_date: s.snapshot_date,
          total_aum: Number(s.total_aum),
        })),
      };
    },
    enabled: !!id,
  });

  const aumChart = useMemo(
    () =>
      (data?.snapshots ?? []).map((s) => ({
        date: formatShortDate(s.snapshot_date),
        aum: s.total_aum,
      })),
    [data],
  );

  const allocation = useMemo(() => {
    const byType: Record<string, number> = {};
    (data?.accounts ?? []).forEach((a) => {
      const t = a.account_type || "Other";
      byType[t] = (byType[t] || 0) + a.balance;
    });
    return Object.entries(byType)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const totalAccountsAum = useMemo(
    () => (data?.accounts ?? []).reduce((s, a) => s + a.balance, 0),
    [data],
  );

  // Auto-print once data + charts are ready (charts paint on next frame).
  useEffect(() => {
    if (!data?.household) return;
    if (printedRef.current) return;
    // Wait for the chart to paint. Recharts uses RAF internally; an
    // 800ms buffer is generous and safe.
    const t = setTimeout(() => {
      setChartReady(true);
      printedRef.current = true;
      window.print();
    }, 800);
    return () => clearTimeout(t);
  }, [data]);

  const handlePrint = () => {
    setChartReady(true);
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Preparing 1-pager…
        </div>
      </div>
    );
  }

  if (isError || !data?.household) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-700">Household not found.</p>
          <Link to="/households">
            <Button variant="outline" size="sm">Back to households</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hh = data.household;
  const headlineAum = totalAccountsAum > 0 ? totalAccountsAum : Number(hh.total_aum ?? 0);
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Toolbar — hidden in print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link to={`/household/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to household
          </Button>
        </Link>
        <Button size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-1.5" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Page */}
      <div className="max-w-[800px] mx-auto bg-white p-10 print:p-8 print:max-w-none print:mx-0 text-gray-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
              Household 1-Pager
            </p>
            <h1 className="text-3xl font-bold mt-1">{hh.name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Prepared by {advisorName} · {today}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
              Total AUM
            </p>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">
              {formatFullCurrency(headlineAum)}
            </p>
            {hh.wealth_tier && (
              <p className="text-xs uppercase tracking-wider text-gray-600 mt-1">
                {hh.wealth_tier} tier
              </p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Stat label="Status" value={hh.status ?? "—"} />
          <Stat label="Risk tolerance" value={hh.risk_tolerance ?? "—"} />
          <Stat label="Objective" value={hh.investment_objective ?? "—"} />
          <Stat label="Next review" value={formatLongDate(hh.annual_review_date)} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="col-span-3 border border-gray-200 rounded-md p-3 bg-white">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
              AUM trend (last 90 days)
            </p>
            {aumChart.length >= 2 ? (
              <LineChart width={440} height={200} data={aumChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  width={70}
                />
                <Tooltip
                  formatter={(value: number) => [formatFullCurrency(value), "AUM"]}
                  contentStyle={{ fontSize: "11px" }}
                />
                <Line
                  type="monotone"
                  dataKey="aum"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!chartReady}
                />
              </LineChart>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-gray-500">
                Not enough snapshot data yet.
              </div>
            )}
          </div>
          <div className="col-span-2 border border-gray-200 rounded-md p-3 bg-white">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
              Asset allocation
            </p>
            {allocation.length > 0 ? (
              <PieChart width={260} height={200}>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  isAnimationActive={!chartReady}
                >
                  {allocation.map((_, i) => (
                    <Cell key={i} fill={ALLOC_COLORS[i % ALLOC_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatFullCurrency(value), name]}
                  contentStyle={{ fontSize: "11px" }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
              </PieChart>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-gray-500">
                No active accounts.
              </div>
            )}
          </div>
        </div>

        {/* Members */}
        {data.members.length > 0 && (
          <Section title="Household members">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {data.members.map((m, i) => {
                const age = m.date_of_birth
                  ? Math.floor(
                      (Date.now() - new Date(m.date_of_birth).getTime()) /
                        (365.25 * 24 * 60 * 60 * 1000),
                    )
                  : null;
                return (
                  <div key={i} className="flex items-baseline gap-2">
                    <span className="font-medium">
                      {m.first_name} {m.last_name}
                    </span>
                    {m.relationship && (
                      <span className="text-xs text-gray-600">· {m.relationship}</span>
                    )}
                    {age !== null && (
                      <span className="text-xs text-gray-500">· age {age}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Accounts */}
        {data.accounts.length > 0 && (
          <Section title="Accounts">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-left font-semibold pb-1.5 border-b border-gray-300">Account</th>
                  <th className="text-left font-semibold pb-1.5 border-b border-gray-300">Type</th>
                  <th className="text-left font-semibold pb-1.5 border-b border-gray-300">Institution</th>
                  <th className="text-right font-semibold pb-1.5 border-b border-gray-300">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-1.5">{a.account_name}</td>
                    <td className="py-1.5 text-gray-600">{a.account_type}</td>
                    <td className="py-1.5 text-gray-600">{a.institution ?? "—"}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {formatFullCurrency(a.balance)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="pt-2 text-right text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    Total
                  </td>
                  <td className="pt-2 text-right tabular-nums font-bold">
                    {formatFullCurrency(totalAccountsAum)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        )}

        {/* Recent activity */}
        {data.notes.length > 0 && (
          <Section title="Recent activity">
            <ul className="space-y-2 text-sm">
              {data.notes.map((n, i) => (
                <li key={i}>
                  <div className="text-xs text-gray-500">
                    <span className="tabular-nums">{formatLongDate(n.date)}</span>
                    <span> · {n.type}</span>
                  </div>
                  {n.summary && (
                    <p className="text-sm text-gray-800 leading-snug mt-0.5">{n.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-gray-300 text-[10px] text-gray-500 leading-relaxed">
          <p>
            This document is a summary prepared for review purposes. Account balances reflect the
            most recent snapshot on file. Past performance is not indicative of future results.
            Please verify all figures with your custodian statements before relying on them for
            financial decisions.
          </p>
        </div>
      </div>

      {/* Print-only tweaks: keep the chart svg from being clipped, force colors. */}
      <style>{`
        @media print {
          @page { size: Letter; margin: 0.4in; }
          html, body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-md px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2 pb-1 border-b border-gray-200">
        {title}
      </h2>
      {children}
    </section>
  );
}
