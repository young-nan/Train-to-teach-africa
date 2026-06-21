/**
 * src/services/authService.js — v3 hardened version
 *
 * Changes vs v2:
 *  - hydrateProfile: faster primary path, graceful fallback, shorter initial
 *    timeout, derives first_name/last_name from full_name so every component
 *    can use profile.first_name without knowing the DB schema.
 *  - All other functions unchanged.
 */

import { supabase } from '@/lib/supabase';

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw mapAuthError(error);
  return data.session;
}

export async function signUp({ email, password, fullName, first_name, last_name, role, phone, city, state, ...extraMeta }) {
  const resolvedFullName = fullName || `${first_name ?? ''} ${last_name ?? ''}`.trim() || email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: resolvedFullName,
        first_name: first_name ?? resolvedFullName.split(' ')[0],
        last_name:  last_name  ?? resolvedFullName.split(' ').slice(1).join(' '),
        role,
        phone:  phone  ?? null,
        city:   city   ?? null,
        state:  state  ?? null,
        ...extraMeta,
      },
    },
  });
  if (error) throw mapAuthError(error);
  const confirmationRequired = !data.session;
  return { session: data.session, confirmationRequired };
}

export async function signInWithStudentPin({ schoolCode, pupilCode, pin }) {
  const { data, error } = await supabase.functions.invoke('student-pin-login', {
    body: { schoolCode, pupilCode, pin },
  });
  if (error) throw mapAuthError(error);
  const { error: setErr } = await supabase.auth.setSession({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
  });
  if (setErr) throw mapAuthError(setErr);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw mapAuthError(error);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw mapAuthError(error);
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Hydrate the user's profile. Strategy:
 *
 * 1. Try the full `current_user_profile` view first (has school_name, child_ids).
 *    Timeout after 6s (was 10s — cold-start Supabase free tier is ~3–4s).
 * 2. On timeout, fall back to a direct `profiles` query (single table, always fast).
 * 3. If the profile row genuinely doesn't exist (PGRST116 — zero rows), self-heal
 *    by creating it from the user's own auth.users metadata, then retry once.
 *    This covers the case where the handle_new_auth_user() database trigger
 *    didn't fire — which can happen on Supabase for reasons outside this app's
 *    control (e.g. the well-documented free-tier restriction on creating
 *    triggers on auth.users, or a transient failure during signup). Without
 *    this, a user whose profile row never got created would see "[auth]
 *    profile hydration failed" on every single login, forever, with no way
 *    to recover except a manual database fix.
 * 4. Derive `first_name` / `last_name` from `full_name` so components can use
 *    either naming scheme regardless of DB column.
 */
export async function hydrateProfile(userId, { attempt = 0 } = {}) {
  const TIMEOUT_MS = 6_000;

  let timeoutHandle;
  const raceTimeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Profile hydration timed out')),
      TIMEOUT_MS,
    );
  });

  try {
    const result = await Promise.race([
      supabase
        .from('current_user_profile')
        .select('*')
        .eq('user_id', userId)
        .single(),
      raceTimeout,
    ]);
    clearTimeout(timeoutHandle);
    const { data, error } = result;

    if (error) {
      // PGRST116 = "Cannot coerce the result to a single JSON object" —
      // PostgREST's error for .single() matching zero (or multiple) rows.
      // Zero rows here means the profiles row for this user doesn't exist.
      if (error.code === 'PGRST116' && attempt === 0) {
        console.warn('[auth] no profile row found for this user — attempting self-heal');
        const healed = await selfHealMissingProfile(userId);
        if (healed) return hydrateProfile(userId, { attempt: 1 });
      }
      throw mapAuthError(error);
    }

    return normalise(data);
  } catch (e) {
    clearTimeout(timeoutHandle);

    const isTimeout = e?.message === 'Profile hydration timed out';

    // First timeout: try once more
    if (isTimeout && attempt === 0) {
      console.warn('[auth] view timed out on first attempt, retrying once');
      return hydrateProfile(userId, { attempt: 1 });
    }

    // Second timeout (or any other error): fall back to the fast profiles table
    if (isTimeout) {
      console.warn('[auth] view timed out again — falling back to profiles table');
      return hydrateFast(userId);
    }

    throw e;
  }
}

/**
 * Attempts to create a missing profiles row from the user's own auth
 * metadata. Returns true if a row now exists (created here, or it turned out
 * to already exist from a race with the trigger), false if it genuinely
 * could not be created (e.g. the user's own auth session has no metadata,
 * which would itself indicate a deeper signup problem worth surfacing).
 */
async function selfHealMissingProfile(userId) {
  const { data: userResult, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResult?.user) return false;

  const meta = userResult.user.user_metadata ?? {};
  const fullName =
    meta.full_name ||
    `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim() ||
    userResult.user.email?.split('@')[0] ||
    'User';

  const { error: insertErr } = await supabase
    .from('profiles')
    .upsert({
      user_id:    userId,
      full_name:  fullName,
      first_name: meta.first_name ?? null,
      last_name:  meta.last_name ?? null,
      email:      userResult.user.email,
      role:       meta.role ?? 'parent',
      phone:      meta.phone ?? null,
      city:       meta.city ?? null,
      state:      meta.state ?? null,
    }, { onConflict: 'user_id' });

  if (insertErr) {
    console.error('[auth] self-heal failed — could not create profile row', insertErr);
    return false;
  }
  return true;
}

/**
 * Fast fallback: query the `profiles` table directly (single table, no join).
 * Returns a shape compatible with the full profile, but with school_name = null
 * and child_ids = []. The caller must tolerate these being null for a moment.
 */
async function hydrateFast(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, role, school_id, avatar_url')
    .eq('user_id', userId)
    .single();

  if (error) throw mapAuthError(error);
  return normalise({ ...data, school_name: null, child_ids: [] });
}

/**
 * Normalise a raw profile row into the shape components expect:
 *  - first_name / last_name derived from full_name
 *  - Stable field names regardless of which query path was used
 */
function normalise(raw) {
  if (!raw) return null;
  const fullName = raw.full_name ?? '';
  const parts     = fullName.trim().split(/\s+/);
  const firstName = raw.first_name ?? parts[0]  ?? '';
  const lastName  = raw.last_name  ?? parts.slice(1).join(' ') ?? '';

  return {
    ...raw,
    full_name:  fullName,
    first_name: firstName,
    last_name:  lastName,
    // Convenience alias so components can call profile.name too
    name: fullName,
  };
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/auth/reset`,
  });
  if (error) throw mapAuthError(error);
}

// ── Internal ────────────────────────────────────────────────────────────────

function mapAuthError(err) {
  const message = err?.message || 'Authentication failed';

  // Only remap errors that actually come from Supabase Auth's sign-in/sign-up
  // endpoints — these have recognizable, stable message text. Anything else
  // (PostgREST/Postgres errors from a table or view query, e.g. PGRST116
  // "Cannot coerce the result to a single JSON object" when a profile row is
  // missing) is passed through with its real code and message untouched.
  // Masking those behind "Something went wrong" is exactly what made this
  // class of bug invisible in the browser console — see the postmortem in
  // hydrateProfile() below for why a missing profile row is the most common
  // real cause of an auth-flow-looking error that isn't actually an auth error.
  const isKnownAuthError =
    /invalid login/i.test(message) ||
    /email not confirmed/i.test(message) ||
    /rate limit/i.test(message) ||
    /user not found/i.test(message);

  if (!isKnownAuthError) {
    // Re-throw as-is so e.code/e.message/e.details reach the console and
    // any error-reporting tool with their original, diagnosable content.
    return err;
  }

  const safeMessage =
    /invalid login/i.test(message)      ? 'Email or password is incorrect.'          :
    /email not confirmed/i.test(message) ? 'Please confirm your email first.'         :
    /rate limit/i.test(message)         ? 'Too many attempts. Try again in a minute.' :
                                           'No account found with that email.';

  const e = new Error(safeMessage);
  e.code  = err?.code || err?.status || 'unknown';
  e.cause = err;
  return e;
}
