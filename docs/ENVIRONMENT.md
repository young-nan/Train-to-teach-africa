# Environment Setup

## Variables

Copy `.env.example` to `.env.local` for local dev. In production, set
these in Vercel Project Settings → Environment Variables.

| Variable                       | Where     | Public | Purpose |
|--------------------------------|-----------|--------|---------|
| `VITE_SUPABASE_URL`            | All       | Yes    | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY`       | All       | Yes    | Anon key (RLS enforces security) |
| `VITE_PAYSTACK_PUBLIC_KEY`     | All       | Yes    | Paystack public key (for inline checkout) |
| `VITE_SITE_URL`                | All       | Yes    | Marketing URL (used in OG tags, email links) |
| `VITE_APP_URL`                 | All       | Yes    | Authenticated app URL (used in password reset) |
| `VITE_FX_NGN_PER_USD`          | All       | Yes    | FX benchmark for USD-equivalent display |
| `VITE_FX_BENCHMARK_DATE`       | All       | Yes    | ISO date of the FX benchmark |
| `SUPABASE_SERVICE_ROLE_KEY`    | Edge fn   | **No** | Service role for verify-payment |
| `PAYSTACK_SECRET_KEY`          | Edge fn   | **No** | Secret used by initialise-payment fn |
| `PAYSTACK_WEBHOOK_SECRET`      | Edge fn   | **No** | HMAC secret for webhook signature verification |

> **Hard rule:** anything starting with `VITE_` is bundled into the
> browser. Never put a secret behind that prefix.

---

## Updating the FX benchmark

When the FX rate moves significantly (typically every 4–8 weeks):

1. Update `VITE_FX_NGN_PER_USD` and `VITE_FX_BENCHMARK_DATE` in Vercel.
2. Redeploy.
3. The disclaimer auto-regenerates from these values via `src/config/pricing.js`.

NGN prices themselves never move. Only the USD-equivalent display
recalculates.

---

## Updating prices

Prices are NEVER edited inline. The single source of truth is
`src/config/pricing.js`. The flow is:

1. Edit `src/config/pricing.js`.
2. Edit the duplicated `PLANS` object in
   `supabase/functions/verify-payment/index.ts` to match.
3. Edit the `case` block in
   `supabase/migrations/000X_xxx.sql → activate_subscription`.
4. Run `node ops/check-pricing-sync.mjs` — should print "OK".
5. Add a price-history row by writing a new migration like:

   ```sql
   insert into public.audit_log (actor, action, details)
   values ('system', 'pricing.updated', '{ ... old vs new ... }');
   ```

6. Commit all four files together.

The CI pricing-sync check fails the build if any of the three sources
drift.
