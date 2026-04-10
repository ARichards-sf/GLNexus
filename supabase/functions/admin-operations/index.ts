import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller using anon client with their JWT
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    // Check admin role OR is_internal flag
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    const { data: profileCheck } = await supabaseAdmin
      .from("profiles")
      .select("is_internal")
      .eq("user_id", callerId)
      .maybeSingle();

    const isAdmin = !!roleCheck || !!profileCheck?.is_internal;

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    // ACTION: Get all advisors with their stats
    if (action === "list_advisors") {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (pErr) throw pErr;

      const { data: aumData } = await supabaseAdmin
        .from("households")
        .select("advisor_id, total_aum");

      const aumMap: Record<string, number> = {};
      const householdCountMap: Record<string, number> = {};
      (aumData || []).forEach((h: any) => {
        aumMap[h.advisor_id] = (aumMap[h.advisor_id] || 0) + Number(h.total_aum);
        householdCountMap[h.advisor_id] = (householdCountMap[h.advisor_id] || 0) + 1;
      });

      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
      const roleMap: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const authMap: Record<string, any> = {};
      (authUsers || []).forEach((u: any) => {
        authMap[u.id] = u;
      });

      const advisors = (profiles || []).map((p: any) => ({
        ...p,
        total_aum: aumMap[p.user_id] || 0,
        household_count: householdCountMap[p.user_id] || 0,
        roles: roleMap[p.user_id] || [],
        last_sign_in_at: authMap[p.user_id]?.last_sign_in_at || null,
      }));

      return new Response(JSON.stringify({ advisors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Get system-wide stats
    if (action === "system_stats") {
      const { data: aumData } = await supabaseAdmin
        .from("households")
        .select("total_aum");
      const totalAUM = (aumData || []).reduce((s: number, h: any) => s + Number(h.total_aum), 0);

      const { count: advisorCount } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const today = new Date().toISOString().split("T")[0];
      const activeToday = (authUsers || []).filter(
        (u: any) => u.last_sign_in_at && u.last_sign_in_at.startsWith(today)
      ).length;

      return new Response(JSON.stringify({
        total_aum: totalAUM,
        advisor_count: advisorCount || 0,
        active_today: activeToday,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Invite a new advisor
    if (action === "invite_advisor") {
      const { email, password, full_name, office_location } = payload;
      if (!email) throw new Error("Email is required");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

      // 1. Create the user in auth.users with the provided password
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });
      if (createErr) throw createErr;
      const newUser = createData.user;

      // 2. Update the profile with office_location (profile row created by handle_new_user trigger)
      if (office_location) {
        await supabaseAdmin
          .from("profiles")
          .update({ office_location })
          .eq("user_id", newUser.id);
      }

      // 3. Assign the 'user' role (advisor)
      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.id,
        role: "user",
      });

      return new Response(JSON.stringify({ user: newUser }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Toggle advisor status
    if (action === "toggle_status") {
      const { user_id, status } = payload;
      if (!user_id || !status) throw new Error("user_id and status required");

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ status })
        .eq("user_id", user_id);
      if (error) throw error;

      if (status === "inactive") {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
