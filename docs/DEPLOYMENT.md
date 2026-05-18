# Train To Teach Africa — Deployment Runbook
**Version 2.0 · May 2026**

This document covers everything needed to deploy TTA from this repository to a
live production environment. Follow steps in order on first deploy. For
subsequent deploys (code changes) skip to [§7 — Deploying changes](#7-deploying-changes).

---

## Prerequisites

- Supabase account + project created (free tier is fine for pilot schools)
- Vercel account linked to the GitHub repository
- Paystack business account (test mode for staging, live mode for production)
- Meta for Developers account with a WhatsApp Business App (for nightly digest)
- Domain DNS access (for `traintoteachafrica.org` or your custom domain)
- Node.js ≥ 20 installed locally
- Supabase CLI installed: `npm install -g supabase`

---

## 1. Supabase project setup

### 1a. Run all migrations

```bash
supabase db push --project-ref YOUR_PROJECT_REF
```

This applies all 16 migrations in order:

| Migration | What it creates |
|---|---|
| 0001 | Core schema (schools, profiles, pupils, RLS foundation) |
| 0002 | Lessons, payments, SIMS (attendance, scores, subscriptions) |
| 0005 | Tutor marketplace |
| 0007 | Impact dashboard (materialized views, pg_cron snapshot) |
| 0008 | Super admin platform |
| 0009 | Admin dashboards (alerts, at-risk, attendance trend) |
| 0009 (role) | Role-specific dashboard RPCs |
| 0010 | Pricing v2 official (subscription_tiers, activate_subscription) |
| 0011 | School billing (invoices, payments, fee tracking) |
| 0012 | Parent communications log |
| 0013 | WhatsApp nightly digest (opt-ins, logs, pg_cron schedule) |
| 0014 | Student learning progress (progress, streaks, badges) |
| 0015 | Student PIN auth (pin_failures rate limiting) |
| 0016 | WhatsApp delivery tracking (message_id index, delivery_confirmed_at) |

**If any migration fails**, check the error — most failures are dependency
order issues or an already-applied migration. The migrations are idempotent
where possible (`CREATE IF NOT EXISTS`, `ON CONFLICT DO UPDATE`).

### 1b. Enable required extensions

In Supabase Dashboard → Project → Database → Extensions:
- ✅ `pg_cron` — for scheduled jobs (impact snapshots, alert generation, PIN cleanup)
- ✅ `pg_net` — for pg_cron → Edge Function calls (nightly digest trigger)

Both should be enabled by default on Supabase Pro. On free tier, `pg_net` may
need manual enabling.

### 1c. Configure pg_cron → nightly digest

After running migrations, run these in Supabase SQL Editor (replace placeholders):

```sql
alter database postgres
  set app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

alter database postgres
  set app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

This lets the `nightly_whatsapp_digest` pg_cron job call the `nightly-digest`
edge function at 18:00 UTC (19:00 WAT) each day.

### 1d. Deploy all edge functions

```bash
supabase functions deploy --project-ref YOUR_PROJECT_REF
```

This deploys all functions in `supabase/functions/`:

| Function | Purpose |
|---|---|
| `invite-user` | Staff + parent account creation |
| `initialise-payment` | Paystack transaction creation |
| `verify-payment` | Paystack webhook → subscription activation |
| `tutor-booking-payment` | Tutor session payment flow |
| `confirm-session` | Tutor session completion + payout trigger |
| `export-impact-report` | CSV/PDF impact export for school admins |
| `send-whatsapp` | Meta Cloud API + Termii SMS fallback |
| `nightly-digest` | Batch nightly lesson messages to opted-in parents |
| `whatsapp-webhook` | Meta delivery status callback handler |
| `student-pin-login` | Student PIN authentication → custom JWT |
| `set-student-pin` | Admin/parent sets a pupil's 4-digit PIN |

### 1e. Set Edge Function secrets

In Supabase Dashboard → Project → Settings → Edge Function Secrets:

```
META_WABA_PHONE_NUMBER_ID   = [your Meta WABA phone number ID]
META_WHATSAPP_TOKEN         = [your Meta system user access token]
META_APP_SECRET             = [your Meta app secret — for webhook HMAC]
META_WEBHOOK_VERIFY_TOKEN   = [any string you choose]
PAYSTACK_SECRET_KEY         = sk_live_xxx
PAYSTACK_WEBHOOK_SECRET     = whsec_xxx
TERMII_API_KEY              = TLxxxxxxxxxx   [optional — SMS fallback]
APP_BASE_URL                = https://traintoteachafrica.org
SITE_URL                    = https://traintoteachafrica.org
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_JWT_SECRET` are **auto-injected** by Supabase — do not add them
manually.

---

## 2. Meta WhatsApp setup

### 2a. Register the webhook URL

In Meta for Developers → Your App → WhatsApp → Configuration → Webhooks:

- **Callback URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token**: the value you set for `META_WEBHOOK_VERIFY_TOKEN`
- **Subscribed fields**: `messages` (for delivery receipts)

Click "Verify and Save". Supabase calls `GET` on your function — if the
`META_WEBHOOK_VERIFY_TOKEN` matches, it returns the challenge and Meta saves
the subscription.

### 2b. Register the nightly_lesson_v1 template

The nightly digest sends a pre-approved Meta template. Template registration
takes 1–3 business days.

Template name: `nightly_lesson_v1`
Category: `UTILITY`
Language: `en` (add `en_US` and `ha` as additional languages for reach)

Body:
```
Hi {{1}} 👋

Tonight's 5-minute activity for {{2}}:

*{{3}}*
{{4}}

Ask at dinner:
{{5}}

Open lesson: {{6}}
```

Parameters: `{{1}}` parent first name, `{{2}}` child first name,
`{{3}}` lesson title (bold), `{{4}}` kitchen activity, `{{5}}` dinner question,
`{{6}}` deep link URL.

Submit at: Meta Business Manager → Message Templates → Create Template.

---

## 3. Paystack setup

### 3a. Configure webhooks

In Paystack Dashboard → Settings → API Keys & Webhooks:

- **Webhook URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-payment`
- Copy the **webhook secret** → set as `PAYSTACK_WEBHOOK_SECRET` in Supabase Edge
  Function Secrets.

### 3b. Create subscription plans (optional)

If using Paystack recurring billing, create plans matching the plan codes in
`src/config/pricing.js`. For one-time term payments, no plans are needed.

---

## 4. Vercel setup

### 4a. Import the repository

Vercel Dashboard → Add New Project → Import Git Repository → select this repo.

Framework preset: **Vite** (auto-detected).

### 4b. Set environment variables

In Vercel → Project → Settings → Environment Variables, add:

```
VITE_SUPABASE_URL          = https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY     = eyJhbGciO...
VITE_PAYSTACK_PUBLIC_KEY   = pk_live_xxx
VITE_SITE_URL              = https://traintoteachafrica.org
VITE_APP_URL               = https://app.traintoteachafrica.org
VITE_FX_NGN_PER_USD        = 1370.26
VITE_FX_BENCHMARK_DATE     = 2026-05-05
```

Set each variable for **Production**, **Preview**, and **Development** environments.
Use `pk_test_xxx` for Preview/Development and `pk_live_xxx` for Production.

### 4c. Configure custom domain

Vercel → Project → Settings → Domains → Add domain:
- `traintoteachafrica.org`
- `www.traintoteachafrica.org` (redirect → apex)

Follow the DNS instructions Vercel provides (usually two CNAME records or A records).
HTTPS is automatic via Let's Encrypt.

### 4d. Deploy

Either push to `main` (auto-deploy is on by default) or:

```bash
vercel --prod
```

---

## 5. First-run checklist

Run through this after the first production deploy:

### Supabase
- [ ] `supabase db push` returned no errors
- [ ] All 11 edge functions deployed successfully
- [ ] `pg_cron` and `pg_net` extensions enabled
- [ ] `app.supabase_url` and `app.service_role_key` database config set
- [ ] All edge function secrets set
- [ ] Meta webhook URL registered and verified (green checkmark in Meta dashboard)
- [ ] `nightly_lesson_v1` template submitted (approval pending is OK — test with session messages)

### Vercel
- [ ] Build succeeded (check build logs for any VITE_ env var errors)
- [ ] Custom domain resolving with HTTPS
- [ ] `/` loads the home page
- [ ] `/sign-in` loads the auth page
- [ ] `/pricing` shows the correct NGN prices

### Paystack
- [ ] Paystack webhook URL set and receiving events (check Paystack dashboard logs)
- [ ] Test payment through `/sign-up` → subscribe flow completes without error

### End-to-end flow tests
- [ ] **School admin login**: sign in as a school admin, see the overview dashboard
- [ ] **Create a school**: super admin creates a school, adds an admin
- [ ] **Import pupils**: school admin imports a CSV of 5 pupils
- [ ] **Set student PIN**: school admin sets PINs for a class via `/app/admin/pupils/pins`
- [ ] **Student login**: student signs in with pupil code + PIN via `/student-sign-in`
- [ ] **Teacher attendance**: teacher marks a class register, confirms data saves offline
- [ ] **Parent subscribe**: parent subscribes to a plan, Paystack webhook fires, subscription activates
- [ ] **WhatsApp opt-in**: parent opts in with a phone number
- [ ] **Nightly digest**: manually trigger via `POST /functions/v1/nightly-digest` with the service role key — confirm batch runs and `nightly_dispatch_log` has rows

---

## 6. Ongoing operations

### Updating FX rate

When the NGN/USD rate shifts significantly:

1. Update `VITE_FX_NGN_PER_USD` in Vercel environment variables
2. Update `VITE_FX_BENCHMARK_DATE` to today's date
3. Trigger a Vercel redeploy (or push a commit)

The rate is compiled at build time — no runtime API call.

### Updating prices

Prices have THREE sources of truth that must stay in sync:

1. `src/config/pricing.js` — client static fallback
2. `supabase/functions/verify-payment/index.ts` — Paystack webhook validator
3. `supabase/functions/initialise-payment/index.ts` — Paystack transaction creator

Run the sync check before every price change:
```bash
node ops/check-pricing-sync.mjs
```

After updating all three files, also run migration `0010_pricing_v2_official.sql`
equivalent with the new amounts, or update the `subscription_tiers` table directly:
```sql
UPDATE public.subscription_tiers
SET price_minor = [new value in kobo/cents], updated_at = now()
WHERE code = 'AFR_PARENT_TERM';
```

### Refreshing materialized views

`school_kpis_v`, `school_impact_v`, and `network_impact_v` refresh every 5
minutes via pg_cron. If you need an immediate refresh:

```sql
refresh materialized view concurrently public.school_kpis_v;
refresh materialized view concurrently public.school_impact_v;
```

### Monitoring nightly digest

Check the dispatch log each morning:

```sql
SELECT
  dispatch_date,
  count(*) total,
  count(*) filter (where status = 'sent') sent,
  count(*) filter (where status = 'failed') failed,
  count(*) filter (where delivery_confirmed_at is not null) delivered
FROM public.nightly_dispatch_log
WHERE dispatch_date >= current_date - 7
GROUP BY dispatch_date
ORDER BY dispatch_date DESC;
```

---

## 7. Deploying changes

For routine code changes:

```bash
git push origin main
```

Vercel auto-deploys on push to `main`. Build takes ~60 seconds.

For database schema changes:
```bash
# Write the migration SQL in supabase/migrations/NNNN_description.sql
supabase db push --project-ref YOUR_PROJECT_REF
```

For edge function changes:
```bash
supabase functions deploy FUNCTION_NAME --project-ref YOUR_PROJECT_REF
# e.g.:
supabase functions deploy nightly-digest --project-ref YOUR_PROJECT_REF
```

---

## 8. Rollback

### Frontend rollback
Vercel → Deployments → find the previous deployment → ⋯ → Promote to Production.

### Database rollback
Migrations are not automatically reversible. For schema changes, write a new
migration that undoes the previous one. For data changes, restore from a
Supabase point-in-time backup (Pro plan only).

### Edge function rollback
Supabase does not maintain function version history. Keep the previous function
source in git and redeploy the old version from there:

```bash
git checkout <previous-sha> -- supabase/functions/FUNCTION_NAME/
supabase functions deploy FUNCTION_NAME --project-ref YOUR_PROJECT_REF
git checkout HEAD -- supabase/functions/FUNCTION_NAME/
```

---

## 9. Environment variable reference

| Variable | Where set | Who reads it | Required |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel | Frontend (supabase.js) | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Vercel | Frontend | ✅ |
| `VITE_PAYSTACK_PUBLIC_KEY` | Vercel | Frontend (payment flow) | ✅ |
| `VITE_SITE_URL` | Vercel | Frontend (OG tags) | ✅ |
| `VITE_APP_URL` | Vercel | Frontend (deep links) | ✅ |
| `VITE_FX_NGN_PER_USD` | Vercel | Frontend (pricing display) | ✅ |
| `VITE_FX_BENCHMARK_DATE` | Vercel | Frontend (pricing display) | ✅ |
| `SUPABASE_URL` | Auto-injected | Edge functions | ✅ |
| `SUPABASE_ANON_KEY` | Auto-injected | Edge functions | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Edge functions | ✅ |
| `SUPABASE_JWT_SECRET` | Auto-injected | student-pin-login | ✅ |
| `PAYSTACK_SECRET_KEY` | Supabase Secrets | verify-payment, initialise-payment | ✅ |
| `PAYSTACK_WEBHOOK_SECRET` | Supabase Secrets | verify-payment | ✅ |
| `META_WABA_PHONE_NUMBER_ID` | Supabase Secrets | send-whatsapp | For WhatsApp |
| `META_WHATSAPP_TOKEN` | Supabase Secrets | send-whatsapp | For WhatsApp |
| `META_APP_SECRET` | Supabase Secrets | whatsapp-webhook | For WhatsApp |
| `META_WEBHOOK_VERIFY_TOKEN` | Supabase Secrets | whatsapp-webhook | For WhatsApp |
| `TERMII_API_KEY` | Supabase Secrets | send-whatsapp | Optional (SMS fallback) |
| `APP_BASE_URL` | Supabase Secrets | nightly-digest | For WhatsApp |
| `SITE_URL` | Supabase Secrets | various | For WhatsApp |
| `app.supabase_url` | Postgres config | pg_cron → nightly-digest | For WhatsApp |
| `app.service_role_key` | Postgres config | pg_cron → nightly-digest | For WhatsApp |

---

*Built by African educators for African learners. Lagos, Nigeria.*
