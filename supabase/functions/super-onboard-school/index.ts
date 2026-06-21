// supabase/functions/super-onboard-school/index.ts
//
// Creates a real school plus its first school_admin account in one step —
// the actual implementation behind SuperAdminApp.jsx's "Onboard school"
// button (currently decorative; see the comment block at the bottom of this
// file for the frontend wiring this still needs).
//
// Only a super_admin may call this — schools_insert_super_admin
// (0001_fresh_backend.sql) already enforces this at the RLS layer for the
// schools insert itself, but the admin client below uses the service_role
// key and therefore bypasses RLS entirely, so the authorization check at
// the top of this function IS the real security boundary here, the same
// way it is in admin-create-user/index.ts.
//
// This does NOT create a new super_admin — only schools + a school_admin
// for that new school. Creating additional super_admins should stay a
// deliberate, rare, manual action (see bootstrap_first_super_admin.sql) —
// automating it here would make "create a super_admin" just another form
// field, which is more reach than this function should casually grant.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface OnboardSchoolPayload {
  school_name: string;
  school_city?: string | null;
  school_state?: string | null;
  school_phone?: string | null;
  school_email?: string | null;
  academic_session?: string | null;
  admin_email: string;
  admin_first_name?: string;
  admin_last_name?: string;
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
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[super-onboard-school] missing required env vars');
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

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
    .select('role')
    .eq('user_id', callerAuth.user.id)
    .single();

  if (callerProfileErr || !callerProfile || callerProfile.role !== 'super_admin') {
    return jsonResponse({ error: 'Only a super_admin can onboard a new school' }, 403);
  }

  let payload: OnboardSchoolPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.school_name?.trim() || !payload.admin_email?.trim()) {
    return jsonResponse({ error: 'school_name and admin_email are required' }, 400);
  }

  const { data: school, error: schoolErr } = await admin
    .from('schools')
    .insert({
      name: payload.school_name.trim(),
      city: payload.school_city ?? null,
      state: payload.school_state ?? null,
      phone: payload.school_phone ?? null,
      email: payload.school_email ?? null,
      academic_session: payload.academic_session ?? '2025/2026',
    })
    .select('id, name')
    .single();

  if (schoolErr || !school) {
    return jsonResponse({ error: schoolErr?.message ?? 'Failed to create school' }, 500);
  }

  const adminFullName =
    `${payload.admin_first_name ?? ''} ${payload.admin_last_name ?? ''}`.trim() ||
    payload.admin_email.split('@')[0];

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    payload.admin_email,
    {
      data: {
        full_name: adminFullName,
        first_name: payload.admin_first_name ?? adminFullName.split(' ')[0],
        last_name: payload.admin_last_name ?? adminFullName.split(' ').slice(1).join(' '),
        role: 'school_admin',
      },
    },
  );

  if (inviteErr || !invited?.user) {
    const isDuplicate = /already.*registered|already exists/i.test(inviteErr?.message ?? '');
    return jsonResponse({
      school,
      admin_invite_error: isDuplicate
        ? "A user with this email already exists — the school was created, but you'll need to invite the admin separately."
        : (inviteErr?.message ?? "Failed to invite school admin — the school was created, but you'll need to invite the admin separately."),
    }, 207);
  }

  const { error: profileErr } = await admin
    .from('profiles')
    .upsert({
      user_id: invited.user.id,
      full_name: adminFullName,
      first_name: payload.admin_first_name ?? adminFullName.split(' ')[0],
      last_name: payload.admin_last_name ?? adminFullName.split(' ').slice(1).join(' '),
      email: payload.admin_email,
      role: 'school_admin',
      school_id: school.id,
    }, { onConflict: 'user_id' });

  if (profileErr) {
    console.error('[super-onboard-school] profile enrichment failed', profileErr);
  }

  return jsonResponse({ school, admin_user_id: invited.user.id }, 201);
});

// FRONTEND WIRING STILL NEEDED:
// SuperAdminApp.jsx's "Onboard school" button currently has no onClick.
// Wire it to a form modal collecting school_name/city/state/admin_email/
// admin_first_name/admin_last_name, then call:
//   supabase.functions.invoke('super-onboard-school', { body: form })
// and use extractEdgeFunctionErrorMessage() on any error, same pattern as
// AdminStaff.jsx's invite flow.
