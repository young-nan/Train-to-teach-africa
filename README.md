# Train To Teach Africa — Production Codebase (v2)

The operating system for African education.

> This repository contains the production scaffold for TTA v2 — public
> marketing site, role-adaptive learning platform, school information
> management system, and subscription / payment infrastructure.

---

## What's in this repo

```
├── src/
│   ├── components/    UI primitives + marketing + layouts
│   ├── modules/       Authenticated dashboards (admin, sims, parent, student, billing)
│   ├── pages/         Public + auth pages
│   ├── hooks/         useAuth, useLessonView, useImpactMetrics
│   ├── services/      The ONLY layer that talks to Supabase
│   ├── stores/        Zustand stores
│   ├── lib/           Supabase client, schemas, offline queue
│   ├── routes/        Router + role guards
│   ├── config/        pricing.js, roles.js — single sources of truth
│   └── styles.css     Tailwind base + globals
├── supabase/
│   ├── migrations/    SQL migrations (run in order)
│   └── functions/     Edge Functions (Deno) — payment verification
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── ENVIRONMENT.md
│   └── PAYSTACK_WEBHOOK_SETUP.md
└── ops/               CI scripts (pricing sync check)
```

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in Supabase URL + anon key + Paystack public key

# 3. Run migrations against your Supabase project
supabase db push

# 4. Deploy the edge function
supabase functions deploy verify-payment

# 5. Start dev
npm run dev
```

---

## Architectural rules (these are not suggestions)

1. **No component imports Supabase directly.** Lint enforces this. Services
   (`src/services/*`) are the only modules that touch the client. If you
   need a new query, add it to a service.

2. **No hardcoded prices.** Every price comes from `src/config/pricing.js`.
   This file is the single source of truth and is checked at build time
   against the edge function's duplicated copy via `ops/check-pricing-sync.mjs`.

3. **No untyped lesson transformations.** Lessons go through `LessonSchema`
   (Zod) before `useLessonView` ever sees them. Bad lesson JSON crashes the
   loader, never the student.

4. **No duplicate role logic.** Role-adaptive content goes through one
   place — `useLessonView`. Role gating in routes goes through one place —
   `<RequireRole>`. RLS in Postgres is the security boundary; the UI
   guards are convenience.

5. **Money is never floats.** All currency is stored in *minor units*
   (kobo / cents) as integers. JavaScript loses precision past ~15 digits
   and would silently misbill at scale.

6. **Every write is offline-safe.** Attendance, scores, and assessment
   attempts go through `src/lib/offline/queue.js`. Idempotency keys
   prevent double-writes when the queue replays.

---

## Key files to read first (in order)

1. `src/config/pricing.js` — the money
2. `src/config/roles.js` — the people
3. `src/hooks/useLessonView.js` — the platform's signature feature
4. `src/services/authService.js` — how auth is gated
5. `supabase/functions/verify-payment/index.ts` — how money becomes access
6. `supabase/migrations/0001_core_schema.sql` — the security spine

---

## Testing

```bash
npm test           # run unit tests once
npm run test:watch # watch mode
```

The most important test is `src/hooks/useLessonView.test.js` — it proves
the student view never contains assessment answers. If that regresses,
every student in the system can read off correct answers from network
responses.

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## License

Proprietary. © Train To Teach Africa.
