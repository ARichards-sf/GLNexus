import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { category, description, advisor_email, advisor_name, household_name, household_aum, account_type, account_institution } = await req.json();

    // Log the request for now — webhook/email integration can be added later
    console.log("Service request received:", {
      category,
      description,
      advisor_email,
      advisor_name,
      household_name,
      household_aum,
      account_type,
      account_institution,
      timestamp: new Date().toISOString(),
    });

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
