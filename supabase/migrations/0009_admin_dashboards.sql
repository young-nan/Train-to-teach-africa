-- =============================================================================
-- 0009_admin_dashboards.sql
--
-- Data infrastructure for real school admin and teacher dashboards.
--
-- PARTS
-- ─────
-- 1. school_alerts table        — persistent alert queue (absence streaks,
--                                 ungraded assessments, term deadlines)
-- 2. generate_school_alerts RPC — builds alert rows from live data
-- 3. at_risk_pupils RPC         — pupils with ≥3 consecutive absences
-- 4. attendance_trend RPC       — daily % for the last N days (sparkline data)
-- 5. recent_school_payments     — view joining payments to plan labels
-- 6. school_kpis_v extension    — adds at_risk_count to the existing view
-- =============================================================================


-- ============================================================
-- PART 1 · school_alerts
-- Persistent alert rows. Refreshed daily by generate_school_alerts.
-- Each alert has a severity (info / warning / urgent) and an
-- optional deep-link so admins can navigate straight to the issue.
-- Dismissed alerts stay in the table (audit trail) but are filtered
-- from the active list by the dashboard query.
-- ============================================================

create table if not exists public.school_alerts (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  alert_type    text not null check (alert_type in (
                  'absence_streak',       -- pupil absent 3+ consecutive days
                  'ungraded_assessment',  -- assessment older than 7 days with no scores
                  'term_deadline',        -- term ends in ≤ 7 days, reports not generated
                  'low_attendance',       -- class attendance < 70% over last 7 days
                  'no_attendance_today',  -- class hasn't marked attendance today by noon
                  'pending_booking'       -- tutor booking awaiting confirmation ≥ 24h
                )),
  severity      text not null default 'warning'
                  check (severity in ('info', 'warning', 'urgent')),
  title         text not null,
  body          text,
  entity_id     uuid,    -- the pupil_id / class_id / assessment_id this refers to
  entity_type   text,    -- 'pupil' | 'class' | 'assessment' | 'term'
  deep_link     text,    -- relative URL the admin can navigate to
  dismissed_at  timestamptz,
  dismissed_by  uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  -- Replace stale alert of same type+entity each regeneration cycle.
  unique (school_id, alert_type, entity_id)
);

create index alerts_school_active_idx on public.school_alerts(school_id, severity)
  where dismissed_at is null;

alter table public.school_alerts enable row level security;

create policy alerts_school_read on public.school_alerts
  for select using (school_id = public.current_school_id());

create policy alerts_dismiss on public.school_alerts
  for update using (
    school_id = public.current_school_id()
    and public.current_role() in ('school_admin', 'head_teacher', 'super_admin')
  )
  with check (school_id = public.current_school_id());

create policy alerts_admin on public.school_alerts
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 2 · generate_school_alerts RPC
-- Builds alert rows from live attendance, assessment, and term data.
-- Called by a pg_cron job daily at 12:30 WAT (11:30 UTC) and on-demand
-- from the admin dashboard "Refresh alerts" button.
-- Uses INSERT ... ON CONFLICT DO UPDATE so it's safe to run multiple times.
-- ============================================================

create or replace function public.generate_school_alerts(p_school_id uuid)
returns int   -- number of alert rows written
language plpgsql
security definer
as $$
declare
  v_count int := 0;
begin

  -- ── 1. Absence streaks (3+ consecutive days absent) ─────────────────────
  -- We look at the last 10 school days. If the last 3 or more consecutive
  -- dates are all absent (or late counted as absent), we fire an alert.
  insert into public.school_alerts
    (school_id, alert_type, severity, title, body, entity_id, entity_type, deep_link)
  select
    p_school_id,
    'absence_streak',
    'urgent',
    pu.full_name || ' — ' || streak.streak_days || ' consecutive absences',
    'Pupil has been absent or late for ' || streak.streak_days || ' days in a row. '
    || 'Consider contacting the parent.',
    pu.id,
    'pupil',
    '/app/admin/pupils/' || pu.id
  from public.pupils pu
  join public.classes cl on cl.id = pu.class_id
  join lateral (
    -- Count the leading run of non-present days (most recent first)
    select count(*) as streak_days
    from (
      select a.status,
             row_number() over (order by a.date desc) as rn
      from public.attendance a
      where a.pupil_id = pu.id
        and a.date >= current_date - 10
      order by a.date desc
    ) sub
    where sub.status in ('absent', 'late')
      and sub.rn = (
        select count(*) from (
          select row_number() over (order by a2.date desc) as rn2
          from public.attendance a2
          where a2.pupil_id = pu.id and a2.date >= current_date - 10
          order by a2.date desc
        ) inner_sub
        where inner_sub.rn2 <= sub.rn
          and inner_sub.rn2 = sub.rn
      )
  ) streak on true
  where cl.school_id = p_school_id
    and streak.streak_days >= 3
  on conflict (school_id, alert_type, entity_id)
  do update set
    title      = excluded.title,
    body       = excluded.body,
    severity   = excluded.severity,
    created_at = now(),
    dismissed_at = null;

  get diagnostics v_count = row_count;

  -- ── 2. Ungraded assessments (7+ days old, no scores entered) ────────────
  insert into public.school_alerts
    (school_id, alert_type, severity, title, body, entity_id, entity_type, deep_link)
  select
    p_school_id,
    'ungraded_assessment',
    'warning',
    a.title || ' (' || cl.name || ') — no scores entered',
    'Assessment created ' || (current_date - a.given_on::date) || ' days ago. '
    || 'Scores have not been entered yet.',
    a.id,
    'assessment',
    '/app/teacher/gradebook/' || a.class_id
  from public.assessments a
  join public.classes cl on cl.id = a.class_id
  where cl.school_id = p_school_id
    and a.given_on <= current_date - 7
    and not exists (
      select 1 from public.scores s where s.assessment_id = a.id
    )
  on conflict (school_id, alert_type, entity_id)
  do update set
    title      = excluded.title,
    body       = excluded.body,
    created_at = now(),
    dismissed_at = null;

  get diagnostics v_count = v_count + row_count;

  -- ── 3. Low class attendance (< 70% over last 7 days) ────────────────────
  insert into public.school_alerts
    (school_id, alert_type, severity, title, body, entity_id, entity_type, deep_link)
  select
    p_school_id,
    'low_attendance',
    'warning',
    cl.name || ' — ' || round(att_pct, 1) || '% attendance this week',
    'Class attendance is below 70% over the last 7 days. '
    || round(att_pct, 1) || '% present.',
    cl.id,
    'class',
    '/app/admin/classes/' || cl.id
  from public.classes cl
  join lateral (
    select round(
      100.0 * count(*) filter (where a.status = 'present')
      / nullif(count(*), 0), 1
    ) as att_pct
    from public.attendance a
    where a.class_id = cl.id
      and a.date >= current_date - 7
  ) att on true
  where cl.school_id = p_school_id
    and att.att_pct < 70
    and att.att_pct is not null
  on conflict (school_id, alert_type, entity_id)
  do update set
    title      = excluded.title,
    body       = excluded.body,
    created_at = now(),
    dismissed_at = null;

  get diagnostics v_count = v_count + row_count;

  -- ── 4. Classes with no attendance marked today (after noon) ─────────────
  -- Only runs when current time is after 12:00 local (we approximate with UTC+1)
  if extract(hour from now() at time zone 'Africa/Lagos') >= 12 then
    insert into public.school_alerts
      (school_id, alert_type, severity, title, body, entity_id, entity_type, deep_link)
    select
      p_school_id,
      'no_attendance_today',
      'info',
      cl.name || ' — attendance not yet marked today',
      'It is past noon and this class has no attendance record for today.',
      cl.id,
      'class',
      '/app/teacher/attendance/' || cl.id
    from public.classes cl
    where cl.school_id = p_school_id
      and not exists (
        select 1 from public.attendance a
        where a.class_id = cl.id and a.date = current_date
      )
    on conflict (school_id, alert_type, entity_id)
    do update set created_at = now(), dismissed_at = null;

    get diagnostics v_count = v_count + row_count;
  end if;

  return v_count;
end;
$$;

grant execute on function public.generate_school_alerts(uuid) to authenticated, service_role;


-- ============================================================
-- PART 3 · at_risk_pupils RPC
-- Returns pupils with attendance < 80% for the last 14 days.
-- Used by the admin overview "At risk" panel.
-- ============================================================

create or replace function public.at_risk_pupils(p_school_id uuid)
returns table (
  pupil_id      uuid,
  pupil_name    text,
  class_name    text,
  attendance_pct numeric,
  absent_days   int,
  total_days    int
)
language sql
stable
security definer
as $$
  select
    pu.id,
    pu.full_name,
    cl.name,
    round(
      100.0 * count(*) filter (where a.status = 'present')
      / nullif(count(*), 0), 1
    )                                          as attendance_pct,
    count(*) filter (where a.status = 'absent')::int as absent_days,
    count(*)::int                              as total_days
  from public.pupils pu
  join public.classes cl on cl.id = pu.class_id
  join public.attendance a on a.pupil_id = pu.id
  where cl.school_id = p_school_id
    and a.date >= current_date - 14
  group by pu.id, pu.full_name, cl.name
  having round(
    100.0 * count(*) filter (where a.status = 'present')
    / nullif(count(*), 0), 1
  ) < 80
  order by attendance_pct asc
  limit 20;
$$;

grant execute on function public.at_risk_pupils(uuid) to authenticated;


-- ============================================================
-- PART 4 · attendance_trend RPC
-- Daily attendance percentage for the last N days.
-- Returns rows ordered by date ASC for chart rendering.
-- ============================================================

create or replace function public.attendance_trend(
  p_school_id uuid,
  p_days      int default 14
)
returns table (
  trend_date    date,
  present_pct   numeric,
  present_count int,
  absent_count  int,
  late_count    int,
  total_count   int
)
language sql
stable
security definer
as $$
  select
    a.date,
    round(
      100.0 * count(*) filter (where a.status = 'present')
      / nullif(count(*), 0), 1
    ),
    count(*) filter (where a.status = 'present')::int,
    count(*) filter (where a.status = 'absent')::int,
    count(*) filter (where a.status = 'late')::int,
    count(*)::int
  from public.attendance a
  join public.classes cl on cl.id = a.class_id
  where cl.school_id = p_school_id
    and a.date >= current_date - p_days
  group by a.date
  order by a.date asc;
$$;

grant execute on function public.attendance_trend(uuid, int) to authenticated;


-- ============================================================
-- PART 5 · recent_school_payments view
-- Joins payments to human-readable plan labels.
-- Used by the school admin billing panel.
-- ============================================================

create or replace view public.recent_school_payments as
select
  p.id,
  p.reference,
  p.user_id,
  pr.full_name    as payer_name,
  pr.email        as payer_email,
  p.plan_code,
  case
    when p.plan_code like '%PARENT_ANNUAL%'  then 'Parent · Annual'
    when p.plan_code like '%PARENT_TERM%'    then 'Parent · Per Term'
    when p.plan_code like '%TEACHER_TERM%'   then 'Teacher · Per Term'
    when p.plan_code like '%SCHOOL_ANNUAL%'  then 'School Bundle · Annual'
    when p.plan_code like '%SCHOOL_TERM%'    then 'School Bundle · Per Term'
    when p.plan_code = 'TUTOR_BOOKING'       then 'Tutor session'
    else p.plan_code
  end             as plan_label,
  p.amount_minor,
  p.currency,
  p.status,
  p.verified_at,
  p.created_at
from public.payments p
left join public.profiles pr on pr.user_id = p.user_id;

grant select on public.recent_school_payments to authenticated;


-- ============================================================
-- PART 6 · pg_cron: daily alert generation at 12:30 WAT
-- ============================================================

select cron.schedule(
  'generate_school_alerts_daily',
  '30 11 * * *',   -- 11:30 UTC = 12:30 WAT
  $$
    select public.generate_school_alerts(id)
    from public.schools
    where active = true;
  $$
);
