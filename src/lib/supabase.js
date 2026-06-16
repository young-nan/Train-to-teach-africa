/**
 * src/lib/supabase.js
 *
 * The single Supabase client. There is exactly one of these in the entire
 * codebase. Multiple clients = multiple auth sessions = silent bugs.
 *
 * IMPORTANT: Components must NOT import this file directly. They go through
 * the service layer (src/services/*). This rule is enforced by lint config —
 * see .eslintrc.cjs `no-restricted-imports`.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud, fail early — a misconfigured Supabase URL produces network
  // errors that look like bugs in user code. Better to crash on boot.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Schools use shared devices. PKCE keeps refresh tokens out of localStorage
    // exposure surface and aligns with Supabase's recommended flow for SPAs.
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-client-name': 'tta-platform-web',
      'x-client-version': '2.0.0',
    },
  },
});
