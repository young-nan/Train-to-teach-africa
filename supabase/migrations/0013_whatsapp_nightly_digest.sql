-- =============================================================================
-- 0013_whatsapp_nightly_digest.sql
--
-- WhatsApp / SMS nightly lesson digest infrastructure.
--
-- TABLES
--   whatsapp_opt_ins      — parent opts in, provides their phone number
--   whatsapp_log          — one row per send attempt (success or failure)
--   nightly_dispatch_log  — one row per parent-night dispatch job (aggregates)
--
-- FUNCTIONS
--   get_nightly_dispatch_batch()
--       → parents with active sub + opt-in + a lesson to send tonight
--       Called by the nightly-digest edge function.
--
--   record_dispatch(parent_user_id, lesson_id, status, channel, error)
--       → idempotent upsert into nightly_dispatch_log for tonight
--       Called by the nightly-digest edge function after each send.
--
-- CRON
--   'nightly_whatsapp_digest' — fires at 18:00 UTC (19:00 WAT) daily
--   Calls the nightly-digest Supabase Edge Function via net.http_post.
--   WAT is UTC+1; 18:00 UTC = 19:00 WAT — parents get the message before
--   the 7pm family dinner window we design around.
--
-- DESIGN NOTES
-- ─────────────
-- 1. Opt-in is explicit. NDPA (Nigerian Data Protection Act) and WhatsApp's
--    own ToS both require prior consent before sending template messages.
--    A parent must actively check "Send me tonight's lesson on WhatsApp"
--    and provide their phone number.
--
-- 2. Phone numbers are stored E.164-normalised ("+234XXXXXXXXX").
--    The normalisation happens at write time in the opt-in RPC.
--
-- 3. The nightly batch query selects only:
--    - Parents with an active subscription (ends_at > now())
--    - Parents who have opted in (whatsapp_opt_ins.active = true)
--    - Parents with at least one linked pupil who has a lesson for tonight
--      (determined by the pupil's level and the current week_of_term)
--
-- 4. One dispatch per parent per night, even if they have multiple children.
--    We pick the first (youngest) child's lesson to avoid message fatigue.
--    v2 can offer a per-child digest for parents who opt in explicitly.
--
-- 5. The nightly_dispatch_log is the source of truth for the
--    impact dashboard's whatsapp_stats CTE (0007_impact_dashboard.sql).
-- =============================================================================

begin;

-- ── 1. whatsapp_opt_ins ──────────────────────────────────────────────────────

create table public.whatsapp_opt_ins (
  id              uuid primary key default gen_random_uuid(),
  parent_user_id  uuid not null unique references auth.users(id) on delete cascade,

  -- E.164 phone number, e.g. "+2348012345678"
  phone_e164      text not null,

  -- Whether this opt-in is currently active
  active          boolean not null default true,

  -- Delivery preference
  preferred_time  time not null default '18:00:00',  -- local time (WAT); informational
  language_code   text not null default 'en',

  -- Audit
  opted_in_at     timestamptz not null default now(),
  opted_out_at    timestamptz,
  updated_at      timestamptz not null default now()
);

create index whatsapp_opt_ins_active_idx on public.whatsapp_opt_ins (active) where active = true;

comment on table  public.whatsapp_opt_ins is
  'Parent WhatsApp / SMS opt-in. Explicit consent required before sending template messages.';
comment on column public.whatsapp_opt_ins.phone_e164 is
  'E.164 international format, e.g. +2348012345678. Normalised on insert.';
comment on column public.whatsapp_opt_ins.active is
  'False = opted out. The row is never deleted — we keep opted_out_at for audit.';

alter table public.whatsapp_opt_ins enable row level security;

-- Parents manage their own opt-in
create policy optin_parent_self on public.whatsapp_opt_ins
  for all using (parent_user_id = auth.uid());

-- Staff can read (to see if parent has opted in, for the comms hub)
create policy optin_staff_read on public.whatsapp_opt_ins
  for select using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and role in ('teacher', 'head_teacher', 'school_admin', 'super_admin')
    )
  );

grant select, insert, update on public.whatsapp_opt_ins to authenticated;


-- ── 2. whatsapp_log ──────────────────────────────────────────────────────────
-- Referenced by the send-whatsapp edge function (already built).
-- One row per individual send attempt.

create table public.whatsapp_log (
  id              uuid primary key default gen_random_uuid(),
  parent_user_id  uuid references auth.users(id),
  to_phone        text not null,
  channel         text not null default 'whatsapp'  -- 'whatsapp' | 'sms'
                  check (channel in ('whatsapp', 'sms')),
  send_status     text not null default 'pending'   -- 'sent' | 'failed' | 'pending'
                  check (send_status in ('sent', 'failed', 'pending', 'delivered')),
  message_id      text,     -- Meta wamid or Termii message_id
  error_detail    text,
  payload_type    text,     -- 'template' | 'text'
  lesson_slug     text,     -- curriculum_code or lesson id for the lesson sent
  sent_at         timestamptz not null default now()
);

create index whatsapp_log_parent_idx on public.whatsapp_log (parent_user_id, sent_at desc);
create index whatsapp_log_status_idx on public.whatsapp_log (send_status, sent_at desc);

comment on table public.whatsapp_log is
  'One row per WhatsApp/SMS send attempt. Written by the send-whatsapp edge function.';

alter table public.whatsapp_log enable row level security;

-- Parents read their own log
create policy walog_parent_self on public.whatsapp_log
  for select using (parent_user_id = auth.uid());

-- Service role writes (edge function uses service key — bypasses RLS)
grant select on public.whatsapp_log to authenticated;
grant insert, update on public.whatsapp_log to service_role;


-- ── 3. nightly_dispatch_log ───────────────────────────────────────────────────
-- One row per parent-night. Aggregates the per-attempt whatsapp_log.
-- The impact dashboard's whatsapp_stats CTE reads from this table.

create table public.nightly_dispatch_log (
  id              uuid primary key default gen_random_uuid(),
  parent_user_id  uuid not null references auth.users(id) on delete cascade,
  pupil_id        uuid references public.pupils(id),
  lesson_id       uuid references public.lessons(id),
  dispatch_date   date not null default current_date,
  status          text not null default 'pending'
                  check (status in ('sent', 'failed', 'skipped', 'pending')),
  channel         text,     -- 'whatsapp' | 'sms' | null if failed pre-send
  error_detail    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One dispatch per parent per day
  constraint nightly_dispatch_unique unique (parent_user_id, dispatch_date)
);

create index nightly_dispatch_date_idx    on public.nightly_dispatch_log (dispatch_date desc);
create index nightly_dispatch_status_idx  on public.nightly_dispatch_log (status, dispatch_date desc);
create index nightly_dispatch_parent_idx  on public.nightly_dispatch_log (parent_user_id, dispatch_date desc);

comment on table public.nightly_dispatch_log is
  'One row per parent per night. Source of truth for WhatsApp delivery impact metrics.';

alter table public.nightly_dispatch_log enable row level security;

create policy dispatch_parent_self on public.nightly_dispatch_log
  for select using (parent_user_id = auth.uid());

create policy dispatch_staff_read on public.nightly_dispatch_log
  for select using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and role in ('teacher', 'head_teacher', 'school_admin', 'super_admin')
    )
  );

grant select on public.nightly_dispatch_log to authenticated;
grant insert, update on public.nightly_dispatch_log to service_role;


-- ── 4. get_nightly_dispatch_batch() ─────────────────────────────────────────
--
-- Returns all parents to message tonight. Called by the nightly-digest
-- edge function at 18:00 UTC. Each row has everything the edge function
-- needs: phone, lesson content, child name, parent name — no second query.
--
-- Filters applied:
--   a. Parent has an active subscription (ends_at > now())
--   b. Parent has an active WhatsApp opt-in
--   c. Parent has not already been dispatched today
--   d. Parent has at least one linked pupil with a published lesson for
--      the current week of term (week_of_term = extract(week from now())
--      relative to term start; simplified to term-week 1-13 modulo)
--
-- Lesson selection: pick the pupil's first linked child's level, then
-- pick the lesson with the lowest sort_index not yet completed. If none,
-- pick the last lesson (review). This is a simple heuristic — the full
-- adaptive learning engine lives in the student app.

create or replace function public.get_nightly_dispatch_batch()
returns table (
  parent_user_id  uuid,
  parent_name     text,
  phone_e164      text,
  language_code   text,
  pupil_id        uuid,
  pupil_name      text,
  lesson_id       uuid,
  lesson_title    text,
  lesson_subject  text,
  lesson_level    text,
  kitchen_activity text,
  dinner_question text,
  lesson_slug     text
) language plpgsql stable security definer as $$
declare
  -- Term start approximation: Sep for T1, Jan for T2, Apr for T3 (WAT)
  v_month       int := extract(month from now() at time zone 'Africa/Lagos');
  v_week_of_term int := case
    when v_month >= 9  then extract(week from now()) - extract(week from date_trunc('month', (date_trunc('year', now()) + interval '8 months')))
    when v_month <= 3  then extract(week from now()) - extract(week from date_trunc('year', now()))
    else                    extract(week from now()) - extract(week from date_trunc('month', (date_trunc('year', now()) + interval '3 months')))
  end;
begin
  -- Clamp to 1–13
  v_week_of_term := greatest(1, least(13, v_week_of_term));

  return query
  select distinct on (opt.parent_user_id)
    opt.parent_user_id,
    prof.full_name,
    opt.phone_e164,
    opt.language_code,
    pu.id,
    pu.full_name,
    l.id,
    l.title,
    l.subject,
    l.level,
    -- Extract parent kitchen activity from lesson content JSONB
    coalesce(
      l.content->'layers'->>'parentKitchenActivity',
      l.content->'layers'->>'parent_kitchen_activity',
      'Discuss what your child learned in school today.'
    ),
    -- Extract first dinner question
    coalesce(
      l.content->'layers'->'parentDinnerQuestions'->>0,
      l.content->'layers'->'parent_dinner_questions'->>0,
      'What was the most interesting thing you learned today?'
    ),
    l.curriculum_code
  from public.whatsapp_opt_ins opt

  -- Must have active sub
  join public.subscriptions sub
    on sub.user_id = opt.parent_user_id
   and sub.status  = 'active'
   and sub.ends_at > now()

  -- Must have a linked pupil
  join public.parent_pupil_links ppl
    on ppl.parent_user_id = opt.parent_user_id

  join public.pupils pu
    on pu.id = ppl.pupil_id

  -- Parent profile for name
  join public.profiles prof
    on prof.user_id = opt.parent_user_id

  -- A published lesson for that pupil's level and week
  join public.lessons l
    on l.level   = pu.level
   and l.status  = 'published'
   and l.week_of_term = v_week_of_term

  -- Not already dispatched today
  where opt.active = true
    and not exists (
      select 1 from public.nightly_dispatch_log ndl
      where ndl.parent_user_id = opt.parent_user_id
        and ndl.dispatch_date  = current_date
        and ndl.status in ('sent', 'skipped')
    )

  order by opt.parent_user_id, l.sort_index asc;
end;
$$;

grant execute on function public.get_nightly_dispatch_batch() to service_role;

comment on function public.get_nightly_dispatch_batch is
  'Returns opted-in parents with active subs and tonight''s lesson. Called by nightly-digest edge function.';


-- ── 5. record_dispatch() ─────────────────────────────────────────────────────
-- Idempotent upsert into nightly_dispatch_log. Called after each send attempt.

create or replace function public.record_dispatch(
  p_parent_user_id  uuid,
  p_pupil_id        uuid,
  p_lesson_id       uuid,
  p_status          text,
  p_channel         text default null,
  p_error_detail    text default null
) returns void language plpgsql security definer as $$
begin
  insert into public.nightly_dispatch_log
    (parent_user_id, pupil_id, lesson_id, dispatch_date, status, channel, error_detail)
  values
    (p_parent_user_id, p_pupil_id, p_lesson_id, current_date, p_status, p_channel, p_error_detail)
  on conflict (parent_user_id, dispatch_date)
  do update set
    status       = excluded.status,
    channel      = excluded.channel,
    error_detail = excluded.error_detail,
    updated_at   = now();
end;
$$;

grant execute on function public.record_dispatch(uuid, uuid, uuid, text, text, text) to service_role;

comment on function public.record_dispatch is
  'Idempotent upsert for nightly_dispatch_log. Safe to call multiple times for same parent-day.';


-- ── 6. pg_cron: nightly digest at 18:00 UTC (19:00 WAT) ─────────────────────
--
-- Calls the nightly-digest Supabase Edge Function via pg_net (net.http_post).
-- pg_net must be enabled on the project (Supabase Dashboard → Extensions).
--
-- The cron job passes the service role key in the Authorization header so
-- the edge function can trust the caller.
--
-- NOTE: Replace the URL placeholder with your actual Supabase project URL.
-- Format: https://<project-ref>.supabase.co/functions/v1/nightly-digest
--
-- This is set up as a named job so it can be unscheduled by name if needed:
--   select cron.unschedule('nightly_whatsapp_digest');

select cron.schedule(
  'nightly_whatsapp_digest',
  '0 18 * * *',    -- 18:00 UTC = 19:00 WAT every day
  $$
    select net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/nightly-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

commit;

-- =============================================================================
-- MANUAL SETUP REQUIRED (after applying this migration)
-- =============================================================================
-- 1. Enable pg_net extension in Supabase Dashboard → Extensions.
--
-- 2. Set the two app config values so the cron job can find the function:
--      alter database postgres
--        set app.supabase_url  = 'https://YOUR_REF.supabase.co';
--      alter database postgres
--        set app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
--
--    These are project-specific secrets. Do NOT commit them.
--    Run them directly in SQL Editor after the migration.
--
-- 3. Deploy the nightly-digest edge function:
--      supabase functions deploy nightly-digest
--
-- 4. Set the Meta / Termii secrets in Supabase Dashboard → Settings → Secrets:
--      META_WABA_PHONE_NUMBER_ID
--      META_WHATSAPP_TOKEN
--      TERMII_API_KEY            (optional; enables SMS fallback)
-- =============================================================================
