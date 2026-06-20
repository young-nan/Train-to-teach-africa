// supabase/functions/_shared/cors.ts
//
// Shared CORS headers for every Edge Function in this project. Browsers send
// a CORS preflight (OPTIONS) request before any cross-origin POST with a
// JSON body, so every function must handle OPTIONS and return these headers
// on every response (including error responses) or the browser will block
// the real request entirely with a CORS error that looks nothing like the
// actual problem.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
