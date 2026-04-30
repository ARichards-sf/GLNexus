// Sends a reply to an email_messages row through Microsoft Graph using the
// advisor's stored OAuth tokens (Mail.Send scope only — no Mail.ReadWrite
// required). Single call to /me/messages/{id}/reply with an overriding
// `message` payload so the user's edited subject + HTML body win, and Graph
// still handles in-reply-to / references / conversation threading.
//
// Graph appends the quoted original below the reply automatically — that's
// standard email-client behavior, so we don't strip it.
//
// The next outlook-sync cron will pull the sent message into email_messages
// (folder='sent') so it appears in the conversation history.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MS_AUTHORITY = "https://login.microsoftonline.com/common";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES =
  "offline_access User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite";

type Connection = {
  advisor_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({})) as {
      email_message_id?: string;
      subject?: string;
      body?: string;
    };
    if (!body.email_message_id || !body.body?.trim()) {
      return json({ error: "email_message_id and body required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the original email and confirm the caller owns it.
    const { data: original, error: emailErr } = await admin
      .from("email_messages")
      .select("advisor_id, graph_message_id, subject, from_email")
      .eq("id", body.email_message_id)
      .single();
    if (emailErr || !original) return json({ error: "Email not found" }, 404);
    if (original.advisor_id !== user.id) return json({ error: "Forbidden" }, 403);

    // Fetch the connection + ensure a fresh access token.
    const { data: conn, error: connErr } = await admin
      .from("outlook_connections")
      .select(
        "advisor_id, refresh_token, access_token, access_token_expires_at",
      )
      .eq("advisor_id", user.id)
      .single();
    if (connErr || !conn) {
      return json({ error: "Outlook is not connected for this advisor" }, 412);
    }
    const accessToken = await ensureAccessToken(conn as Connection, admin);

    const subject = (body.subject ?? `Re: ${original.subject ?? ""}`).trim()
      || `Re: ${original.subject ?? ""}`;
    // The reader panel's TipTap editor sends HTML; older callers may send
    // plain text. Detect by looking for a tag-like prefix.
    const looksHtml = /<[a-z][\s\S]*>/i.test(body.body);
    const htmlBody = inlineStyleEmailButton(
      looksHtml ? body.body : plainTextToHtml(body.body),
    );

    // POST /me/messages/{id}/reply with `message` overrides. Graph builds
    // the threaded reply (in-reply-to, references, conversation), uses our
    // subject + body, sends, and saves to Sent Items in one shot.
    const replyRes = await fetch(
      `${GRAPH}/me/messages/${original.graph_message_id}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: htmlBody },
          },
          comment: "",
        }),
      },
    );
    if (!replyRes.ok) {
      const t = await replyRes.text();
      throw new Error(`reply failed: ${replyRes.status} ${t.slice(0, 300)}`);
    }

    // Activity event so the advisor's stream reflects the send right away —
    // the actual sent-folder row arrives on the next 5-min cron sync.
    await admin.from("activity_events").insert({
      advisor_id: user.id,
      kind: "draft_sent",
      title: `Replied: ${subject}`,
      body: original.from_email
        ? `To ${original.from_email}`
        : null,
      related_record_id: body.email_message_id,
      related_record_type: "email_message",
    });

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("outlook-send-reply error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});

async function ensureAccessToken(
  conn: Connection,
  admin: SupabaseClient,
): Promise<string> {
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt > Date.now() + 60_000) {
    return conn.access_token;
  }

  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID")!;
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

  const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      scope: SCOPES,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }

  const tok = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const newExpires = new Date(
    Date.now() + (tok.expires_in - 60) * 1000,
  ).toISOString();

  await admin
    .from("outlook_connections")
    .update({
      access_token: tok.access_token,
      access_token_expires_at: newExpires,
      ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
    })
    .eq("advisor_id", conn.advisor_id);

  return tok.access_token;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

// Plain-text body → minimal HTML so Graph's Outlook rendering preserves
// paragraph spacing the user typed in the textarea.
function plainTextToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<html><body>${paragraphs}</body></html>`;
}

// Email clients (Outlook, Gmail) ignore <style> tags or external CSS —
// our `email-button` class only renders inside the GLNexus app. Rewrite
// any `class="email-button"` (with or without other classes) to inline
// styles so the button looks like a button in the recipient's inbox.
const BUTTON_INLINE_STYLE =
  "display:inline-block;background:#2563eb;color:#ffffff;padding:10px 18px;" +
  "border-radius:6px;font-weight:500;text-decoration:none;margin:4px 0;" +
  "font-family:Arial,Helvetica,sans-serif;";

function inlineStyleEmailButton(html: string): string {
  // Match an <a ...> opening tag that contains class="...email-button..."
  // (single or double quoted, with other classes possible) and rewrite the
  // tag with the inline style. Idempotent — safe to apply repeatedly.
  return html.replace(
    /<a\b([^>]*?)\sclass=("|')([^"']*\bemail-button\b[^"']*)\2([^>]*)>/gi,
    (_match, before: string, _q: string, _classes: string, after: string) => {
      // If the tag already has a style="" attr, append; otherwise insert.
      const combined = `${before} ${after}`;
      const styleMatch = combined.match(/\sstyle=("|')([^"']*)\1/i);
      if (styleMatch) {
        const newCombined = combined.replace(
          /\sstyle=("|')([^"']*)\1/i,
          (_m, q, existing) => ` style=${q}${existing.replace(/;\s*$/, "")};${BUTTON_INLINE_STYLE}${q}`,
        );
        return `<a${newCombined}>`;
      }
      return `<a${before}${after} style="${BUTTON_INLINE_STYLE}">`;
    },
  );
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
