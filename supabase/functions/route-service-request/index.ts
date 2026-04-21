import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const {
      category,
      description,
      advisor_email,
      advisor_name,
      household_name,
      household_aum,
      account_type,
      account_institution,
      is_vpm,
      vpm_request_type,
      vpm_timeline,
      priority,
      subject,
    } = await req.json();

    // Log minimal, non-PII metadata for routing only
    console.log("Service request received:", {
      category,
      user_id: claimsData.claims.sub,
      is_vpm: !!is_vpm,
      vpm_request_type: vpm_request_type ?? null,
      vpm_timeline: vpm_timeline ?? null,
      priority: priority ?? null,
      timestamp: new Date().toISOString(),
    });

    if (is_vpm) {
      // VPM requests route to the GL VPM team queue.
      // In production: notify VPM staff via email/Slack with subject + timeline + priority.
      console.log("VPM request routed to GL VPM team:", {
        subject: subject ?? null,
        vpm_request_type,
        vpm_timeline,
        priority,
      });
    }

    // Placeholder: In production, send via email API or webhook
    // e.g. fetch("https://hooks.slack.com/...", { method: "POST", body: ... })
    // e.g. await resend.emails.send({ to: "backoffice@goodlife.com", ... })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Route service request error:", error);
    return new Response(JSON.stringify({ error: "Failed to route request" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
