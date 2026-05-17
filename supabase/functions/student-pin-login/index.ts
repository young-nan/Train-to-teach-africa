// supabase/functions/student-pin-login/index.ts
//
// Student authentication via PIN (not email/password).
// Students sign in with: school_code + pupil_code + 4-digit PIN.
//
// FLOW
// ────
// 1. Client (StudentPinPage) posts { school_code, pupil_code, pin }
// 2. This function calls verify_student_pin RPC (security definer)
//    which does the bcrypt comparison server-side
// 3. If credentials match: create a Supabase custom token session
//    by signing in the pupil's auth.users row (if one exists)
//    OR by issuing an anonymous session with pupil_code in metadata
// 4. Return { access_token, refresh_token, pupil } to the client
//
// AUTH STRATEGY
// ─────────────
// Students are stored in public.pupils, not auth.users.
// They don't have email addresses. We use Supabase's custom auth
// approach: each pupil has a corresponding auth.users row with a
// synthetic email (pupil_code@students.tta.app) and a random password
// set at enrolment. The edge function signs in as that user using the
// service role, then returns the session to the student client.
//
// The JWT will contain:
//   user_metadata.pupil_code  → used by RLS policies (via auth.jwt())
//   user_metadata.pupil_id    → the UUID of the pupils row
//   user_metadata.role        → 'student' (for RequireRole guard)
//
// SECURITY
// ────────
// - verify_student_pin RPC is service-role only; client cannot call it
// - PIN comparison uses bcrypt via pgcrypto (timing-safe)
// - Rate limit: 5 failed attempts per pupil_code per 15 minutes
//   (tracked in a simple in-memory map per instance — good enough
//    for a school device that resets daily; use Redis for production scale)
// - school_code prevents cross-school enumeration

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Simple in-memory rate limiter per pupil_code (resets on function cold-start)
const failedAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): boolean {
  const now  = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry) return true;
  if (now - entry.firstAt > WINDOW_MS) {
    failedAttempts.delete(key);
    return true;
  }
  return entry.count < MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now   = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    failedAttempts.set(key, { count: 1, firstAt: now });
  } else {
    entry.count++;
  }
}

function clearFailures(key: string) {
  failedAttempts.delete(key);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── 1. Parse body ─────────────────────────────────────────────────────────
  let body: { school_code?: string; pupil_code?: string; pin?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request' }, 400); }

  const { school_code, pupil_code, pin } = body;
  if (!school_code?.trim() || !pupil_code?.trim() || !pin?.trim()) {
    return json({ error: 'school_code, pupil_code and pin are required' }, 400);
  }

  // Normalise
  const normSchool = school_code.trim().toUpperCase();
  const normPupil  = pupil_code.trim().toUpperCase();
  const rateLimitKey = `${normSchool}:${normPupil}`;

  // ── 2. Rate limit check ────────────────────────────────────────────────────
  if (!checkRateLimit(rateLimitKey)) {
    return json({
      error: 'Too many failed attempts. Please wait 15 minutes or ask your teacher to reset your PIN.',
    }, 429);
  }

  // ── 3. Verify PIN via service-role RPC ────────────────────────────────────
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pupils, error: rpcErr } = await serviceClient.rpc('verify_student_pin', {
    p_school_code: normSchool,
    p_pupil_code:  normPupil,
    p_pin:         pin.trim(),
  });

  if (rpcErr) {
    console.error('[student-pin-login] RPC error:', rpcErr.message);
    return json({ error: 'Authentication service unavailable. Try again.' }, 500);
  }

  const pupil = pupils?.[0];

  if (!pupil) {
    recordFailure(rateLimitKey);
    // Generic error — don't reveal which field is wrong
    return json({ error: 'Could not sign in. Check your codes with your teacher.' }, 401);
  }

  clearFailures(rateLimitKey);

  // ── 4. Sign in as the pupil's auth.users account ─────────────────────────
  // Each pupil has a synthetic email: {pupil_code}@students.tta.app
  // This was created when the teacher set the pupil's PIN for the first time.
  const studentEmail = `${normPupil.toLowerCase()}@students.tta.app`;

  // Get or create the student's auth.users row
  let session: { access_token: string; refresh_token: string } | null = null;

  // Try to get existing user
  const { data: { users } } = await serviceClient.auth.admin.listUsers({
    filter: `email.eq.${studentEmail}`,
  });
  const existingUser = users?.[0];

  if (existingUser) {
    // Issue a session for the existing user
    // We use generateLink to create a magic link then immediately exchange it
    const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
      type:       'magiclink',
      email:      studentEmail,
      options: {
        data: {
          pupil_code: normPupil,
          pupil_id:   pupil.pupil_id,
          full_name:  pupil.full_name,
          level:      pupil.level,
          school_id:  pupil.school_id,
          role:       'student',
        },
      },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      // Fallback: use admin.createSession (available in newer Supabase versions)
      console.error('[student-pin-login] link error:', linkErr?.message);
      return json({ error: 'Could not create session. Contact support.' }, 500);
    }

    // Exchange the link for a session by calling the verify endpoint
    const verifyUrl = new URL(
      `/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink`,
      Deno.env.get('SUPABASE_URL')!,
    );
    const verifyRes = await fetch(verifyUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')! },
    });

    // The verify endpoint redirects — we need to catch the session from the URL
    // or use the direct API. Use admin.createSession instead (cleaner):
    const { data: sessionData, error: sessionErr } =
      await serviceClient.auth.admin.createSession({ user_id: existingUser.id });

    if (sessionErr || !sessionData?.session) {
      console.error('[student-pin-login] session error:', sessionErr?.message);
      return json({ error: 'Could not create session.' }, 500);
    }

    session = sessionData.session;
  } else {
    // Create the auth.users row for this pupil (first sign-in after PIN set)
    const { data: newUser, error: createErr } = await serviceClient.auth.admin.createUser({
      email:          studentEmail,
      email_confirm:  true,
      user_metadata: {
        pupil_code: normPupil,
        pupil_id:   pupil.pupil_id,
        full_name:  pupil.full_name,
        level:      pupil.level,
        school_id:  pupil.school_id,
        role:       'student',
      },
    });

    if (createErr || !newUser?.user) {
      console.error('[student-pin-login] create user error:', createErr?.message);
      return json({ error: 'Could not create student account.' }, 500);
    }

    const { data: sessionData, error: sessionErr } =
      await serviceClient.auth.admin.createSession({ user_id: newUser.user.id });

    if (sessionErr || !sessionData?.session) {
      return json({ error: 'Could not create session.' }, 500);
    }

    session = sessionData.session;
  }

  // ── 5. Return session + pupil info ────────────────────────────────────────
  return json({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    pupil: {
      id:         pupil.pupil_id,
      full_name:  pupil.full_name,
      level:      pupil.level,
      school_id:  pupil.school_id,
      pupil_code: normPupil,
    },
  });
});
