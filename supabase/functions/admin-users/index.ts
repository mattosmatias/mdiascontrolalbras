// Admin-only edge function to manage users (create, block/unblock, reset password).
// Requires the caller to be authenticated AND have the 'admin' role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  action:
    | "list"
    | "create"
    | "set_blocked"
    | "send_reset"
    | "delete";
  email?: string;
  password?: string;
  full_name?: string;
  role?: "admin" | "operador" | "diretoria";
  user_id?: string;
  blocked?: boolean;
  redirect_to?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  // Verify caller identity + role
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes.user) return json({ error: "Não autenticado" }, 401);
  const caller = userRes.user;

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRows, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);
  if (roleErr) return json({ error: roleErr.message }, 500);
  const isAdmin = (roleRows ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return json({ error: "Apenas administradores" }, 403);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  try {
    switch (body.action) {
      case "list": {
        // List profiles + roles + auth info
        const { data: profiles, error: pErr } = await admin
          .from("profiles")
          .select("id, full_name, email, blocked, created_at")
          .order("created_at", { ascending: true });
        if (pErr) throw pErr;
        const { data: roles, error: rErr } = await admin
          .from("user_roles")
          .select("user_id, role");
        if (rErr) throw rErr;
        const rolesByUser: Record<string, string[]> = {};
        for (const r of roles ?? []) {
          (rolesByUser[r.user_id] ||= []).push(r.role as string);
        }
        const users = (profiles ?? []).map((p: any) => ({
          ...p,
          roles: rolesByUser[p.id] ?? [],
        }));
        return json({ users });
      }

      case "create": {
        if (!body.email || !body.password || !body.full_name) {
          return json({ error: "email, password e full_name são obrigatórios" }, 400);
        }
        const role = body.role ?? "operador";
        const { data: created, error } = await admin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: { full_name: body.full_name },
        });
        if (error) throw error;
        const uid = created.user!.id;
        // Ensure profile exists (handle_new_user trigger should have created it)
        await admin.from("profiles").upsert({ id: uid, full_name: body.full_name, email: body.email });
        // Override default role assigned by trigger
        await admin.from("user_roles").delete().eq("user_id", uid);
        await admin.from("user_roles").insert({ user_id: uid, role });
        return json({ ok: true, user_id: uid });
      }

      case "set_blocked": {
        if (!body.user_id || typeof body.blocked !== "boolean") {
          return json({ error: "user_id e blocked são obrigatórios" }, 400);
        }
        if (body.user_id === caller.id) {
          return json({ error: "Você não pode bloquear a si mesmo" }, 400);
        }
        const { error: pErr } = await admin
          .from("profiles")
          .update({ blocked: body.blocked })
          .eq("id", body.user_id);
        if (pErr) throw pErr;
        // Ban/unban in auth to force logout and block logins
        const banDuration = body.blocked ? "876000h" : "none"; // ~100 years
        const { error: aErr } = await admin.auth.admin.updateUserById(body.user_id, {
          ban_duration: banDuration,
        } as any);
        if (aErr) throw aErr;
        return json({ ok: true });
      }

      case "send_reset": {
        if (!body.email) return json({ error: "email obrigatório" }, 400);
        const redirectTo = body.redirect_to;
        const { error } = await admin.auth.resetPasswordForEmail(body.email, {
          redirectTo,
        } as any);
        if (error) throw error;
        return json({ ok: true });
      }

      case "delete": {
        if (!body.user_id) return json({ error: "user_id obrigatório" }, 400);
        if (body.user_id === caller.id) {
          return json({ error: "Você não pode excluir a si mesmo" }, 400);
        }
        const { error } = await admin.auth.admin.deleteUser(body.user_id);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: "Ação desconhecida" }, 400);
    }
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});
