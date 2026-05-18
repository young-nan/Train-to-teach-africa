// supabase/functions/nightly-digest/index.ts
//
// Nightly lesson digest for opted-in parents.
// Triggered by pg_cron at 18:00 UTC (19:00 WAT) every day.
//
// WHAT IT DOES
// ────────────
// 1. Calls get_nightly_dispatch_batch() RPC — returns every parent who:
//    a. Has an active TTA subscription
//    b. Has opted in to WhatsApp/SMS delivery
//    c. Has not already received a message today
//    d. Has a linked pupil with a lesson for the current week of term
//
// 2. For each parent, builds the nightly_lesson_v1 template variables
//    using the lesson content from the DB row (kitchen activity + first
//    dinner question). Constructs the deep link to the lesson in the app.
//
// 3. Calls the send-whatsapp edge function for each parent (not a direct
//    Meta API call — we delegate to keep the auth/retry/fallback logic in
//    one place).
//
// 4. Records the dispatch result in nightly_dispatch_log via the
//    record_dispatch() RPC.
//
// CONCURRENCY
// ───────────
// We process parents sequentially with a 200 ms gap between sends.
// This paces the delivery and avoids hitting Meta's per-WABA rate limit
// (1,000 template messages per second is the practical ceiling; our batch
// is much smaller, but the gap prevents burst spikes on school term starts).
//
// CALLER SECURITY
// ───────────────
// This function only accepts calls with the service role key in the
// Authorization header — the pg_cron job provides it.
// Browser clients cannot call this function.
//
// ERROR HANDLING
// ──────────────
// A failure for one parent does not abort the batch. We catch per-parent
// errors, log them to nightly_dispatch_log as 'failed', and continue.
// The function returns a JSON summary: { sent, failed, skipped, errors[] }
//
// TEMPLATE
// ────────
// Template name: nightly_lesson_v1 (pre-approved by Meta)
//
//   Hi {{1}} 👋
//
//   Tonight's 5-minute activity for {{2}}:
//
//   *{{3}}*
//   {{4}}
//
//   Ask at dinner:
//   {{5}}
//
//   Open lesson: {{6}}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface BatchRow {
  parent_user_id:  string;
  parent_name:     string;
  phone_e164:      string;
  language_code:   string;
  pupil_id:        string;
  pupil_name:      string;
  lesson_id:       string;
  lesson_title:    string;
  lesson_subject:  string;
  lesson_level:    string;
  kitchen_activity: string;
  dinner_question:  string;
  lesson_slug:     string;
}

interface DispatchSummary {
  sent:    number;
  failed:  number;
  skipped: number;
  total:   number;
  errors:  string[];
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function firstName(fullName: string): string {
  return (fullName ?? "there").split(/\s+/)[0];
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  const cut = s.lastIndexOf(" ", n - 1);
  return s.slice(0, cut > 0 ? cut : n - 1) + "…";
}

/**
 * Build the six template variables for nightly_lesson_v1.
 * Matches the format expected by send-whatsapp (type=template).
 */
function buildTemplateParams(row: BatchRow, appBaseUrl: string): string[] {
  const parentFirst   = firstName(row.parent_name);
  const childFirst    = firstName(row.pupil_name);
  const activityTitle = truncate(row.lesson_title ?? "Tonight's activity", 60);
  const activityBody  = truncate(row.kitchen_activity ?? "", 260);
  const dinnerQ       = truncate(row.dinner_question ?? "What did you learn today?", 120);
  const lessonUrl     = `${appBaseUrl}/app/parent/lessons/${row.lesson_id}`;

  return [
    parentFirst,    // {{1}} — parent first name
    childFirst,     // {{2}} — child first name
    activityTitle,  // {{3}} — activity title (bold in template)
    activityBody,   // {{4}} — kitchen activity body
    dinnerQ,        // {{5}} — first dinner question
    lessonUrl,      // {{6}} — deep link to lesson
  ];
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Service-role-only. The pg_cron job provides the service key.
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authHeader.includes(serviceKey)) {
    return json({ ok: false, error: "Forbidden — service role required" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const appBaseUrl  = Deno.env.get("APP_BASE_URL") ?? "https://traintoteachafrica.org";

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── 1. Fetch the batch ───────────────────────────────────────────────────
  const { data: batch, error: batchErr } = await supabase
    .rpc("get_nightly_dispatch_batch");

  if (batchErr) {
    return json({ ok: false, error: `Batch query failed: ${batchErr.message}` }, 500);
  }

  if (!batch || batch.length === 0) {
    return json({ ok: true, sent: 0, failed: 0, skipped: 0, total: 0, errors: [] });
  }

  const summary: DispatchSummary = {
    sent: 0, failed: 0, skipped: 0, total: batch.length, errors: [],
  };

  // ── 2. Send to each parent ───────────────────────────────────────────────
  const sendUrl = `${supabaseUrl}/functions/v1/send-whatsapp`;

  for (const row of batch as BatchRow[]) {
    try {
      // Build template params
      const templateParams = buildTemplateParams(row, appBaseUrl);

      // Call send-whatsapp (handles Meta + Termii fallback internally)
      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to:               row.phone_e164,
          type:             "template",
          template_name:    "nightly_lesson_v1",
          template_lang:    row.language_code ?? "en",
          template_params:  templateParams,
          parent_user_id:   row.parent_user_id,
          lesson_slug:      row.lesson_slug,
        }),
      });

      const sendBody = await sendRes.json() as {
        ok: boolean;
        channel?: string;
        message_id?: string;
        error?: string;
      };

      if (sendBody.ok) {
        // Record success
        await supabase.rpc("record_dispatch", {
          p_parent_user_id: row.parent_user_id,
          p_pupil_id:       row.pupil_id,
          p_lesson_id:      row.lesson_id,
          p_status:         "sent",
          p_channel:        sendBody.channel ?? "whatsapp",
          p_error_detail:   null,
        });
        summary.sent++;
      } else {
        // Record failure
        const errMsg = sendBody.error ?? "Unknown error from send-whatsapp";
        await supabase.rpc("record_dispatch", {
          p_parent_user_id: row.parent_user_id,
          p_pupil_id:       row.pupil_id,
          p_lesson_id:      row.lesson_id,
          p_status:         "failed",
          p_channel:        null,
          p_error_detail:   errMsg,
        });
        summary.failed++;
        summary.errors.push(`${firstName(row.parent_name)} (${row.phone_e164}): ${errMsg}`);
      }
    } catch (e) {
      // Catch-all for network errors or unexpected throws
      const errMsg = e instanceof Error ? e.message : String(e);
      summary.failed++;
      summary.errors.push(`${row.parent_user_id}: ${errMsg}`);

      // Still record the failure so the dashboard doesn't think it was skipped
      try {
        await supabase.rpc("record_dispatch", {
          p_parent_user_id: row.parent_user_id,
          p_pupil_id:       row.pupil_id,
          p_lesson_id:      row.lesson_id,
          p_status:         "failed",
          p_channel:        null,
          p_error_detail:   errMsg,
        });
      } catch {
        // If even the failure recording fails, swallow it — summary already captures the error
      }
    }

    // 200 ms between sends to pace delivery
    await new Promise((r) => setTimeout(r, 200));
  }

  return json({ ok: true, ...summary });
});
