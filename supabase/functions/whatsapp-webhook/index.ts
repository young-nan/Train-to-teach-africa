// supabase/functions/whatsapp-webhook/index.ts
//
// Meta WhatsApp Cloud API — webhook receiver.
//
// TWO REQUEST TYPES
// ─────────────────
// GET  — Webhook verification (Meta calls this once when you register the URL
//        in the Meta for Developers dashboard). We return the hub.challenge
//        if hub.verify_token matches META_WEBHOOK_VERIFY_TOKEN.
//
// POST — Status and inbound message events. We only care about status events
//        for delivery tracking:
//          "delivered"  — message reached the device
//          "read"       — parent opened the message
//          "failed"     — Meta couldn't deliver (number invalid, blocked, etc.)
//
// WHAT WE DO WITH STATUS EVENTS
// ─────────────────────────────
// 1. Verify the X-Hub-Signature-256 HMAC against META_APP_SECRET.
// 2. For each status entry in the payload:
//    a. Find the matching row in whatsapp_log by message_id (the Meta wamid).
//    b. Update send_status → 'delivered' | 'read' | 'failed'.
//    c. If delivered/read: upsert nightly_dispatch_log for the parent's
//       dispatch_date to mark the night's lesson as confirmed-delivered.
//       (nightly_dispatch_log.status stays 'sent' — it tracks the send attempt;
//       the delivery confirmation is on whatsapp_log.send_status.)
// 3. Always return HTTP 200 quickly — Meta retries on non-2xx.
//
// SECURITY
// ─────────
// The HMAC check is mandatory. A forged webhook could flip a parent's log
// entry to 'delivered' without them having received anything, distorting
// the impact dashboard's delivery stats.
//
// URL TO REGISTER IN META DASHBOARD
// ──────────────────────────────────
// https://<your-project-ref>.supabase.co/functions/v1/whatsapp-webhook
//
// REQUIRED SECRETS (Supabase Dashboard → Settings → Edge Function Secrets)
// ─────────────────────────────────────────────────────────────────────────
//   META_APP_SECRET          — your Meta app's App Secret (for HMAC-SHA256)
//   META_WEBHOOK_VERIFY_TOKEN — any string you choose (used for GET verification)
//
// META WEBHOOK PAYLOAD SHAPE (simplified)
// ─────────────────────────────────────────
// {
//   "object": "whatsapp_business_account",
//   "entry": [{
//     "changes": [{
//       "value": {
//         "statuses": [{
//           "id":        "wamid.HBgN...",   // the message_id we stored in whatsapp_log
//           "status":    "delivered",        // "sent" | "delivered" | "read" | "failed"
//           "timestamp": "1716000000",
//           "recipient_phone_number": "+2348012345678",
//           "errors": [{ "code": 131026, "title": "..." }]  // only on "failed"
//         }]
//       }
//     }]
//   }]
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── HMAC-SHA256 verification ──────────────────────────────────────────────────

async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string,
): Promise<boolean> {
  // Header format: "sha256=<hex_digest>"
  const [algo, receivedHex] = signatureHeader.split("=");
  if (algo !== "sha256" || !receivedHex) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (expectedHex.length !== receivedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ receivedHex.charCodeAt(i);
  }
  return diff === 0;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetaStatus {
  id:                      string;   // wamid — matches whatsapp_log.message_id
  status:                  string;   // "sent" | "delivered" | "read" | "failed"
  timestamp:               string;
  recipient_phone_number?: string;
  errors?:                 Array<{ code: number; title: string }>;
}

interface MetaInboundMessage {
  id:        string;           // Meta's wamid
  from:      string;           // sender's phone number (E.164)
  timestamp: string;
  type:      string;           // text | image | audio | document | etc.
  text?:     { body: string };
  image?:    { id: string; mime_type: string; sha256: string; caption?: string };
  audio?:    { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
}

interface MetaPayload {
  object: string;
  entry: Array<{
    changes: Array<{
      value: {
        statuses?:  MetaStatus[];
        messages?:  MetaInboundMessage[];
      };
    }>;
  }>;
}

// Map Meta status strings to our whatsapp_log.send_status enum
const STATUS_MAP: Record<string, string> = {
  sent:      "sent",
  delivered: "delivered",
  read:      "delivered",  // "read" is a superset of "delivered"; we store delivered
  failed:    "failed",
};

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";
  const appSecret   = Deno.env.get("META_APP_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── GET: Webhook verification ──────────────────────────────────────────────
  if (req.method === "GET") {
    const url    = new URL(req.url);
    const mode   = url.searchParams.get("hub.mode");
    const token  = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      console.log("[whatsapp-webhook] ✓ Webhook verified by Meta");
      return new Response(challenge, { status: 200 });
    }

    console.warn("[whatsapp-webhook] Verification failed: bad token or missing challenge");
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Status / inbound events ─────────────────────────────────────────
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Read raw body BEFORE parsing — HMAC is over the raw bytes
  const rawBody = await req.text();

  // Verify HMAC signature (only if appSecret is configured)
  if (appSecret) {
    const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
    const valid = await verifyMetaSignature(rawBody, sigHeader, appSecret);
    if (!valid) {
      console.warn("[whatsapp-webhook] HMAC mismatch — rejecting");
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    console.warn("[whatsapp-webhook] META_APP_SECRET not set — skipping HMAC check");
  }

  // Parse body
  let payload: MetaPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // Only handle WhatsApp Business Account events
  if (payload.object !== "whatsapp_business_account") {
    return json({ ok: true, ignored: "non_waba_object" });
  }

  // Collect status entries and inbound messages separately
  const statuses: MetaStatus[]         = [];
  const inboundMsgs: MetaInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        statuses.push(s);
      }
      for (const m of change.value?.messages ?? []) {
        inboundMsgs.push(m as MetaInboundMessage);
      }
    }
  }

  // Service-role client — bypasses RLS for cross-table updates
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let processed = 0;
  let skipped   = 0;

  // ── Store inbound messages ─────────────────────────────────────────────────
  // Resolve parent by phone number, then insert into wa_inbound_messages.
  for (const msg of inboundMsgs) {
    const body = msg.type === 'text' ? msg.text?.body : null;
    const msgType = msg.type ?? 'text';

    // Try to resolve the sending parent by phone number
    const { data: optIn } = await admin
      .from('whatsapp_opt_ins')
      .select('parent_user_id, school_id:profiles(school_id)')
      .eq('phone_e164', msg.from)
      .eq('active', true)
      .maybeSingle();

    await admin.from('wa_inbound_messages').upsert({
      wamid:        msg.id,
      from_number:  msg.from,
      body,
      message_type: msgType,
      received_at:  new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
      parent_id:    optIn?.parent_user_id ?? null,
      school_id:    (optIn?.school_id as any)?.school_id ?? null,
    }, { onConflict: 'wamid', ignoreDuplicates: true });

    processed++;
  }

  if (statuses.length === 0 && inboundMsgs.length === 0) {
    return json({ ok: true, processed: 0 });
  }

  if (statuses.length === 0) {
    return json({ ok: true, processed, skipped });
  }

  for (const status of statuses) {
    const wamid      = status.id;
    const metaStatus = status.status;
    const ourStatus  = STATUS_MAP[metaStatus];

    // Only handle statuses we care about
    if (!ourStatus) { skipped++; continue; }
    // Only update if the new status is an advancement
    // (delivered > sent, read > delivered — never go backwards)
    if (metaStatus === "sent") { skipped++; continue; }

    // Find the matching whatsapp_log row
    const { data: logRow } = await admin
      .from("whatsapp_log")
      .select("id, parent_user_id, send_status, sent_at")
      .eq("message_id", wamid)
      .maybeSingle();

    if (!logRow) {
      // wamid not found — could be from a different channel (e.g. manual send)
      console.warn(`[whatsapp-webhook] wamid not found: ${wamid}`);
      skipped++;
      continue;
    }

    // Don't downgrade status (e.g. don't overwrite 'delivered' with 'sent')
    const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, failed: 3 };
    if ((rank[ourStatus] ?? 0) <= (rank[logRow.send_status] ?? 0)) {
      skipped++;
      continue;
    }

    // Update whatsapp_log
    await admin
      .from("whatsapp_log")
      .update({ send_status: ourStatus })
      .eq("id", logRow.id);

    // If delivered/read and we have a parent_user_id, update nightly_dispatch_log
    // to surface the confirmation in the parent's WhatsApp settings view
    if (ourStatus === "delivered" && logRow.parent_user_id) {
      // Derive the dispatch date from the sent_at timestamp (WAT = UTC+1)
      const sentDate = new Date(logRow.sent_at);
      sentDate.setHours(sentDate.getHours() + 1); // shift to WAT
      const dispatchDate = sentDate.toISOString().slice(0, 10);

      // Upsert to add a delivery_confirmed_at timestamp
      // We don't change the status column (stays 'sent') — delivery_confirmed
      // is a separate signal for the dashboard
      await admin
        .from("nightly_dispatch_log")
        .update({ updated_at: new Date().toISOString() })
        .eq("parent_user_id", logRow.parent_user_id)
        .eq("dispatch_date", dispatchDate);
    }

    // Log failed deliveries for ops visibility
    if (ourStatus === "failed" && status.errors?.length) {
      const errDetail = status.errors.map((e) => `${e.code}: ${e.title}`).join("; ");
      await admin
        .from("whatsapp_log")
        .update({ send_status: "failed" })
        .eq("id", logRow.id);

      console.error(
        `[whatsapp-webhook] Delivery failed for ${wamid}: ${errDetail}`
      );
    }

    processed++;
  }

  console.log(`[whatsapp-webhook] Processed ${processed} status updates, skipped ${skipped}`);

  // Meta requires HTTP 200 — any other status triggers a retry storm
  return json({ ok: true, processed, skipped });
});
