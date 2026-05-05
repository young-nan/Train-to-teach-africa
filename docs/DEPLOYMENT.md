# Deployment Guide

## Targets

- **Main site:** `traintoteachafrica.org` (Vercel)
- **App subdomain:** `app.traintoteachafrica.org` (same Vercel project)
- **SIMS subdomain:** `sims.traintoteachafrica.org` (alias to the same project; same SPA, just a different surface for school staff)
- **DNS / WAF:** Cloudflare in front of all three

---

## First-time setup

### 1. Provision Supabase

1. Create a new Supabase project (region: `eu-west-2` — closest to Lagos with stable latency).
2. Note the project ref, anon key, service role key.
3. Enable Auth → Email + Password.
4. Disable Auth → Magic Link (we use PKCE password flow + edge function PIN auth).

### 2. Run migrations

```bash
supabase link --project-ref <ref>
supabase db push
```

Migrations are in `supabase/migrations/` and run in lexicographic order.

### 3. Deploy edge functions

```bash
supabase functions deploy verify-payment
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
supabase secrets set PAYSTACK_WEBHOOK_SECRET=whsec_xxx
```

(Service role key is set automatically by Supabase.)

### 4. Configure Paystack webhook

See [`PAYSTACK_WEBHOOK_SETUP.md`](./PAYSTACK_WEBHOOK_SETUP.md).

### 5. Vercel

1. Import this repo into Vercel.
2. Set environment variables (see [`ENVIRONMENT.md`](./ENVIRONMENT.md)).
3. Build command: `npm run build`. Output: `dist`.
4. Add custom domains: `traintoteachafrica.org`, `app.traintoteachafrica.org`, `sims.traintoteachafrica.org`.

### 6. Cloudflare

1. Point each domain's nameservers to Cloudflare.
2. Configure DNS:
   - `traintoteachafrica.org` → Vercel (CNAME, proxied)
   - `app.traintoteachafrica.org` → Vercel (CNAME, proxied)
   - `sims.traintoteachafrica.org` → Vercel (CNAME, proxied)
3. SSL/TLS mode: **Full (strict)**.
4. Caching: cache `/assets/*` aggressively (1 year). HTML responses pass through.
5. WAF: enable managed rules. Add a rate-limit rule for `/auth/*` (10 req/min/IP).

---

## CI/CD

Every push to `main` auto-deploys via Vercel. Pull requests get preview deployments.

The CI pipeline (`.github/workflows/ci.yml` — to be created) runs:

```yaml
- npm ci
- npm run lint            # blocks merge on lint errors
- npm test                # vitest suite
- node ops/check-pricing-sync.mjs   # blocks if pricing.js drifts from edge fn
- npm run build           # blocks merge on build errors
```

---

## Environment-specific notes

### Staging (preview deployments)
- Use Paystack **test** keys.
- Run against a staging Supabase project, not production.
- Set `VITE_SITE_URL` and `VITE_APP_URL` to the preview URL.

### Production
- Paystack **live** keys only after full end-to-end test in staging.
- Verify the webhook secret is configured in Supabase before flipping to live.

---

## Rollback

Vercel keeps every deployment. To roll back:

```bash
vercel rollback <deployment-url>
```

Database migrations are forward-only by policy. If a migration is bad,
ship a corrective migration; don't try to undo.

---

## Observability

- **Vercel:** function logs + edge runtime metrics
- **Supabase:** Postgres logs, edge function invocations
- **Sentry:** front-end errors (configure `VITE_SENTRY_DSN` — not in this scaffold; add when shipping)
- **Audit log:** the `audit_log` table is the application-level forensic record
