// Microsoft redirects the user's browser back here with ?code=&state=.
// We exchange the code for tokens, fetch the Graph user profile, upsert
// outlook_connections, then bounce the browser to the frontend.
//
// This function is configured with verify_jwt = false in supabase/config.toml
// because Microsoft's redirect doesn't carry a Supabase JWT. The state row
// (created by outlook-oauth-start) is what proves the request originated
// from an authenticated advisor.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const MS_AUTHORITY = "https://login.microsoftonline.com/common";
const SCOPES = "offline_access User.Read Mail.Read Mail.Send";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    const oauthErrorDescription = url.searchParams.get("error_description");

    if (oauthError) {
      return errorPage(
        `Microsoft returned an error: ${oauthError}. ${
          oauthErrorDescription ?? ""
        }`,
      );
    }
    if (!code || !state) {
      return errorPage("Missing code or state parameter.");
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up + consume the state row. Single use.
    const { data: stateRow, error: stateErr } = await admin
      .from("outlook_oauth_states")
      .select("advisor_id, expires_at, redirect_to")
      .eq("state", state)
      .single();

    if (stateErr || !stateRow) {
      return errorPage("Invalid or expired OAuth state.");
    }
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      await admin.from("outlook_oauth_states").delete().eq("state", state);
      return errorPage("OAuth state expired. Please try connecting again.");
    }

    // Exchange the auth code for tokens.
    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const redirectUri = Deno.env.get("MICROSOFT_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      return errorPage("Outlook integration not configured (server).");
    }

    const tokenRes = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: SCOPES,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, errText);
      return errorPage("Failed to exchange authorization code for tokens.");
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    if (!tokens.refresh_token) {
      return errorPage(
        "Microsoft didn't return a refresh token — was offline_access requested?",
      );
    }

    // Pull the Graph user profile so we can store the email address.
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      const errText = await profileRes.text();
      console.error("Graph /me failed:", profileRes.status, errText);
      return errorPage("Failed to fetch Microsoft user profile.");
    }
    const profile = await profileRes.json() as {
      id: string;
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };
    const email = profile.mail ?? profile.userPrincipalName;
    if (!email) return errorPage("Microsoft profile missing email address.");

    const accessExpiresAt = new Date(
      Date.now() + (tokens.expires_in - 60) * 1000,
    ).toISOString();

    const { error: upsertErr } = await admin
      .from("outlook_connections")
      .upsert({
        advisor_id: stateRow.advisor_id,
        microsoft_user_id: profile.id,
        email,
        display_name: profile.displayName ?? null,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        access_token_expires_at: accessExpiresAt,
        // Reset delta cursors on re-connect so we re-baseline the mailbox.
        inbox_delta_link: null,
        sent_delta_link: null,
        last_sync_error: null,
      }, { onConflict: "advisor_id" });

    if (upsertErr) {
      console.error("Failed to upsert connection:", upsertErr);
      return errorPage("Failed to save Outlook connection.");
    }

    // Consume the state row.
    await admin.from("outlook_oauth_states").delete().eq("state", state);

    // Bounce the user back to the app.
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";
    const redirectTo = stateRow.redirect_to ?? "/settings";
    const finalUrl = new URL(redirectTo, appUrl);
    finalUrl.searchParams.set("outlook", "connected");

    return new Response(null, {
      status: 302,
      headers: { Location: finalUrl.toString() },
    });
  } catch (e) {
    console.error("oauth-callback error:", e);
    return errorPage(e instanceof Error ? e.message : "Unknown error");
  }
});

function errorPage(message: string) {
  const safe = message.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Outlook connection error</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; }
  h1 { font-size: 20px; }
  p { color: #444; line-height: 1.5; }
  a { color: #0066cc; }
</style></head><body>
<h1>Couldn't connect Outlook</h1>
<p>${safe}</p>
<p><a href="/settings">Back to settings</a></p>
</body></html>`;
  return new Response(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
