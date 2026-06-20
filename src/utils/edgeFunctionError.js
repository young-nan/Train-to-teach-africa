/**
 * src/utils/edgeFunctionError.js
 *
 * supabase-js has a long-standing, well-documented gap (see
 * github.com/supabase/functions-js issues #45, #51, #55 — all confirmed,
 * none ever fixed before that repo was archived): when an Edge Function
 * responds with a non-2xx status, `functions.invoke()` returns `data: null`
 * and a generic `FunctionsHttpError: Edge Function returned a non-2xx
 * status code` — the actual JSON body we returned (e.g.
 * `{ error: "A user with this email already exists." }`) is discarded by
 * the client library, even though it's sitting right there in the network
 * response.
 *
 * The fix: `error.context` (when the error is a FunctionsHttpError) is the
 * raw Response object. Re-reading its body with `.json()` recovers the
 * real message. This only works once — a Response body can only be read
 * once — so every call site that invokes an Edge Function and wants a real
 * error message should funnel through this helper rather than each
 * reinventing (and likely getting subtly wrong) the same `.context.json()`
 * dance.
 *
 * Usage:
 *   const { data, error } = await supabase.functions.invoke('admin-create-user', { body });
 *   if (error) {
 *     const message = await extractEdgeFunctionErrorMessage(error);
 *     throw new Error(message);
 *   }
 *   if (data?.error) throw new Error(data.error); // belt-and-suspenders for the success-status-but-error-in-body shape
 */
export async function extractEdgeFunctionErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;

  // FunctionsHttpError: the function ran and returned a non-2xx status.
  // error.context is the raw Response — read it once to recover our body.
  if (error.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (typeof body === 'string') return body;
    } catch {
      // Body wasn't JSON (or was already consumed) — fall through to the
      // generic message below rather than throwing a second, more
      // confusing error from inside an error handler.
    }
  }

  // FunctionsRelayError / FunctionsFetchError, or any other shape: use
  // whatever message is on the error itself before giving up.
  return error.message || fallback;
}
