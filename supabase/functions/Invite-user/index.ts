// supabase/functions/invite-user/index.ts
//
// Creates a Supabase auth user and a corresponding profiles row.
// Two modes:
//   mode: 'invite'    — Supabase sends an invitation email with a magic link
//                       so the user sets their own password.
//   mode: 'password'  — Admin sets a temporary password inline. We respond
//                       with the password so the admin can hand it off.
//
// Used for both staff invites (teachers, head teachers, school admins) and
// parent invites (linked to a pupil on creation).
//
// IDEMPOTENCY: if a user with this email already exists, we DON'T create a
// duplicate. We return the existing user's ID and let the caller link them.
// This matters for parents with multiple children at the same school —
// "invite this parent" should be safe to call repeatedly.
//
// AUTHORIZATION: we verify the caller (using their JWT) has school_admin or
// super_admin role. Head teachers can invite teachers and parents but not
// school_admins. Super admins can do everything. Teachers and parents
// cannot use this function at all.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface InvitePayload {
  mode: "invite" | "password";
  email: string;
  full_name: string;
  role: "teacher" | "head_teacher" | "school_admin" | "parent";
  school_id?: string;
  // Only required when mode === 'password'
  temporary_password?: string;
  // Optional: link this user to a pupil on creation (parent flow).
  link_pupil_id?: string;
}

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  school_admin: 50,
  head_teacher: 30,
  teacher: 10,
  parent: 5,
  student: 1,
};

function canCreate(callerRole: string, newUserRole: string): boolean {
  // Super admin: any role.
  if (callerRole === "super_admin") return true;
  // School admin: any role except super_admin.
  if (callerRole === "school_admin") return newUserRole !== "super_admin";
  // Head teacher: teachers and parents only.
  if (callerRole === "head_teacher") {
    return newUserRole === "teacher" || newUserRole === "parent";
  }
  return false;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Service-role client for admin operations (creating users, bypassing RLS).
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Verify the caller. The frontend passes the user's JWT; we resolve it.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "missing_auth" }, 401);
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: callerUser, error: callerErr } = await admin.auth.getUser(callerToken);
  if (callerErr || !callerUser?.user) return jsonResponse({ error: "invalid_auth" }, 401);

  const callerId = callerUser.user.id;
  const { data: callerProfile, error: profErr } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("user_id", callerId)
    .single();
  if (profErr || !callerProfile) return jsonResponse({ error: "caller_has_no_profile" }, 403);

  // Parse payload
  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "bad_json" }, 400);
  }

  const { mode, email, full_name, role, school_id, temporary_password, link_pupil_id } = payload;

  // Validate
  if (!email || !full_name || !role || !mode) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }
  if (!["invite", "password"].includes(mode)) {
    return jsonResponse({ error: "bad_mode" }, 400);
  }
  if (mode === "password" && (!temporary_password || temporary_password.length < 8)) {
    return jsonResponse({ error: "password_too_short" }, 400);
  }
  if (!canCreate(callerProfile.role, role)) {
    return jsonResponse({ error: "insufficient_permissions", caller_role: callerProfile.role }, 403);
  }

  // School scoping. School admins can only invite into their own school.
  const targetSchoolId = school_id ?? callerProfile.school_id;
  if (callerProfile.role !== "super_admin" && targetSchoolId !== callerProfile.school_id) {
    return jsonResponse({ error: "cross_school_invite_blocked" }, 403);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // IDEMPOTENCY: check if user exists.
  // We use listUsers paginated — there's no admin.getUserByEmail in supabase-js v2.
  // For a typical Nigerian school with < 5000 staff+parents this is cheap;
  // we cap pages at 5 (5000 users) before giving up.
  let existingUser: { id: string } | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listErr) break;
    const found = list?.users?.find((u: { email?: string | null }) =>
      u.email?.toLowerCase() === normalizedEmail
    );
    if (found) { existingUser = { id: found.id }; break; }
    if (!list?.users || list.users.length < 1000) break;
  }

  let userId: string;
  let returnedPassword: string | null = null;

  if (existingUser) {
    userId = existingUser.id;
    // Don't re-invite; just make sure profile + linkage are correct.
  } else {
    if (mode === "invite") {
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: { full_name, role },
      });
      if (invErr || !invited?.user) {
        return jsonResponse({ error: "invite_failed", detail: invErr?.message }, 500);
      }
      userId = invited.user.id;
    } else {
      // mode === 'password' — create user with the temp password set.
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: temporary_password!,
        email_confirm: true, // skip email-confirm step — admin verifies offline
        user_metadata: { full_name, role },
      });
      if (cErr || !created?.user) {
        return jsonResponse({ error: "create_failed", detail: cErr?.message }, 500);
      }
      userId = created.user.id;
      returnedPassword = temporary_password!;
    }
  }

  // Upsert the profile row. RLS bypassed via service role.
  const { error: upErr } = await admin
    .from("profiles")
    .upsert({
      user_id: userId,
      full_name,
      email: normalizedEmail,
      role,
      school_id: role === "parent" ? null : targetSchoolId, // parents aren't bound to one school
    }, { onConflict: "user_id" });
  if (upErr) {
    return jsonResponse({ error: "profile_upsert_failed", detail: upErr.message }, 500);
  }

  // Link to pupil if requested (parent flow). Safe to re-call: parent_pupil_links
  // has a unique constraint on (parent_user_id, pupil_id).
  if (link_pupil_id && role === "parent") {
    const { error: linkErr } = await admin
      .from("parent_pupil_links")
      .upsert({ parent_user_id: userId, pupil_id: link_pupil_id }, {
        onConflict: "parent_user_id,pupil_id",
        ignoreDuplicates: true,
      });
    if (linkErr) {
      return jsonResponse({
        error: "linking_failed",
        detail: linkErr.message,
        user_id: userId,
      }, 500);
    }
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor: callerId,
    action: existingUser ? "user.linked" : "user.invited",
    target_user_id: userId,
    target_school_id: targetSchoolId,
    target_pupil_id: link_pupil_id ?? null,
    details: { role, mode, was_existing: !!existingUser },
  });

  return jsonResponse({
    user_id: userId,
    was_existing: !!existingUser,
    temporary_password: returnedPassword,
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
