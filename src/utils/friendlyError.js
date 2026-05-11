/**
 * src/utils/friendlyError.js
 *
 * Translate the raw technical error messages thrown by Supabase / Postgres
 * into something a non-tech user can act on. Schools don't speak HTTP or
 * PGRST. They need: "what went wrong, what should I do."
 *
 * Logs the original message to the console so we can still debug, but
 * returns a clean string for display.
 *
 * To extend: add another case to the matchers list. Most patterns can be
 * matched by substring; some need to look at the supabase error code if
 * the message text varies between versions.
 */

const MATCHERS = [
  // Missing RPC — usually means a migration wasn't applied
  {
    test: (msg) => /could not find the function/i.test(msg) || /PGRST202/i.test(msg),
    message: () => 'The system is updating. Please refresh the page in a moment, or contact support if this keeps happening.',
  },
  // RLS denied a write
  {
    test: (msg) => /row.level security|new row violates/i.test(msg),
    message: () => "You don't have permission to do that. Ask a head teacher or school admin if you think you should.",
  },
  // Network down / supabase unreachable
  {
    test: (msg) => /failed to fetch|network|timeout|networkerror/i.test(msg),
    message: () => "Couldn't reach the server. Check your internet connection and try again.",
  },
  // Duplicate
  {
    test: (msg) => /duplicate key|already exists|unique constraint/i.test(msg),
    message: (msg) => {
      // Try to extract what the duplicate value is for a more helpful message
      const m = msg.match(/=\(([^)]+)\)/);
      return m
        ? `That value (${m[1]}) is already in use. Please use a different one.`
        : "That entry already exists. Please use a different value.";
    },
  },
  // Required field missing
  {
    test: (msg) => /violates not-null constraint/i.test(msg),
    message: (msg) => {
      const m = msg.match(/column "([^"]+)"/);
      return m
        ? `The ${m[1].replace(/_/g, ' ')} field is required.`
        : 'A required field is missing.';
    },
  },
  // Auth / session
  {
    test: (msg) => /jwt|invalid session|not.signed.in|not.authenticated/i.test(msg),
    message: () => 'Your session expired. Please sign in again.',
  },
];

/**
 * @param {Error|string} err — the raw error or its message
 * @param {string} fallback — used if no matcher fires (defaults to a generic message)
 * @returns {string}
 */
export function friendlyError(err, fallback = "Something went wrong. Please try again or contact support if this keeps happening.") {
  const raw = typeof err === 'string' ? err : (err?.message ?? '');
  if (!raw) return fallback;

  // Always log the technical detail so devs can debug
  console.warn('[friendlyError]', raw);

  for (const m of MATCHERS) {
    if (m.test(raw)) return m.message(raw);
  }
  return fallback;
}
