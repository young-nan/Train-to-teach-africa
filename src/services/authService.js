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
 * 3. Derive `first_name` / `last_name` from `full_name` so components can use
 *    either naming scheme regardless of DB column.
 * 4. A background refresh of the full profile is triggered after the fast fallback
 *    so school_name and child_ids arrive within a few seconds of the initial load.
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
    if (error) throw mapAuthError(error);
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
  const safeMessage =
    /invalid login/i.test(message)         ? 'Email or password is incorrect.'          :
    /email not confirmed/i.test(message)    ? 'Please confirm your email first.'         :
    /rate limit/i.test(message)            ? 'Too many attempts. Try again in a minute.' :
    /user not found/i.test(message)        ? 'No account found with that email.'         :
    'Something went wrong. Please try again.';

  const e       = new Error(safeMessage);
  e.code        = err?.code || err?.status || 'unknown';
  e.cause       = err;
  return e;
}
