// supabase/functions/send-whatsapp/index.ts
//
// Sends a WhatsApp message via the Meta Cloud API (primary) with Termii SMS
// as a hard fallback for parents on feature phones or without WhatsApp.
//
// CALLER CONTRACT
// ───────────────
// This function is called server-side only — from other Edge Functions or
// pg_cron-triggered jobs, never directly from the browser. Callers must
// authenticate with the service role key.
//
// REQUEST BODY
// ────────────
// {
//   to:         string,  // E.164 phone number, e.g. "+2348012345678"
//   type:       "template" | "text",
//
//   // For type = "template":
//   template_name: string,        // Pre-approved Meta template name
//   template_lang: string,        // e.g. "en_US"
//   template_params: string[],    // Positional {{1}} {{2}} substitutions
//
//   // For type = "text" (session messages, within 24-hr window only):
//   text: string,                 // Max 1024 chars (enforced here, not by caller)
//
//   // Optional context
//   parent_user_id?: string,      // For audit logging
//   lesson_slug?:    string,      // For audit logging
// }
//
// RESPONSE
// ────────
// { ok: true,  channel: "whatsapp" | "sms", message_id: string }
// { ok: false, error: string }
//
// FALLBACK LOGIC
// ──────────────
// 1. Try Meta WhatsApp Cloud API.
// 2. If Meta returns a non-2xx or network error → fall through to Termii SMS.
// 3. If Termii also fails → return ok:false with both error messages.
// 4. All attempts (success and failure) are written to the whatsapp_log table.
//
// RATE LIMITING
// ─────────────
// Meta enforces per-WABA limits. We don't implement our own rate limiter here
// because this function is called from scheduled jobs that already pace
// delivery (one batch per school, spread over 30 minutes in the evening).
// If Meta rejects with code 130429 (rate limit), we retry once after 5 s.

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

// ── Types ─────────────────────────────────────────────────────────────────

interface SendRequest {
  to: string;
  type: "template" | "text";
  // template fields
  template_name?: string;
  template_lang?: string;
  template_params?: string[];
  // text fields
  text?: string;
  // optional context
  parent_user_id?: string;
  lesson_slug?: string;
}

interface SendResult {
  ok: boolean;
  channel?: "whatsapp" | "sms";
  message_id?: string;
  error?: string;
}

// ── Meta WhatsApp Cloud API ───────────────────────────────────────────────

async function sendViaWhatsApp(
  payload: SendRequest,
  wabaId: string,
  token: string,
): Promise<{ ok: boolean; message_id?: string; error?: string; rateLimited?: boolean }> {
  const url = `https://graph.facebook.com/v19.0/${wabaId}/messages`;

  let message: Record<string, unknown>;

  if (payload.type === "template") {
    if (!payload.template_name) {
      return { ok: false, error: "template_name required for type=template" };
    }
    message = {
      messaging_product: "whatsapp",
      to: payload.to,
      type: "template",
      template: {
        name: payload.template_name,
        language: { code: payload.template_lang ?? "en_US" },
        components: payload.template_params?.length
          ? [{
              type: "body",
              parameters: payload.template_params.map((p) => ({
                type: "text",
                text: String(p).substring(0, 1024),
              })),
            }]
          : [],
      },
    };
  } else {
    if (!payload.text) return { ok: false, error: "text required for type=text" };
    message = {
      messaging_product: "whatsapp",
      to: payload.to,
      type: "text",
      text: { body: payload.text.substring(0, 1024) },
    };
  }

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const body = await res.json() as {
      messages?: Array<{ id: string }>;
      error?: { code: number; message: string };
    };

    if (res.ok && body.messages?.[0]?.id) {
      return { ok: true, message_id: body.messages[0].id };
    }

    // Rate limit — back off 5 s and retry once.
    if (body.error?.code === 130429 && attempt === 1) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    return {
      ok: false,
      rateLimited: body.error?.code === 130429,
      error: body.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return { ok: false, error: "WhatsApp send failed after retry" };
}

// ── Termii SMS fallback ───────────────────────────────────────────────────

async function sendViaSMS(
  to: string,
  text: string,
  termiiKey: string,
): Promise<{ ok: boolean; message_id?: string; error?: string }> {
  // Termii expects 11-digit sender ID or approved alpha sender.
  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      from: "TTA",          // Pre-registered Termii sender ID
      sms: text.substring(0, 160),  // Standard SMS segment limit
      type: "plain",
      api_key: termiiKey,
      channel: "generic",
    }),
  });

  const body = await res.json() as { message_id?: string; message?: string; code?: string };

  if (res.ok && body.message_id) {
    return { ok: true, message_id: body.message_id };
  }
  return { ok: false, error: body.message ?? `HTTP ${res.status}` };
}

// ── Audit log write ───────────────────────────────────────────────────────

async function writeLog(
  supabaseUrl: string,
  serviceKey: string,
  row: {
    to: string;
    channel: string;
    status: string;       // maps to send_status column
    message_id?: string;
    error?: string;       // maps to error_detail column
    parent_user_id?: string;
    lesson_slug?: string;
    payload_type: string;
  },
) {
  // Fire-and-forget. Failures here must not bubble up to the caller.
  try {
    await fetch(`${supabaseUrl}/rest/v1/whatsapp_log`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        to:             row.to,
        channel:        row.channel,
        send_status:    row.status,
        message_id:     row.message_id,
        error_detail:   row.error,
        parent_user_id: row.parent_user_id,
        lesson_slug:    row.lesson_slug,
        payload_type:   row.payload_type,
      }),
    });
  } catch {
    // Intentionally swallowed.
  }
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // This function is service-role-only. Verify the caller has the service key.
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authHeader.includes(serviceKey)) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  let payload: SendRequest;
  try { payload = await req.json(); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  if (!payload.to) return json({ ok: false, error: "to is required" }, 400);
  if (!payload.type) return json({ ok: false, error: "type is required" }, 400);

  const wabaId    = Deno.env.get("META_WABA_PHONE_NUMBER_ID");
  const metaToken = Deno.env.get("META_WHATSAPP_TOKEN");
  const termiiKey = Deno.env.get("TERMII_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Derive SMS text for the fallback. For templates, use params joined;
  // for text messages, use the text directly.
  const smsText = payload.type === "text"
    ? (payload.text ?? "")
    : (payload.template_params ?? []).join(" · ");

  let result: SendResult = { ok: false, error: "No send channel configured" };

  // ── Primary: Meta WhatsApp ───────────────────────────────────────────────
  if (wabaId && metaToken) {
    const waResult = await sendViaWhatsApp(payload, wabaId, metaToken);
    if (waResult.ok) {
      result = { ok: true, channel: "whatsapp", message_id: waResult.message_id };
      await writeLog(supabaseUrl, serviceKey, {
        to: payload.to,
        channel: "whatsapp",
        status: "sent",
        message_id: waResult.message_id,
        parent_user_id: payload.parent_user_id,
        lesson_slug: payload.lesson_slug,
        payload_type: payload.type,
      });
      return json(result);
    }
    // WhatsApp failed — log it and fall through to SMS.
    await writeLog(supabaseUrl, serviceKey, {
      to: payload.to,
      channel: "whatsapp",
      status: "failed",
      error: waResult.error,
      parent_user_id: payload.parent_user_id,
      lesson_slug: payload.lesson_slug,
      payload_type: payload.type,
    });
  }

  // ── Fallback: Termii SMS ──────────────────────────────────────────────────
  if (termiiKey && smsText) {
    const smsResult = await sendViaSMS(payload.to, smsText, termiiKey);
    if (smsResult.ok) {
      result = { ok: true, channel: "sms", message_id: smsResult.message_id };
      await writeLog(supabaseUrl, serviceKey, {
        to: payload.to,
        channel: "sms",
        status: "sent",
        message_id: smsResult.message_id,
        parent_user_id: payload.parent_user_id,
        lesson_slug: payload.lesson_slug,
        payload_type: payload.type,
      });
      return json(result);
    }
    await writeLog(supabaseUrl, serviceKey, {
      to: payload.to,
      channel: "sms",
      status: "failed",
      error: smsResult.error,
      parent_user_id: payload.parent_user_id,
      lesson_slug: payload.lesson_slug,
      payload_type: payload.type,
    });
    result = { ok: false, error: `WhatsApp and SMS both failed: ${smsResult.error}` };
  }

  return json(result, result.ok ? 200 : 502);
});
