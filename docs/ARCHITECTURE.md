# Architecture

This document explains the *why* behind the structure. The README explains
the *what*. If you're touching this codebase, read this once.

---

## The five layers

```
┌─────────────────────────────────────────────┐
│  Pages / Modules        (route-level views) │  ← src/pages, src/modules
├─────────────────────────────────────────────┤
│  Components             (UI primitives)     │  ← src/components
├─────────────────────────────────────────────┤
│  Hooks + Stores         (state + logic)     │  ← src/hooks, src/stores
├─────────────────────────────────────────────┤
│  Services               (Supabase IO)       │  ← src/services
├─────────────────────────────────────────────┤
│  Lib                    (client, schemas,   │  ← src/lib
│                          offline queue)     │
└─────────────────────────────────────────────┘
```

Imports flow downward. A page can import a service. A service cannot
import a page. The lint config doesn't enforce this at every layer (would
be too rigid), but it enforces the most important boundary:
**components and pages cannot import the Supabase client.**

---

## Why service layer

Three reasons:

1. **Migration risk.** If we ever swap Supabase for our own auth or DB,
   the blast radius is `src/services/` and `src/lib/supabase.js`. Nothing
   else.

2. **Testability.** Tests stub services. Tests never need a Supabase mock.

3. **Audit clarity.** Every login, every payment, every register has a
   clearly-named function we own. Searching for "where do we mark
   attendance" returns one result.

---

## The role-adaptive lesson engine

The single most important piece of platform logic.

```
        ┌─────────────────┐
        │  Canonical      │   stored in lessons.content (JSONB)
        │  Lesson         │   validated by LessonSchema
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ useLessonView   │   src/hooks/useLessonView.js
        │  (role)         │
        └────────┬────────┘
                 │
   ┌─────────┬───┴────┬──────────┐
   ▼         ▼        ▼          ▼
┌──────┐ ┌──────┐ ┌──────┐  ┌──────┐
│Stud. │ │Teach.│ │Parent│  │Admin │
└──────┘ └──────┘ └──────┘  └──────┘
```

Each role gets a different projection of the same lesson. The student
never sees the answer key. The parent never sees the assessment.
The teacher gets the full instructional layer including misconceptions
and pacing. The admin gets analytics hooks.

**The rule:** this is the only place lesson logic branches by role. If
you find yourself writing `if (role === ...)` in a component, you're in
the wrong file.

---

## Auth + RLS — defence in depth

```
Browser  ───► useAuth  ───► authService  ───► Supabase Auth
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ Postgres RLS │ ← the real security boundary
                                            └──────────────┘
```

- `useAuth` gates UI surfaces (e.g. "show admin nav if role = school_admin").
- `<RequireRole>` gates route loads.
- **RLS gates data.** A clever user can poke the DOM. They cannot read
  another role's rows because RLS denies it server-side.

If you ever feel tempted to add auth logic in a component, stop. The
right place is RLS (for security) + `useAuth` (for UX). Never in
between.

---

## Payments — never trust the redirect

The most security-critical flow.

```
1. Client    →  initialise-payment edge fn  →  Paystack reference
2. Client    →  Paystack hosted checkout
3. Paystack  →  /billing/return?reference=...
4. Paystack  →  webhook → verify-payment edge fn   ← signature checked
5. Edge fn   →  validate plan + amount             ← tamper guard
6. Edge fn   →  activate_subscription RPC          ← idempotent
7. Client    →  poll payments.status until 'verified'
```

**The client is never authoritative.** A malicious user closing the
checkout tab cannot avoid being charged; a malicious user paying the
*term* amount with the *annual* plan code in metadata cannot get an
annual subscription — the edge function checks `amountFromPaystack ===
plan.amountMinor` AND `currencyFromPaystack === plan.currency` before
activating.

---

## Offline — every write goes through the queue

```
Component  ──►  service.markAttendance()  ──►  queue.enqueue()
                                                 │
                                                 ▼
                                          (IndexedDB)
                                                 │
                                                 ▼
                       online ──►  sync.runSync()  ──►  Supabase
```

Three states the user ever sees:

- **Synced** — queue empty, online
- **Saving · n records** — queue non-empty, online (drainer is working)
- **Offline · changes safe** — `navigator.onLine === false`

We deliberately do not surface HTTP statuses or retry counts. Schools
can't debug HTTP. They need confidence, not data.

---

## Performance budget

- Initial JS payload: **≤ 180 KB gzipped**
- First contentful paint on Tecno Spark + 3G: **≤ 1.8s**
- Lighthouse Performance / A11y / Best Practices / SEO: **≥ 95**

These are hard budgets enforced by Vite's `chunkSizeWarningLimit` and
verified in CI.

---

## Module boundaries

Each `src/modules/<name>` is its own chunk (see `vite.config.js`
`manualChunks`). The teacher dashboard never loads admin code. The
parent dashboard never loads teacher code. This matters because most of
our users are on capped data plans.
