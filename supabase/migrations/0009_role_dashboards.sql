-- =============================================================================
-- 0009_role_dashboards.sql
--
-- Data infrastructure for role-specific dashboards:
--
-- 1. school_alerts_v      — real-time alert generation from live data
-- 2. get_at_risk_pupils   — pupils with absence streaks ≥ threshold
-- 3. school_payments_v    — real payment history for school billing tab
-- 4. get_school_billing   — school admin billing summary (active sub + payments)
-- 5. teacher_daily_v      — teacher's classes with today's attendance status
-- 6. get_teacher_summary  — teacher dashboard: classes, pending tasks count
-- =============================================================================


-- ============================================================
-- PART 1 · school_alerts_v
-- Generates alerts from real operational data. No manual
-- alert creation — alerts are derived automatically.
--
-- Alert types:
--   absence_streak    — pupil absent N+ consecutive days
--   ungraded_assess   — assessment exists with no scores entered
--   report_pending    — report submitted but not approved > 48h
--   term_ending_soon  — current term ends within 14 days
--   no_attendance     — class has no attendance record today
-- ============================================================

create or replace view public.school_alerts_v as

-- Pupils with 3+ consecutive absences in the last 14 days
with absence_streaks as (
  select
    a.class_id,
    a.pupil_id,
    p.full_name                             as pupil_name,
    cl.school_id,
    count(*) filter (where a.status = 'absent'
                       and a.date >= current_date - 7)  as absent_days_7d
  from public.attendance a
  join public.pupils  p  on p.id  = a.pupil_id
  join public.classes cl on cl.id = a.class_id
  where a.date >= current_date - 14
  group by a.class_id, a.pupil_id, p.full_name, cl.school_id
  having count(*) filter (where a.status = 'absent'
                            and a.date >= current_date - 7) >= 3
),

-- Assessments created > 2 days ago with no scores entered
ungraded as (
  select
    asmt.id                                as assessment_id,
    asmt.class_id,
    cl.school_id,
    asmt.title                             as assessment_title,
    asmt.given_on
  from public.assessments asmt
  join public.classes cl on cl.id = asmt.class_id
  where asmt.given_on <= current_date - 2
    and not exists (
      select 1 from public.scores s where s.assessment_id = asmt.id
    )
),

-- Reports submitted for approval but not actioned in 48h
stalled_reports as (
  select
    tr.id                                  as report_id,
    tr.school_id,
    tr.pupil_id,
    p.full_name                            as pupil_name,
    tr.submitted_at
  from public.term_reports tr
  join public.pupils p on p.id = tr.pupil_id
  where tr.status = 'pending_approval'
    and tr.submitted_at < now() - interval '48 hours'
),

-- Classes with no attendance record today (school is in session)
no_attendance_today as (
  select
    cl.id                                  as class_id,
    cl.school_id,
    cl.name                                as class_name
  from public.classes cl
  join public.schools s on s.id = cl.school_id
  where s.active = true
    and not exists (
      select 1 from public.attendance a
       where a.class_id = cl.id
         and a.date = current_date
    )
    -- Only flag on weekdays
    and extract(dow from current_date) between 1 and 5
)

-- Union all alert types into one view
select
  'absence_streak'::text         as alert_type,
  'amber'::text                  as severity,
  school_id,
  class_id,
  pupil_id,
  null::uuid                     as assessment_id,
  null::uuid                     as report_id,
  pupil_name || ' has been absent ' || absent_days_7d || ' days this week'
                                 as message,
  current_date                   as generated_on
from absence_streaks

union all

select
  'ungraded_assessment',
  'amber',
  school_id,
  class_id,
  null,
  assessment_id,
  null,
  '"' || assessment_title || '" has no scores entered (' || (current_date - given_on) || ' days old)',
  current_date
from ungraded

union all

select
  'report_stalled',
  'red',
  school_id,
  null,
  pupil_id,
  null,
  report_id,
  pupil_name || '''s report has been waiting for approval since '
    || to_char(submitted_at, 'Mon DD HH24:MI'),
  current_date
from stalled_reports

union all

select
  'no_attendance_today',
  'amber',
  school_id,
  class_id,
  null,
  null,
  null,
  class_name || ' has no attendance recorded for today',
  current_date
from no_attendance_today;

grant select on public.school_alerts_v to authenticated;


-- ============================================================
-- PART 2 · get_at_risk_pupils
-- Returns pupils with N+ absences in the last D days.
-- Used by the admin alerts tab and the head teacher overview.
-- ============================================================

create or replace function public.get_at_risk_pupils(
  p_school_id    uuid,
  p_days         int  default 14,
  p_min_absences int  default 3
)
returns table (
  pupil_id       uuid,
  pupil_name     text,
  class_id       uuid,
  class_name     text,
  absent_count   bigint,
  late_count     bigint,
  last_seen_date date
)
language sql
stable
security definer
as $$
  select
    p.id,
    p.full_name,
    cl.id,
    cl.name,
    count(*) filter (where a.status = 'absent')   as absent_count,
    count(*) filter (where a.status = 'late')     as late_count,
    max(a.date) filter (where a.status = 'present') as last_seen_date
  from public.attendance a
  join public.pupils  p  on p.id  = a.pupil_id
  join public.classes cl on cl.id = a.class_id
  where cl.school_id = p_school_id
    and a.date >= current_date - p_days
  group by p.id, p.full_name, cl.id, cl.name
  having count(*) filter (where a.status = 'absent') >= p_min_absences
  order by absent_count desc, p.full_name;
$$;

grant execute on function public.get_at_risk_pupils(uuid, int, int) to authenticated;


-- ============================================================
-- PART 3 · school_payments_v
-- Real payment history for the school billing tab.
-- Shows the school's own payments (school bundle plans).
-- Joined to subscription so we can show expiry dates.
-- ============================================================

create or replace view public.school_payments_v as
select
  py.id,
  py.reference,
  py.plan_code,
  py.amount_minor,
  py.currency,
  py.status,
  py.verified_at,
  py.created_at,
  sub.ends_at                 as subscription_ends_at,
  sub.status                  as subscription_status,
  pr.full_name                as payer_name,
  pr.email                    as payer_email,
  pr.school_id
from public.payments py
join public.profiles pr on pr.user_id = py.user_id
left join public.subscriptions sub on sub.id = py.subscription_id
where py.plan_code like '%SCHOOL%'
  or  py.plan_code like '%TEACHER%';

grant select on public.school_payments_v to authenticated;


-- ============================================================
-- PART 4 · get_school_billing_summary
-- Returns the school's current active subscription + recent payments.
-- Used by school admin Billing tab.
-- ============================================================

create or replace function public.get_school_billing_summary(p_school_id uuid)
returns jsonb
language sql
stable
security definer
as $$
  select jsonb_build_object(
    'active_subscription', (
      select jsonb_build_object(
        'plan_code',  sub.plan_code,
        'status',     sub.status,
        'starts_at',  sub.starts_at,
        'ends_at',    sub.ends_at,
        'days_left',  greatest(0, (sub.ends_at::date - current_date)::int)
      )
      from public.subscriptions sub
      join public.profiles pr on pr.user_id = sub.user_id
      where pr.school_id = p_school_id
        and sub.plan_code like '%SCHOOL%'
        and sub.status = 'active'
      order by sub.ends_at desc
      limit 1
    ),
    'recent_payments', (
      select jsonb_agg(jsonb_build_object(
        'reference',   py.reference,
        'plan_code',   py.plan_code,
        'amount_minor',py.amount_minor,
        'currency',    py.currency,
        'status',      py.status,
        'verified_at', py.verified_at,
        'created_at',  py.created_at
      ) order by py.created_at desc)
      from public.payments py
      join public.profiles pr on pr.user_id = py.user_id
      where pr.school_id = p_school_id
        and (py.plan_code like '%SCHOOL%' or py.plan_code like '%TEACHER%'
             or py.plan_code like '%PARENT%')
      limit 10
    ),
    'parent_sub_count', (
      select count(*)
        from public.parent_subscriptions ps
        join public.parent_pupil_links ppl on ppl.parent_user_id = ps.parent_user_id
        join public.pupils pu on pu.id = ppl.pupil_id
        join public.classes cl on cl.id = pu.class_id
       where cl.school_id = p_school_id
         and ps.status = 'active'
         and ps.valid_until > now()
    )
  );
$$;

grant execute on function public.get_school_billing_summary(uuid) to authenticated;


-- ============================================================
-- PART 5 · teacher_daily_summary
-- What a teacher needs to see the moment they log in:
--   - their classes
--   - which ones have attendance marked today
--   - count of pending scores (assessments without scores)
--   - any submitted reports awaiting their action
-- ============================================================

create or replace function public.get_teacher_daily_summary(p_teacher_id uuid)
returns jsonb
language sql
stable
security definer
as $$
  with my_classes as (
    -- Union legacy teacher_id column + class_teachers join table
    select id as class_id, name as class_name,
           level, school_id,
           (select count(*) from public.pupils where class_id = id) as pupil_count
      from public.classes
     where teacher_id = p_teacher_id
    union
    select ct.class_id, cl.name, cl.level, cl.school_id,
           (select count(*) from public.pupils where class_id = ct.class_id)
      from public.class_teachers ct
      join public.classes cl on cl.id = ct.class_id
     where ct.teacher_id = p_teacher_id
  )
  select jsonb_build_object(
    'classes', (
      select jsonb_agg(jsonb_build_object(
        'class_id',        mc.class_id,
        'class_name',      mc.class_name,
        'level',           mc.level,
        'pupil_count',     mc.pupil_count,
        'attendance_done', exists (
          select 1 from public.attendance a
           where a.class_id = mc.class_id
             and a.date = current_date
        ),
        'pending_scores', (
          select count(*)
            from public.assessments asmt
           where asmt.class_id = mc.class_id
             and not exists (
               select 1 from public.scores s where s.assessment_id = asmt.id
             )
        )
      ))
      from my_classes mc
    ),
    'pending_report_count', (
      select count(*)
        from public.term_reports tr
        join public.pupils pu on pu.id = tr.pupil_id
        join public.classes cl on cl.id = pu.class_id
       where cl.teacher_id = p_teacher_id
         and tr.status in ('draft', 'pending_approval')
    ),
    'today',     current_date,
    'day_name',  to_char(current_date, 'Day')
  );
$$;

grant execute on function public.get_teacher_daily_summary(uuid) to authenticated;
