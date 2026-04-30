// Initiates the Microsoft OAuth flow. Authenticated request from the
// frontend "Connect Outlook" button. We mint a short-lived state row tied
// to the advisor, then return the Microsoft authorize URL for the client
// to redirect to. The matching outlook-oauth-callback consumes the state.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MS_AUTHORITY = "https://login.microsoftonline.com/common";
const SCOPES =
  "offline_access User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const redirectUri = Deno.env.get("MICROSOFT_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      return json({ error: "Outlook integration not configured" }, 500);
    }

    // Optional ?redirect_to=/settings query so the callback can bounce the
    // user back to where they started.
    const url = new URL(req.url);
    const redirectTo = url.searchParams.get("redirect_to") ?? "/settings";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow, error: stateErr } = await admin
      .from("outlook_oauth_states")
      .insert({ advisor_id: user.id, redirect_to: redirectTo })
      .select("state")
      .single();

    if (stateErr || !stateRow) {
      console.error("oauth-start: failed to create state row", stateErr);
      return json({ error: "Failed to start OAuth flow" }, 500);
    }

    const authorizeUrl = new URL(`${MS_AUTHORITY}/oauth2/v2.0/authorize`);
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_mode", "query");
    authorizeUrl.searchParams.set("scope", SCOPES);
    authorizeUrl.searchParams.set("state", stateRow.state);
    authorizeUrl.searchParams.set("prompt", "select_account");

    return json({ authorizeUrl: authorizeUrl.toString() }, 200);
  } catch (e) {
    console.error("oauth-start error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
