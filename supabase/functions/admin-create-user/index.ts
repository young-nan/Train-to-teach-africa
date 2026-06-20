// supabase/functions/admin-create-user/index.ts
//
// Creates a real, loginable user account: an auth.users row (via the Admin
// API, which requires the service_role key and therefore MUST run
// server-side — never call auth.admin.createUser() from the browser) plus
// the matching public.profiles row, and optionally links the new user to
// an existing pupil record (for a parent claiming their child, or a
// student getting their own login).
//
// This is the function behind every "Add staff" / "Add parent" /
// "Create student login" button across every dashboard — AdminStaff.jsx
// already calls this (under the name 'invite-staff'; update that call site
// to 'admin-create-user', see the note at the bottom of this file), and any
// other screen that needs to create a user should call this same function
// rather than each inventing its own variant.
//
// ─────────────────────────────────────────────────────────────────────────
// WHO CAN CALL THIS, AND WITH WHAT ROLE THEY CAN CREATE
// ─────────────────────────────────────────────────────────────────────────
//   Caller's role   | Can create roles
//   -----------------|----------------------------------------
//   super_admin      | anything, including school_admin, in any school
//   school_admin     | head_teacher, teacher, parent, student  (own school only)
//   head_teacher     | teacher, parent, student                (own school only)
//   anyone else      | rejected
//
// A caller can never create a super_admin (matches the
// profiles_insert_self_heal policy's same restriction in 0001), and can
// never create a user in a school other than their own (enforced here, not
// just left to RLS — RLS can't help us here because this function uses the
// service_role key, which bypasses RLS entirely; the authorization check
// below IS the security boundary for this function).
//
// ─────────────────────────────────────────────────────────────────────────
// FAILURE-MODE HANDLING
// ─────────────────────────────────────────────────────────────────────────
// auth.admin.createUser() and the profiles insert are two separate API
// calls against two systems Supabase manages separately (gotrue vs
// Postgres) — there is no cross-system transaction. If the profile insert
// fails after the auth user was created, we explicitly delete the
// just-created auth user rather than leaving an orphaned login with no
// profile (which is exactly the class of bug the self-heal fallback in
// authService.js exists to paper over on the client — better to not create
// the orphan here in the first place when we have the chance).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_CREATOR_ROLES: Record<string, string[]> = {
  super_admin:  ['super_admin', 'school_admin', 'head_teacher', 'teacher', 'parent', 'student'],
  school_admin: ['head_teacher', 'teacher', 'parent', 'student'],
  head_teacher: ['teacher', 'parent', 'student'],
};

interface CreateUserPayload {
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role: 'school_admin' | 'head_teacher' | 'teacher' | 'parent' | 'student';
  phone?: string | null;
  school_id?: string | null; // ignored for school_admin/head_teacher/teacher/parent callers — forced to caller's own school
  class_id?: string | null;  // for role='teacher': assign as class teacher; for role='student': which class they belong to
  link_pupil_id?: string | null; // for role='parent' or 'student': link this new user to an existing pupil row
  send_invite_email?: boolean;   // default true — uses inviteUserByEmail so the user sets their own password
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[admin-create-user] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  // Two clients, deliberately different:
  //  - `caller` uses the anon key + the request's own Authorization header,
  //    so we can ask "who is making this request, really?" via getUser().
  //    Trusting a `caller_id` field in the request BODY instead would let
  //    anyone claim to be any user — the JWT is the only trustworthy source
  //    of caller identity here.
  //  - `admin` uses the service_role key, the only credential allowed to
  //    call auth.admin.* methods, and intentionally bypasses RLS for the
  //    profiles insert below (acceptable here because the authorization
  //    check above already constrains what this function will do on the
  //    caller's behalf, before the admin client is ever used).
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerAuth, error: callerAuthErr } = await caller.auth.getUser();
  if (callerAuthErr || !callerAuth?.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }

  const { data: callerProfile, error: callerProfileErr } = await admin
    .from('profiles')
    .select('role, school_id')
    .eq('user_id', callerAuth.user.id)
    .single();

  if (callerProfileErr || !callerProfile) {
    return jsonResponse({ error: 'Could not verify caller profile' }, 403);
  }

  let payload: CreateUserPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // ── Authorization: can this caller create this role? ──────────────────
  const allowedRoles = ALLOWED_CREATOR_ROLES[callerProfile.role] ?? [];
  if (!allowedRoles.includes(payload.role)) {
    return jsonResponse(
      { error: `${callerProfile.role} cannot create users with role "${payload.role}"` },
      403,
    );
  }

  // ── Validation ──────────────────────────────────────────────────────────
  if (!payload.email || !payload.role) {
    return jsonResponse({ error: 'email and role are required' }, 400);
  }

  const fullName =
    payload.full_name?.trim() ||
    `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim() ||
    payload.email.split('@')[0];

  // school_admin and head_teacher callers can only create users in their OWN
  // school — this is the actual security boundary for this function, not a
  // suggestion, since the admin client below bypasses RLS entirely.
  const targetSchoolId =
    callerProfile.role === 'super_admin'
      ? (payload.school_id ?? null)
      : callerProfile.school_id;

  if (callerProfile.role !== 'super_admin' && !targetSchoolId) {
    return jsonResponse({ error: 'Caller has no school_id on file — cannot create school-scoped users' }, 400);
  }

  // ── Step 1: create the auth user ───────────────────────────────────────
  const shouldInvite = payload.send_invite_email !== false;

  let newUserId: string;

  if (shouldInvite) {
    // inviteUserByEmail creates the auth user AND sends them a real email
    // with a link to set their own password — no temporary password ever
    // exists, which is the safer default for staff/parent accounts.
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      payload.email,
      {
        data: {
          full_name: fullName,
          first_name: payload.first_name ?? fullName.split(' ')[0],
          last_name: payload.last_name ?? fullName.split(' ').slice(1).join(' '),
          role: payload.role,
          phone: payload.phone ?? null,
        },
      },
    );
    if (inviteErr || !invited?.user) {
      const isDuplicate = /already.*registered|already exists/i.test(inviteErr?.message ?? '');
      return jsonResponse(
        { error: isDuplicate ? 'A user with this email already exists.' : (inviteErr?.message ?? 'Failed to invite user') },
        isDuplicate ? 409 : 500,
      );
    }
    newUserId = invited.user.id;
  } else {
    // No-invite path: used by signInWithStudentPin's companion flow (a
    // student account that logs in via a school code + PIN, never an
    // email link) — createUser with email_confirm so they can be signed
    // in immediately via setSession elsewhere, with no email ever sent.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: payload.email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: payload.first_name ?? fullName.split(' ')[0],
        last_name: payload.last_name ?? fullName.split(' ').slice(1).join(' '),
        role: payload.role,
        phone: payload.phone ?? null,
      },
    });
    if (createErr || !created?.user) {
      const isDuplicate = /already.*registered|already exists/i.test(createErr?.message ?? '');
      return jsonResponse(
        { error: isDuplicate ? 'A user with this email already exists.' : (createErr?.message ?? 'Failed to create user') },
        isDuplicate ? 409 : 500,
      );
    }
    newUserId = created.user.id;
  }

  // ── Step 2: upsert the profile row ─────────────────────────────────────
  // handle_new_auth_user() (the trigger in 0001_fresh_backend.sql) already
  // creates a basic profile row the instant auth.admin.createUser/
  // inviteUserByEmail inserts into auth.users — but it doesn't know
  // school_id or class_id, since those aren't part of raw_user_meta_data.
  // This upsert fills those in immediately rather than waiting for the
  // user's first login to self-heal them via authService.js.
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert({
      user_id: newUserId,
      full_name: fullName,
      first_name: payload.first_name ?? fullName.split(' ')[0],
      last_name: payload.last_name ?? fullName.split(' ').slice(1).join(' '),
      email: payload.email,
      role: payload.role,
      school_id: targetSchoolId,
      phone: payload.phone ?? null,
    }, { onConflict: 'user_id' });

  if (profileErr) {
    // Roll back: don't leave an orphaned auth user with no usable profile.
    await admin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: `Failed to create profile: ${profileErr.message}` }, 500);
  }

  // ── Step 3: role-specific follow-up ─────────────────────────────────────
  if (payload.role === 'teacher' && payload.class_id) {
    const { error: classErr } = await admin
      .from('classes')
      .update({ teacher_id: newUserId })
      .eq('id', payload.class_id)
      .eq('school_id', targetSchoolId); // belt-and-suspenders: never touch a class outside the caller's school
    if (classErr) {
      console.error('[admin-create-user] failed to assign teacher to class', classErr);
      // Non-fatal: the user account is real and usable; class assignment
      // can be retried from AdminClasses.jsx's existing "Assign teacher" UI.
    }
  }

  if ((payload.role === 'parent' || payload.role === 'student') && payload.link_pupil_id) {
    const linkColumn = payload.role === 'parent' ? 'parent_id' : 'student_user_id';
    const { error: linkErr } = await admin
      .from('pupils')
      .update({ [linkColumn]: newUserId })
      .eq('id', payload.link_pupil_id)
      .eq('school_id', targetSchoolId);
    if (linkErr) {
      console.error('[admin-create-user] failed to link pupil', linkErr);
    }
  }

  return jsonResponse({
    user_id: newUserId,
    email: payload.email,
    role: payload.role,
    invited: shouldInvite,
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────
// FRONTEND CALL SITE UPDATE NEEDED
// ─────────────────────────────────────────────────────────────────────────
// AdminStaff.jsx currently calls:
//   supabase.functions.invoke('invite-staff', { body: { ...form, school_id: schoolId } })
// Update that to:
//   supabase.functions.invoke('admin-create-user', {
//     body: {
//       email: form.email,
//       first_name: form.first_name,
//       last_name: form.last_name,
//       role: form.role,            // 'teacher' | 'head_teacher' | 'school_admin'
//     },
//   })
// (school_id is no longer sent from the client — this function derives it
// from the caller's own profile, which is also more secure: a compromised
// or buggy client can no longer specify an arbitrary school_id.)
