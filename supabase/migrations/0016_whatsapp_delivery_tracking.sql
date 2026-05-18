-- =============================================================================
-- 0016_whatsapp_delivery_tracking.sql
--
-- Delivery confirmation infrastructure for the WhatsApp webhook.
--
-- The whatsapp-webhook edge function looks up whatsapp_log rows by message_id
-- (the Meta wamid) to update send_status from 'sent' → 'delivered'.
-- message_id was already a column (from 0013) but had no index — the webhook
-- could receive hundreds of status callbacks per evening batch and a full-scan
-- on a growing log table would be unacceptable.
--
-- CHANGES
-- ───────
-- 1. Index on whatsapp_log(message_id) — the webhook lookup path.
--    Partial: only non-null message_ids (SMS fallback rows have null here).
--
-- 2. delivery_confirmed_at on nightly_dispatch_log — nullable timestamptz.
--    Set by the webhook when whatsapp_log.send_status is updated to 'delivered'.
--    Separate from the status column (which stays 'sent' — it tracks the send
--    attempt, not the delivery confirmation). This lets the parent's WhatsApp
--    settings view show "delivered at 7:23pm" without us conflating two events.
--
-- 3. delivery_rate view — used by the impact dashboard's whatsapp_stats CTE.
--    (The existing 0007 CTE already counts dispatches_sent_7d from
--    nightly_dispatch_log where status='sent'. This view adds a delivery_pct
--    column the super admin dashboard can surface.)
--
-- WHY NOT UPDATE nightly_dispatch_log.status → 'delivered'?
-- ──────────────────────────────────────────────────────────
-- The status column tracks the nightly job outcome:
--   'pending' → job hasn't run yet
--   'sent'    → send attempt succeeded (message handed to Meta)
--   'failed'  → send attempt failed (Meta rejected or network error)
--   'skipped' → parent had no lesson / opted out mid-batch
--
-- "Sent" is the correct state: TTA did its job. Meta's delivery is outside
-- our control — the parent might have their phone off, be in a no-coverage
-- area, or have WhatsApp uninstalled. Separating these gives cleaner metrics:
-- delivery rate = delivered / sent (not delivered / total attempts).
-- =============================================================================

begin;

-- ── 1. message_id index ──────────────────────────────────────────────────────

create index if not exists whatsapp_log_message_id_idx
  on public.whatsapp_log (message_id)
  where message_id is not null;

comment on index public.whatsapp_log_message_id_idx is
  'Lookup path for the whatsapp-webhook function: wamid → log row.';

-- ── 2. delivery_confirmed_at on nightly_dispatch_log ─────────────────────────

alter table public.nightly_dispatch_log
  add column if not exists delivery_confirmed_at timestamptz;

comment on column public.nightly_dispatch_log.delivery_confirmed_at is
  'Set by whatsapp-webhook when Meta confirms delivery. Null = not yet confirmed or sent via SMS fallback.';

create index if not exists nightly_dispatch_confirmed_idx
  on public.nightly_dispatch_log (delivery_confirmed_at)
  where delivery_confirmed_at is not null;

-- ── 3. whatsapp_delivery_stats view ──────────────────────────────────────────
-- Per-day delivery stats. Used by super_admin and school impact dashboards.
-- Replaces the whatsapp_delivery_7d subquery in school_impact_v (0007) —
-- that CTE still works because it only reads from nightly_dispatch_log.status.

create or replace view public.whatsapp_delivery_stats as
select
  ndl.dispatch_date,
  count(*)                                              as total_dispatched,
  count(*) filter (where ndl.status = 'sent')          as send_succeeded,
  count(*) filter (where ndl.status = 'failed')        as send_failed,
  count(*) filter (where ndl.delivery_confirmed_at is not null) as confirmed_delivered,
  round(
    100.0
    * count(*) filter (where ndl.delivery_confirmed_at is not null)
    / nullif(count(*) filter (where ndl.status = 'sent'), 0),
    1
  )                                                     as delivery_rate_pct
from public.nightly_dispatch_log ndl
group by ndl.dispatch_date
order by ndl.dispatch_date desc;

grant select on public.whatsapp_delivery_stats to authenticated;

comment on view public.whatsapp_delivery_stats is
  'Per-day WhatsApp dispatch and delivery stats. send_succeeded = Meta accepted; confirmed_delivered = Meta confirmed device receipt.';

-- ── 4. Backfill delivery status from existing whatsapp_log ───────────────────
-- Rows in whatsapp_log that already have send_status = 'delivered' (e.g. if
-- the webhook ran before this migration) should be reflected in
-- nightly_dispatch_log. This is a one-time idempotent backfill.

update public.nightly_dispatch_log ndl
set delivery_confirmed_at = wl.sent_at   -- approximate — we don't know exact delivery time
from public.whatsapp_log wl
where wl.parent_user_id  = ndl.parent_user_id
  and wl.send_status     = 'delivered'
  and wl.sent_at::date   = ndl.dispatch_date
  and ndl.delivery_confirmed_at is null;

commit;
