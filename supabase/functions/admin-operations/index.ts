import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAdmin(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!supabaseUrl || !serviceRoleKey) throw { status: 500, message: "Server configuration error" };

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw { status: 401, message: "Unauthorized" };

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) throw { status: 401, message: "Unauthorized" };
  const callerId = claimsData.claims.sub as string;

  const { data: roleCheck } = await supabaseAdmin
    .from("user_roles").select("id").eq("user_id", callerId).eq("role", "admin").maybeSingle();
  const { data: profileCheck } = await supabaseAdmin
    .from("profiles").select("is_internal").eq("user_id", callerId).maybeSingle();

  if (!roleCheck && !profileCheck?.is_internal) throw { status: 403, message: "Forbidden: admin role required" };

  return { supabaseAdmin, callerId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { supabaseAdmin } = await verifyAdmin(req);
    const { action, ...payload } = await req.json();

    // ── LIST ADVISORS ──
    if (action === "list_advisors") {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles").select("*").order("created_at", { ascending: false });
      if (pErr) throw pErr;

      const { data: aumData } = await supabaseAdmin.from("households").select("advisor_id, total_aum");
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
      (authUsers || []).forEach((u: any) => { authMap[u.id] = u; });

      const advisors = (profiles || []).map((p: any) => ({
        ...p,
        total_aum: aumMap[p.user_id] || 0,
        household_count: householdCountMap[p.user_id] || 0,
        roles: roleMap[p.user_id] || [],
        last_sign_in_at: authMap[p.user_id]?.last_sign_in_at || null,
      }));

      return json({ advisors });
    }

    // ── GET SINGLE ADVISOR ──
    if (action === "get_advisor") {
      const { user_id } = payload;
      if (!user_id) throw new Error("user_id required");

      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles").select("*").eq("user_id", user_id).maybeSingle();
      if (pErr) throw pErr;
      if (!profile) throw new Error("Advisor not found");

      const { data: aumData } = await supabaseAdmin
        .from("households").select("id, name, total_aum").eq("advisor_id", user_id).order("total_aum", { ascending: false });

      const totalAum = (aumData || []).reduce((s: number, h: any) => s + Number(h.total_aum), 0);

      const { data: roles } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", user_id);

      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = (authUsers || []).find((u: any) => u.id === user_id);

      return json({
        advisor: {
          ...profile,
          total_aum: totalAum,
          household_count: (aumData || []).length,
          households: aumData || [],
          roles: (roles || []).map((r: any) => r.role),
          last_sign_in_at: authUser?.last_sign_in_at || null,
        },
      });
    }

    // ── SYSTEM STATS ──
    if (action === "system_stats") {
      const { data: aumData } = await supabaseAdmin.from("households").select("total_aum");
      const totalAUM = (aumData || []).reduce((s: number, h: any) => s + Number(h.total_aum), 0);
      const { count: advisorCount } = await supabaseAdmin.from("profiles").select("*", { count: "exact", head: true });
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const today = new Date().toISOString().split("T")[0];
      const activeToday = (authUsers || []).filter((u: any) => u.last_sign_in_at?.startsWith(today)).length;
      return json({ total_aum: totalAUM, advisor_count: advisorCount || 0, active_today: activeToday });
    }

    // ── INVITE ADVISOR ──
    if (action === "invite_advisor") {
      const { email, password, full_name, office_location } = payload;
      if (!email) throw new Error("Email is required");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: full_name || "" },
      });
      if (createErr) throw createErr;
      const newUser = createData.user;

      if (office_location) {
        await supabaseAdmin.from("profiles").update({ office_location }).eq("user_id", newUser.id);
      }
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.id, role: "user" });
      return json({ user: newUser });
    }

    // ── TOGGLE STATUS ──
    if (action === "toggle_status") {
      const { user_id, status } = payload;
      if (!user_id || !status) throw new Error("user_id and status required");
      const { error } = await supabaseAdmin.from("profiles").update({ status }).eq("user_id", user_id);
      if (error) throw error;
      if (status === "inactive") {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      }
      return json({ success: true });
    }

    // ── UPDATE ADVISOR PROFILE ──
    if (action === "update_advisor_profile") {
      const { user_id, full_name, office_location } = payload;
      if (!user_id) throw new Error("user_id required");
      const updates: Record<string, any> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (office_location !== undefined) updates.office_location = office_location;
      const { error } = await supabaseAdmin.from("profiles").update(updates).eq("user_id", user_id);
      if (error) throw error;
      if (full_name !== undefined) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: { full_name } });
      }
      return json({ success: true });
    }

    // ── RESET PASSWORD ──
    if (action === "reset_advisor_password") {
      const { user_id, new_password } = payload;
      if (!user_id || !new_password) throw new Error("user_id and new_password required");
      if (new_password.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) throw error;
      return json({ success: true });
    }

    // ── UPDATE ROLE ──
    if (action === "update_advisor_role") {
      const { user_id, role } = payload;
      if (!user_id || !role) throw new Error("user_id and role required");
      // Remove existing roles, insert new one
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id, role });
      if (error) throw error;
      return json({ success: true });
    }

    // ── TOGGLE INTERNAL ──
    if (action === "toggle_internal") {
      const { user_id, is_internal } = payload;
      if (!user_id || is_internal === undefined) throw new Error("user_id and is_internal required");
      const { error } = await supabaseAdmin.from("profiles").update({ is_internal }).eq("user_id", user_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ── RUN SNAPSHOTS MANUALLY ──
    if (action === "run_snapshots") {
      const { error } = await supabaseAdmin.rpc("generate_daily_snapshots");
      if (error) throw error;
      return json({ success: true });
    }

    // ── GET AUTOMATION LOGS ──
    if (action === "get_automation_logs") {
      const { data, error } = await supabaseAdmin
        .from("automation_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return json({ logs: data });
    }

    // ── INVITE INTERNAL USER ──
    if (action === "invite_internal_user") {
      const { email, password, full_name, platform_role, department } = payload;
      if (!email) throw new Error("Email is required");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
      if (!["admin", "super_admin"].includes(platform_role)) throw new Error("Invalid platform_role");
      if (!["vpm", "wam", "marketing", "transitions", "compliance", "accounting"].includes(department)) {
        throw new Error("Invalid department");
      }

      // Look up the GL internal firm
      const { data: glFirm, error: firmErr } = await supabaseAdmin
        .from("firms").select("id").eq("is_gl_internal", true).maybeSingle();
      if (firmErr) throw firmErr;
      if (!glFirm) throw new Error("Good Life Companies firm not found");

      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: full_name || "" },
      });
      if (createErr) throw createErr;
      const newUser = createData.user;

      const { error: profErr } = await supabaseAdmin.from("profiles").update({
        full_name: full_name || null,
        is_gl_internal: true,
        is_internal: true,
        platform_role,
        department,
        firm_id: glFirm.id,
      }).eq("user_id", newUser.id);
      if (profErr) throw profErr;

      return json({ user: newUser });
    }

    // ── LIST INTERNAL USERS ──
    if (action === "list_internal_users") {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles").select("*").eq("is_gl_internal", true).order("created_at", { ascending: false });
      if (pErr) throw pErr;

      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const authMap: Record<string, any> = {};
      (authUsers || []).forEach((u: any) => { authMap[u.id] = u; });

      const userIds = (profiles || []).map((p: any) => p.user_id);
      const { data: assignments } = await supabaseAdmin
        .from("internal_user_firm_assignments")
        .select("internal_user_id, firm_id, firms(id, name, accent_color)")
        .in("internal_user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const assignMap: Record<string, any[]> = {};
      (assignments || []).forEach((a: any) => {
        if (!assignMap[a.internal_user_id]) assignMap[a.internal_user_id] = [];
        assignMap[a.internal_user_id].push({ firm_id: a.firm_id, firm: a.firms });
      });

      const internal_users = (profiles || []).map((p: any) => ({
        ...p,
        last_sign_in_at: authMap[p.user_id]?.last_sign_in_at || null,
        firm_assignments: assignMap[p.user_id] || [],
      }));

      return json({ internal_users });
    }

    // ── UPDATE INTERNAL USER ──
    if (action === "update_internal_user") {
      const { user_id, platform_role, department, full_name, office_location } = payload;
      if (!user_id) throw new Error("user_id required");

      const { data: target, error: tErr } = await supabaseAdmin
        .from("profiles").select("is_gl_internal").eq("user_id", user_id).maybeSingle();
      if (tErr) throw tErr;
      if (!target?.is_gl_internal) throw new Error("Target user is not GL internal");

      if (platform_role !== undefined && platform_role !== null && !["admin", "super_admin"].includes(platform_role)) {
        throw new Error("Invalid platform_role");
      }
      if (department !== undefined && department !== null &&
          !["vpm", "wam", "marketing", "transitions", "compliance", "accounting"].includes(department)) {
        throw new Error("Invalid department");
      }

      const updates: Record<string, any> = {};
      if (platform_role !== undefined) updates.platform_role = platform_role;
      if (department !== undefined) updates.department = department;
      if (full_name !== undefined) updates.full_name = full_name;
      if (office_location !== undefined) updates.office_location = office_location;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin
          .from("profiles").update(updates).eq("user_id", user_id).eq("is_gl_internal", true);
        if (error) throw error;
      }

      if (full_name !== undefined) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: { full_name } });
      }
      return json({ success: true });
    }

    // ── ASSIGN INTERNAL USER FIRMS ──
    if (action === "assign_internal_user_firms") {
      const { user_id, firm_ids } = payload;
      if (!user_id) throw new Error("user_id required");
      if (!Array.isArray(firm_ids)) throw new Error("firm_ids must be an array");

      const { data: target, error: tErr } = await supabaseAdmin
        .from("profiles").select("is_gl_internal").eq("user_id", user_id).maybeSingle();
      if (tErr) throw tErr;
      if (!target?.is_gl_internal) throw new Error("Target user is not GL internal");

      const { error: delErr } = await supabaseAdmin
        .from("internal_user_firm_assignments").delete().eq("internal_user_id", user_id);
      if (delErr) throw delErr;

      if (firm_ids.length > 0) {
        const rows = firm_ids.map((fid: string) => ({ internal_user_id: user_id, firm_id: fid }));
        const { error: insErr } = await supabaseAdmin
          .from("internal_user_firm_assignments").insert(rows);
        if (insErr) throw insErr;
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || "Internal error" }, status);
  }
});
