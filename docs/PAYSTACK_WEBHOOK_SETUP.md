# Paystack Webhook Setup

The most security-critical operational task. Get this wrong and you have
silent fraud or silent failures. Take fifteen minutes to do it right.

---

## 1. Generate the webhook secret

Paystack does NOT give you a webhook secret — you set one yourself.
Treat it like a password.

```bash
# Generate a strong random secret
openssl rand -hex 32
# → 64-char hex string
```

Store it in two places (and only two):

- **Supabase secrets:** `supabase secrets set PAYSTACK_WEBHOOK_SECRET=<hex>`
- **Paystack dashboard:** Settings → API Keys & Webhooks → Webhook Secret

These two values must be **byte-identical**. The edge function fails
authentication on any mismatch.

---

## 2. Configure the webhook URL

In Paystack dashboard → Settings → API Keys & Webhooks:

- **Webhook URL:** `https://<your-supabase-ref>.supabase.co/functions/v1/verify-payment`
- **Events:** subscribe to `charge.success` (we ignore other events but it's fine to receive them).

---

## 3. Test it

Paystack provides a "Test Webhook" button. Click it. You should see in
Supabase logs:

```
[verify-payment] received charge.success ref=test_xxx
[verify-payment] signature ok
[verify-payment] amount_or_currency_mismatch ref=test_xxx  ← test events use ₦100
```

The mismatch log on a test event is **expected** — the test event has a
₦100 amount which doesn't match any real plan. The point is: you saw
the signature pass and the validation logic engage.

---

## 4. Verify a real payment end-to-end

In test mode (Paystack `pk_test_xxx` + `sk_test_xxx`):

1. Sign up a test parent account.
2. Subscribe to `INT_PARENT_TERM` ($12) using a Paystack test card:
   - Card: `4084 0840 8408 4081`
   - CVV: any 3 digits
   - Expiry: any future date
3. Complete checkout.
4. Watch logs:
   - Webhook arrives with `charge.success`
   - Signature verifies
   - Plan validates
   - Amount + currency match (1200 minor = $12, USD)
   - `activate_subscription` RPC runs
   - `payments.status` flips to `verified`
5. The `/billing/return` page polls and routes the user into the parent
   app.

If any step fails, the audit log will say why.

---

## Threat model — what we defend against

The webhook handler defends against:

| Threat | Defense |
|---|---|
| Anyone POSTing a "successful payment" | HMAC-SHA512 signature with shared secret |
| Tampering with the amount in metadata | We compare against canonical `PLANS[code].amountMinor` |
| Wrong currency (paying USD price for NGN plan) | We compare `currencyFromPaystack === plan.currency` |
| Replay attacks (same event fired twice) | Idempotent upsert on `payments.reference` |
| Unknown plan code | Logged + rejected with `unknown_plan_code` audit |

Everything goes into `audit_log`. Suspicious attempts (signature
mismatch, amount mismatch, unknown plan) are kept indefinitely. They are
your fraud forensics.

---

## What this handler does NOT do

- It does not retry on its own — Paystack retries automatically.
- It does not email anyone — that's a separate function.
- It does not refund — refunds are manual, in Paystack dashboard.
- It does not handle subscription cancellation — that's a separate
  endpoint Paystack calls (`subscription.disable` event), not yet
  implemented in this scaffold.
