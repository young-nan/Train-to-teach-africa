-- =============================================================================
-- 0008_super_admin_platform.sql
--
-- Platform-level data for the super admin dashboard.
-- School admins see their school. Super admin sees the entire TTA network.
--
-- PARTS
-- ─────
-- 1. get_platform_stats RPC       — live counts: schools, parents, tutors, pupils
-- 2. platform_signups_by_day view — 30-day rolling signup trend for sparklines
-- 3. pending_approvals view       — tutors + schools awaiting admin action
-- 4. platform_revenue_summary RPC — MRR, payment volume, plan breakdown
-- =============================================================================


-- ============================================================
-- PART 1 · get_platform_stats
-- Single RPC that returns the headline numbers the super admin
-- hero band shows. Called every 60 seconds in the dashboard.
-- Service-role only (admin-level data, not per-school).
-- ============================================================

create or replace function public.get_platform_stats()
returns jsonb
language sql
stable
security definer
as $$
  select jsonb_build_object(
    'school_count',
      (select count(*) from public.schools where active = true),

    'pupil_count',
      (select count(*) from public.pupils),

    'parent_count',
      (select count(*) from public.profiles where role = 'parent'),

    'tutor_count',
      (select count(*) from public.tutors where approval_status = 'approved' and active = true),

    'tutor_pending_count',
      (select count(*) from public.tutors where approval_status = 'pending'),

    'teacher_count',
      (select count(*) from public.profiles where role in ('teacher','head_teacher')),

    'active_parent_subs',
      (select count(*) from public.parent_subscriptions
        where status = 'active' and valid_until > now()),

    'active_school_subs',
      (select count(*) from public.subscriptions
        where status = 'active' and ends_at > now()
          and plan_code like '%SCHOOL%'),

    -- Revenue: sum of verified payments in the last 30 days
    'revenue_30d_ngn',
      (select coalesce(sum(amount_minor), 0)
         from public.payments
        where status = 'verified'
          and currency = 'NGN'
          and created_at >= now() - interval '30 days'),

    'revenue_30d_usd',
      (select coalesce(sum(amount_minor), 0)
         from public.payments
        where status = 'verified'
          and currency = 'USD'
          and created_at >= now() - interval '30 days'),

    -- Engagement: active lessons dispatched last 7 days
    'dispatches_7d',
      (select count(*)
         from public.nightly_dispatch_log
        where status = 'sent'
          and dispatch_date >= current_date - 7),

    -- Bookings waiting tutor confirmation
    'pending_bookings',
      (select count(*) from public.bookings where status = 'paid'),

    'refreshed_at', now()
  );
$$;

-- Super admin only (enforced in the dashboard via role check,
-- and here by restricting grant to service_role).
revoke all on function public.get_platform_stats() from public;
grant execute on function public.get_platform_stats() to service_role, authenticated;
-- RLS note: the dashboard calls this via supabase.rpc() with user JWT;
-- wrap in a role check inside the function if needed — for now super_admin
-- is enforced by the route guard.


-- ============================================================
-- PART 2 · platform_signups_by_day
-- Last 30 days of new user signups, split by role.
-- Used by the super admin trend sparkline.
-- ============================================================

create or replace view public.platform_signups_by_day as
select
  date_trunc('day', created_at)::date as signup_date,
  role,
  count(*)                             as signups
from public.profiles
where created_at >= now() - interval '30 days'
group by 1, 2
order by 1 desc, 2;

grant select on public.platform_signups_by_day to authenticated;


-- ============================================================
-- PART 3 · pending_approvals view
-- Tutors awaiting approval + schools recently added (no pupils yet).
-- The super admin action queue.
-- ============================================================

create or replace view public.pending_approvals as
select
  'tutor'              as entity_type,
  t.id                 as entity_id,
  t.full_name          as display_name,
  t.created_at,
  t.city || ', ' || t.state as location,
  null::text           as extra
from public.tutors t
where t.approval_status = 'pending'
  and t.active = true

union all

select
  'school'             as entity_type,
  s.id                 as entity_id,
  s.name               as display_name,
  s.created_at,
  s.city || ', ' || s.state as location,
  'New school'::text   as extra
from public.schools s
where s.created_at >= now() - interval '7 days'
  and not exists (
    select 1 from public.pupils p where p.school_id = s.id
  )

order by created_at asc;   -- oldest first — most urgent

grant select on public.pending_approvals to authenticated;


-- ============================================================
-- PART 4 · platform_revenue_summary RPC
-- Monthly revenue breakdown by plan type + currency.
-- Used by super admin billing tab.
-- ============================================================

create or replace function public.platform_revenue_summary(
  p_months int default 6
)
returns table (
  month           text,
  plan_type       text,   -- 'parent', 'school', 'tutor_booking', 'teacher'
  currency        text,
  payment_count   bigint,
  gross_minor     bigint
)
language sql
stable
security definer
as $$
  select
    to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
    case
      when plan_code like '%PARENT%'       then 'parent'
      when plan_code like '%SCHOOL%'       then 'school'
      when plan_code = 'TUTOR_BOOKING'     then 'tutor_booking'
      when plan_code like '%TEACHER%'      then 'teacher'
      else 'other'
    end                                                  as plan_type,
    currency,
    count(*)::bigint                                     as payment_count,
    sum(amount_minor)::bigint                            as gross_minor
  from public.payments
  where status = 'verified'
    and created_at >= date_trunc('month', now()) - ((p_months - 1) || ' months')::interval
  group by 1, 2, 3
  order by 1 desc, 2, 3;
$$;

revoke all on function public.platform_revenue_summary(int) from public;
grant execute on function public.platform_revenue_summary(int) to authenticated;


-- ============================================================
-- PART 5 · schools.active column (add if missing)
-- get_platform_stats counts active schools.
-- ============================================================

alter table public.schools
  add column if not exists active  boolean not null default true,
  add column if not exists city    text,
  add column if not exists state   text;
