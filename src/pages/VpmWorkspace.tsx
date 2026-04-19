import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Zap, X } from "lucide-react";

interface VpmAdvisorEntry {
  id: string;
  name: string;
  firmName: string | null;
  vpmBillingType: string | null;
  isPrime: boolean;
  hourlyRate: number | null;
}

function formatAum(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function VpmWorkspace() {
  const navigate = useNavigate();
  const { vpmAdvisor, startVpmSession, stopVpmSession, isVpmSession } = useImpersonation();

  const { data: vpmAdvisors = [] } = useQuery({
    queryKey: ["vpm_advisors_workspace"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(`
          user_id,
          full_name,
          email,
          vpm_billing_type,
          vpm_hourly_rate,
          is_prime_partner,
          firm_id,
          firms(name)
        `)
        .eq("vpm_enabled", true)
        .eq("is_gl_internal", false)
        .order("full_name");
      return (data || []).map((p: any): VpmAdvisorEntry => ({
        id: p.user_id,
        name: p.full_name || p.email?.split("@")[0] || "Advisor",
        firmName: p.firms?.name || null,
        vpmBillingType: p.vpm_billing_type,
        isPrime: !!p.is_prime_partner,
        hourlyRate: p.vpm_hourly_rate ?? null,
      }));
    },
  });

  const advisorIds = vpmAdvisors.map((a) => a.id);

  // AUM + household counts
  const { data: householdStats = {} } = useQuery({
    queryKey: ["vpm_household_stats", advisorIds.join(",")],
    queryFn: async () => {
      if (advisorIds.length === 0) return {};
      const { data } = await supabase
        .from("households")
        .select("advisor_id, total_aum, status")
        .in("advisor_id", advisorIds)
        .eq("status", "Active");
      const map: Record<string, { aum: number; count: number }> = {};
      (data || []).forEach((h: any) => {
        if (!map[h.advisor_id]) map[h.advisor_id] = { aum: 0, count: 0 };
        map[h.advisor_id].aum += Number(h.total_aum || 0);
        map[h.advisor_id].count += 1;
      });
      return map;
    },
    enabled: advisorIds.length > 0,
  });

  // Open VPM requests per advisor
  const { data: requestStats = {} } = useQuery({
    queryKey: ["vpm_request_stats", advisorIds.join(",")],
    queryFn: async () => {
      if (advisorIds.length === 0) return {};
      const { data } = await supabase
        .from("service_requests")
        .select("advisor_id, status, is_vpm")
        .in("advisor_id", advisorIds)
        .eq("is_vpm", true)
        .neq("status", "closed");
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.advisor_id] = (map[r.advisor_id] || 0) + 1;
      });
      return map;
    },
    enabled: advisorIds.length > 0,
  });

  const totalAdvisors = vpmAdvisors.length;
  const primeCount = vpmAdvisors.filter((a) => a.isPrime).length;
  const activeRequestCount = Object.values(requestStats as Record<string, number>).reduce(
    (s, n) => s + n,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <LayoutGrid className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">VPM Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Virtual Practice Management — your assigned advisors
          </p>
        </div>
      </div>

      {/* Active session banner */}
      {isVpmSession && vpmAdvisor && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground">Active VPM Session</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Currently serving <strong>{vpmAdvisor.name}</strong> — their data is visible in
                Households, Contacts, and Accounts
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={stopVpmSession}>
            <X className="w-3.5 h-3.5 mr-1" />
            End Session
          </Button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Total VPM Advisors
            </div>
            <div className="text-2xl font-semibold mt-1">{totalAdvisors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Prime Partners
            </div>
            <div className="text-2xl font-semibold mt-1">{primeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Active Requests
            </div>
            <div className="text-2xl font-semibold mt-1">{activeRequestCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Advisor grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vpmAdvisors.map((advisor) => {
          const stats = (householdStats as Record<string, { aum: number; count: number }>)[advisor.id] || {
            aum: 0,
            count: 0,
          };
          const openReqs = (requestStats as Record<string, number>)[advisor.id] || 0;
          const isActive = vpmAdvisor?.id === advisor.id;

          return (
            <Card
              key={advisor.id}
              className={isActive ? "ring-2 ring-primary border-primary/40" : undefined}
            >
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-secondary text-foreground flex items-center justify-center text-sm font-semibold">
                    {getInitials(advisor.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold truncate">{advisor.name}</div>
                      {isActive && (
                        <Badge variant="default" className="text-[10px]">
                          Active Session
                        </Badge>
                      )}
                    </div>
                    {advisor.firmName && (
                      <div className="text-xs text-muted-foreground truncate">
                        {advisor.firmName}
                      </div>
                    )}
                    <div className="mt-1.5">
                      {advisor.isPrime ? (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                          ⭐ Prime Partner
                        </Badge>
                      ) : advisor.vpmBillingType === "hourly" && advisor.hourlyRate ? (
                        <Badge className="bg-blue-100 text-blue-900 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">
                          ${advisor.hourlyRate}/hr
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {advisor.vpmBillingType || "—"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      AUM
                    </div>
                    <div className="text-sm font-semibold mt-0.5">{formatAum(stats.aum)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Households
                    </div>
                    <div className="text-sm font-semibold mt-0.5">{stats.count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Open Reqs
                    </div>
                    <div className="text-sm font-semibold mt-0.5">{openReqs}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      startVpmSession({
                        id: advisor.id,
                        name: advisor.name,
                        firmName: advisor.firmName,
                        vpmBillingType: advisor.vpmBillingType,
                        isPrime: advisor.isPrime,
                      });
                      navigate("/households");
                    }}
                  >
                    View Book
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      navigate(`/admin/vpm-requests?advisor=${advisor.id}`)
                    }
                  >
                    Requests
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {vpmAdvisors.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12">
          No VPM-enrolled advisors found.
        </div>
      )}
    </div>
  );
}
