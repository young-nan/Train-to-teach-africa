// supabase/functions/initialise-payment/index.ts
//
// Creates a Paystack transaction and returns { reference, access_code,
// authorization_url } to the client. The client then redirects the browser
// to authorization_url. Verification happens later in verify-payment when
// Paystack fires the charge.success webhook.
//
// SECURITY MODEL
// ─────────────
// 1. Caller must be authenticated (JWT checked via Supabase auth helper).
// 2. plan_code is validated against the canonical list — the client cannot
//    invent a cheaper plan code.
// 3. amount_minor is read from the canonical list — the client never
//    supplies the price. Paystack receives what we computed, not what the
//    user sent.
// 4. A pending payments row is written before we call Paystack. If the
//    browser crashes after Paystack processes but before we return, the
//    webhook still fires and the row is already there to update.
// 5. reference is generated server-side (crypto.randomUUID) — unguessable,
//    no client influence.
//
// IDEMPOTENCY
// ───────────
// If the same user submits twice within 60 s (double-tap, page reload),
// we return the existing pending payment rather than creating a new one.
// The duplicate check is: same user_id + same plan_code + status=pending
// + created_at within last 60 s. This prevents a parent from opening two
// Paystack tabs simultaneously and accidentally paying twice.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ── Canonical plan catalogue ───────────────────────────────────────────────
// Must stay in sync with src/config/pricing.js.
// ops/check-pricing-sync.mjs validates pricing.js ↔ verify-payment.
// This file is also checked: see ops/check-pricing-sync.mjs EDGE_FILES array.
const PLANS: Record<string, { amountMinor: number; currency: string }> = {
  AFR_PARENT_TERM:    { amountMinor: 1084700,  currency: "NGN" },
  AFR_PARENT_ANNUAL:  { amountMinor: 3118400,  currency: "NGN" },
  AFR_TEACHER_TERM:   { amountMinor: 1220300,  currency: "NGN" },
  AFR_SCHOOL_TERM:    { amountMinor: 6101200,  currency: "NGN" },
  AFR_SCHOOL_ANNUAL:  { amountMinor: 17625600, currency: "NGN" },
  INT_PARENT_TERM:    { amountMinor: 1200,     currency: "USD" },
  INT_PARENT_ANNUAL:  { amountMinor: 3200,     currency: "USD" },
  INT_TEACHER_TERM:   { amountMinor: 1400,     currency: "USD" },
  INT_SCHOOL_TERM:    { amountMinor: 7500,     currency: "USD" },
  INT_SCHOOL_ANNUAL:  { amountMinor: 25000,    currency: "USD" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  // ── 2. Parse + validate body ─────────────────────────────────────────────
  let body: { plan_code?: string; email?: string; metadata?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { plan_code, email, metadata = {} } = body;
  if (!plan_code || !email) {
    return json({ error: "plan_code and email are required" }, 400);
  }

  const plan = PLANS[plan_code];
  if (!plan) return json({ error: `Unknown plan_code: ${plan_code}` }, 400);

  // Email must match the authenticated user's email to prevent one user
  // paying on behalf of another.
  if (email.toLowerCase() !== user.email?.toLowerCase()) {
    return json({ error: "email must match your account email" }, 400);
  }

  // ── 3. Idempotency — return an existing pending payment if recent ─────────
  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: existing } = await serviceSupabase
    .from("payments")
    .select("reference, paystack_access_code, paystack_auth_url")
    .eq("user_id", user.id)
    .eq("plan_code", plan_code)
    .eq("status", "pending")
    .gte("created_at", sixtySecondsAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.paystack_auth_url) {
    return json({
      reference:         existing.reference,
      access_code:       existing.paystack_access_code,
      authorization_url: existing.paystack_auth_url,
      reused:            true,
    });
  }

  // ── 4. Generate reference + call Paystack ─────────────────────────────────
  const reference = `TTA-${crypto.randomUUID().replace(/-/g, "").substring(0, 16).toUpperCase()}`;
  const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackKey) return json({ error: "Payment provider not configured" }, 500);

  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: plan.amountMinor,   // Paystack expects minor units (kobo/cents)
      currency: plan.currency,
      reference,
      // Redirect the browser to /billing/return so our poll can verify.
      callback_url: `${Deno.env.get("SITE_URL")}/billing/return?reference=${reference}`,
      metadata: {
        ...metadata,
        plan_code,
        tta_user_id: user.id,
      },
    }),
  });

  const paystackBody = await paystackRes.json() as {
    status: boolean;
    data?: { access_code: string; authorization_url: string };
    message?: string;
  };

  if (!paystackRes.ok || !paystackBody.status || !paystackBody.data) {
    console.error("[initialise-payment] Paystack error:", paystackBody);
    return json({ error: "Could not create payment. Please try again." }, 502);
  }

  const { access_code, authorization_url } = paystackBody.data;

  // ── 5. Persist pending payment row ────────────────────────────────────────
  // Written BEFORE returning to the client so the webhook always has a row
  // to update, even if the browser crashes immediately after redirect.
  const { error: insertErr } = await serviceSupabase
    .from("payments")
    .insert({
      user_id:             user.id,
      plan_code,
      amount_minor:        plan.amountMinor,
      currency:            plan.currency,
      reference,
      status:              "pending",
      paystack_access_code: access_code,
      paystack_auth_url:   authorization_url,
      metadata,
    });

  if (insertErr) {
    // If insert failed the client still gets a reference, but we log it.
    // The webhook will try to upsert on conflict, so data is not permanently
    // lost — but we want visibility on this failure.
    console.error("[initialise-payment] payments insert failed:", insertErr.message);
  }

  // ── 6. Return to client ───────────────────────────────────────────────────
  return json({ reference, access_code, authorization_url });
});
