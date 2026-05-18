/**
 * src/services/authService.js
 *
 * The ONLY module that may call supabase.auth.* — anywhere else in the codebase
 * doing so is a lint violation. UI imports `useAuth()` (a hook), which calls
 * this service.
 *
 * Why a service layer at all:
 *   - Migration risk: if we ever swap Supabase for our own auth, this file
 *     is the entire blast radius.
 *   - Testability: tests stub `authService` and never need to mock the
 *     Supabase client.
 *   - Audit clarity: every login, logout, and session refresh flows through
 *     a function we own and can instrument.
 */

import { supabase } from '@/lib/supabase';

/**
 * Sign in with email + password. Schools use this; parents may also.
 * Returns the Supabase session on success.
 */
export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw mapAuthError(error);
  return data.session;
}

/**
 * Sign up. The actual profile row is created by a Postgres trigger
 * (see migration 0001) — never inside the application. Trigger writes
 * are atomic with auth.users insertion.
 *
 * Returns { session, confirmationRequired }.
 * When Supabase has email confirmation enabled, session is null and
 * confirmationRequired is true — the UI must show a "check your email" screen.
 * When confirmation is disabled (dev / magic-link off), session is live.
 */
export async function signUp({ email, password, fullName, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });
  if (error) throw mapAuthError(error);
  // session is null when Supabase requires email confirmation before issuing a session.
  const confirmationRequired = !data.session;
  return { session: data.session, confirmationRequired };
}

/**
 * PIN sign-in for students. Students use a 4-digit PIN, not an email/password,
 * because they are children using shared devices. The PIN check is server-side
 * via an Edge Function — never validated in the browser.
 */
export async function signInWithStudentPin({ schoolCode, pupilCode, pin }) {
  const { data, error } = await supabase.functions.invoke('student-pin-login', {
    body: { schoolCode, pupilCode, pin },
  });
  if (error) throw mapAuthError(error);
  // Edge function returns a short-lived custom JWT; we exchange it for a session.
  const { error: setErr } = await supabase.auth.setSession({
    access_token: data.access_token,
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
  // Returns the unsubscribe function the caller (useAuth) cleans up on unmount.
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Hydrate the user's profile + role + school context. Called once after auth
 * state change, then cached in the auth store. The view here joins three
 * tables — see `current_user_profile` view in migration 0002.
 *
 * Wrapped in a 10s timeout because supabase-js doesn't expose a request
 * timeout setting, and on mobile we've seen the request hang indefinitely
 * when Cloudflare returns a 5xx that supabase-js doesn't surface as an
 * error — leaving the auth bootstrap stuck.
 *
 * Retries once on timeout. A second timeout suggests a real outage,
 * not a transient blip; we let it throw so the caller can show an error.
 */
export async function hydrateProfile(userId, { attempt = 0 } = {}) {
  const HYDRATE_TIMEOUT_MS = 10_000;
  const MAX_ATTEMPTS = 2;

  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Profile hydration timed out')),
      HYDRATE_TIMEOUT_MS,
    );
  });

  try {
    const result = await Promise.race([
      supabase
        .from('current_user_profile')
        .select('*')
        .eq('user_id', userId)
        .single(),
      timeoutPromise,
    ]);
    clearTimeout(timeoutHandle);
    const { data, error } = result;
    if (error) throw mapAuthError(error);
    return data;
  } catch (e) {
    clearTimeout(timeoutHandle);
    const isTimeout = e?.message === 'Profile hydration timed out';
    if (isTimeout && attempt + 1 < MAX_ATTEMPTS) {
      console.warn('[auth] hydration timed out, retrying once');
      return hydrateProfile(userId, { attempt: attempt + 1 });
    }
    throw e;
  }
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_APP_URL}/auth/reset`,
  });
  if (error) throw mapAuthError(error);
}

// ---- Internal --------------------------------------------------------------

/**
 * Map Supabase auth errors into stable app errors with user-safe messages.
 * Components should never display Supabase error strings raw.
 */
function mapAuthError(err) {
  const code = err?.code || err?.status || 'unknown';
  const message = err?.message || 'Authentication failed';
  const safeMessage =
    /invalid login/i.test(message) ? 'Email or password is incorrect.' :
    /email not confirmed/i.test(message) ? 'Please confirm your email first.' :
    /rate limit/i.test(message) ? 'Too many attempts. Try again in a minute.' :
    'Something went wrong. Please try again.';

  const e = new Error(safeMessage);
  e.code = code;
  e.cause = err;
  return e;
}
