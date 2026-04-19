import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Existing snapshot logic ──
    const { error: snapshotError } = await supabaseAdmin.rpc(
      "generate_daily_snapshots",
    );
    if (snapshotError) {
      console.error("Snapshot RPC failed:", snapshotError);
      throw snapshotError;
    }

    // ── Annual tier reassessment ──
    // Only runs for households not assessed in the last 365 days
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: staleHouseholds } = await supabaseAdmin
      .from("households")
      .select(`
        *,
        household_members(
          date_of_birth,
          relationship
        )
      `)
      .is("archived_at", null)
      .or(
        `tier_last_assessed.is.null,tier_last_assessed.lt.${oneYearAgo.toISOString()}`,
      )
      .is("tier_pending_review", null);

    let tierReassessedCount = 0;

    if (staleHouseholds?.length) {
      // Get book averages per advisor
      const { data: allHouseholds } = await supabaseAdmin
        .from("households")
        .select("advisor_id, total_aum")
        .is("archived_at", null);

      const bookAverages: Record<string, number> = {};
      const bookCounts: Record<string, number> = {};

      (allHouseholds || []).forEach((h: any) => {
        if (!bookAverages[h.advisor_id]) {
          bookAverages[h.advisor_id] = 0;
          bookCounts[h.advisor_id] = 0;
        }
        bookAverages[h.advisor_id] += Number(h.total_aum || 0);
        bookCounts[h.advisor_id]++;
      });

      Object.keys(bookAverages).forEach((id) => {
        if (bookCounts[id] > 0) {
          bookAverages[id] /= bookCounts[id];
        }
      });

      const { calculateTierScore } = await import(
        "../_shared/tierScoring.ts"
      );

      for (const hh of staleHouseholds) {
        try {
          const { count: referralCount } = await supabaseAdmin
            .from("prospects")
            .select("id", { count: "exact", head: true })
            .eq("referred_by_household_id", hh.id);

          const primary = hh.household_members?.find(
            (m: any) => m.relationship === "Primary",
          );
          const age = primary?.date_of_birth
            ? Math.floor(
              (Date.now() - new Date(primary.date_of_birth).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000),
            )
            : null;

          const scoreResult = calculateTierScore({
            householdAum: Number(hh.total_aum || 0),
            bookAverageAum: bookAverages[hh.advisor_id] || 0,
            annualIncome: hh.annual_income || null,
            primaryMemberAge: age,
            referralsSent: referralCount || 0,
            referredByTier: null,
          });

          const currentTier = hh.wealth_tier;
          const suggestedTier = scoreResult.recommendedTier;

          if (
            !currentTier ||
            currentTier.toLowerCase() !== suggestedTier
          ) {
            await supabaseAdmin
              .from("households")
              .update({
                tier_score: scoreResult.total,
                tier_pending_review: suggestedTier,
                tier_pending_score: scoreResult.total,
                tier_pending_reason:
                  `Annual reassessment: score ${scoreResult.total}/100 suggests ${suggestedTier}${
                    currentTier
                      ? ` (currently ${currentTier})`
                      : " (first assessment)"
                  }.`,
                tier_last_assessed: new Date().toISOString(),
              })
              .eq("id", hh.id);

            await supabaseAdmin
              .from("tasks")
              .insert({
                advisor_id: hh.advisor_id,
                created_by: hh.advisor_id,
                assigned_to: hh.advisor_id,
                title: `Annual tier review — ${hh.name}`,
                description:
                  `Annual reassessment score: ${scoreResult.total}/100. Recommended tier: ${suggestedTier}.`,
                priority: "medium",
                status: "todo",
                task_type: "tier_review",
                due_date: new Date(
                  Date.now() + 14 * 24 * 60 * 60 * 1000,
                )
                  .toISOString()
                  .split("T")[0],
                household_id: hh.id,
                metadata: {
                  current_tier: currentTier,
                  suggested_tier: suggestedTier,
                  score: scoreResult.total,
                  trigger: "annual",
                },
              });
          } else {
            // Same tier — just update assessed timestamp
            await supabaseAdmin
              .from("households")
              .update({
                tier_score: scoreResult.total,
                tier_last_assessed: new Date().toISOString(),
              })
              .eq("id", hh.id);
          }

          tierReassessedCount++;
        } catch (err) {
          console.error(`Tier check failed for ${hh.id}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tier_reassessed: tierReassessedCount,
        stale_count: staleHouseholds?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("run-daily-snapshots error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
