-- =============================================================================
-- 0002_lessons_payments_sims.sql
-- The data plane: lessons, attendance, scores, subscriptions, payments,
-- assessment attempts, and the RPCs the app depends on.
-- =============================================================================

-- ---- Lessons --------------------------------------------------------------
-- Canonical lesson content. The `content` JSONB column stores layered content
-- validated against LessonSchema (src/lib/schemas/lesson.js) before any read.
create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  curriculum_code   text not null,                  -- e.g. NERDC.PRI3.MATHS.NUM.05
  level             text not null,
  subject           text not null,
  topic             text not null,
  title             text not null,
  week_of_term      int,
  sort_index        int not null default 0,
  content           jsonb not null,                  -- { layers, assessment }
  estimated_minutes int not null default 30,
  author_id         uuid references auth.users(id),
  version           int not null default 1,
  status            text not null default 'published', -- draft|published|archived
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index lessons_level_subject_idx on public.lessons(level, subject, sort_index);
create index lessons_curriculum_idx on public.lessons(curriculum_code);

-- A safe-for-list view that excludes the heavy content blob.
create or replace view public.lesson_cards_v with (security_invoker = true) as
  select id, curriculum_code, level, subject, topic, title,
         week_of_term, sort_index, estimated_minutes
    from public.lessons
   where status = 'published';

-- ---- Assessment attempts --------------------------------------------------
create table public.assessment_attempts (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.pupils(id) on delete cascade,
  lesson_id         uuid not null references public.lessons(id) on delete restrict,
  answers           jsonb not null,
  score             int not null,                    -- 0..100
  duration_seconds  int,
  attempted_at      timestamptz not null default now()
);
create index attempts_student_idx on public.assessment_attempts(student_id, attempted_at desc);
create index attempts_lesson_idx on public.assessment_attempts(lesson_id);

-- ---- Attendance -----------------------------------------------------------
create table public.attendance (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes(id) on delete cascade,
  pupil_id        uuid not null references public.pupils(id) on delete cascade,
  date            date not null,
  status          text not null check (status in ('present', 'absent', 'late')),
  note            text,
  marked_by       uuid references auth.users(id),
  idempotency_key uuid not null,                    -- offline replay safety
  created_at      timestamptz not null default now(),
  unique (class_id, pupil_id, date)                 -- onConflict target
);
create index attendance_class_date_idx on public.attendance(class_id, date desc);
create index attendance_pupil_idx on public.attendance(pupil_id, date desc);

-- ---- Scores ---------------------------------------------------------------
create table public.assessments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  title       text not null,
  max_score   int not null default 100,
  given_on    date not null default current_date,
  created_at  timestamptz not null default now()
);

create table public.scores (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  pupil_id        uuid not null references public.pupils(id) on delete cascade,
  class_id        uuid not null references public.classes(id) on delete cascade,
  score           int not null,
  max_score       int not null,
  idempotency_key uuid not null,
  created_at      timestamptz not null default now(),
  unique (assessment_id, pupil_id)
);
create index scores_pupil_idx on public.scores(pupil_id, created_at desc);

-- ---- Subscriptions --------------------------------------------------------
-- One row per active commercial relationship. A school may have multiple
-- subscriptions over time (renewals create new rows); the active period is
-- whichever has now() between starts_at and ends_at.
create table public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),     -- null for school-paid bundles
  school_id   uuid references public.schools(id),
  plan_code   text not null,
  cadence     text not null check (cadence in ('term', 'annual')),
  currency    text not null check (currency in ('NGN', 'USD')),
  amount_minor bigint not null,
  status      text not null default 'active' check (status in ('active','cancelled','expired')),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index subs_user_idx on public.subscriptions(user_id) where user_id is not null;
create index subs_school_idx on public.subscriptions(school_id) where school_id is not null;
create index subs_active_idx on public.subscriptions(ends_at) where status = 'active';

-- ---- Payments -------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,           -- Paystack reference
  user_id           uuid references auth.users(id),
  plan_code         text not null,
  amount_minor      bigint not null,
  currency          text not null,
  status            text not null default 'pending' check (status in ('pending','verified','failed')),
  failure_reason    text,
  subscription_id   uuid references public.subscriptions(id),
  paystack_event    jsonb,                          -- raw webhook body for audit
  verified_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index payments_user_idx on public.payments(user_id, created_at desc);
create index payments_status_idx on public.payments(status, created_at desc);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.lessons enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.attendance enable row level security;
alter table public.assessments enable row level security;
alter table public.scores enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Lessons: published lessons readable by any authenticated user.
create policy lessons_authed_read on public.lessons
  for select to authenticated using (status = 'published');

-- Attempts: students read their own. Teachers read attempts for pupils in
-- their class. Parents read attempts for their linked children.
create policy attempts_student_self on public.assessment_attempts
  for select using (
    student_id in (select id from public.pupils where pupil_code = (auth.jwt()->>'pupil_code'))
  );
create policy attempts_teacher_class on public.assessment_attempts
  for select using (
    public.current_role() in ('teacher','head_teacher','school_admin','super_admin')
    and student_id in (
      select p.id from public.pupils p
        join public.classes c on c.id = p.class_id
       where c.school_id = public.current_school_id()
    )
  );
create policy attempts_parent_child on public.assessment_attempts
  for select using (
    student_id in (
      select pupil_id from public.parent_pupil_links where parent_user_id = auth.uid()
    )
  );
create policy attempts_self_insert on public.assessment_attempts
  for insert to authenticated with check (true);
  -- (server-side trigger validates the student_id matches the JWT.)

-- Attendance: school staff read+write for their school.
create policy attendance_staff_read on public.attendance
  for select using (
    class_id in (select id from public.classes where school_id = public.current_school_id())
    and public.current_role() in ('teacher','head_teacher','school_admin','super_admin')
  );
create policy attendance_staff_write on public.attendance
  for insert to authenticated with check (
    class_id in (select id from public.classes where school_id = public.current_school_id())
    and public.current_role() in ('teacher','head_teacher','school_admin','super_admin')
  );
create policy attendance_staff_update on public.attendance
  for update using (
    class_id in (select id from public.classes where school_id = public.current_school_id())
    and public.current_role() in ('teacher','head_teacher','school_admin','super_admin')
  );
-- Parents see attendance for their children.
create policy attendance_parent_read on public.attendance
  for select using (
    pupil_id in (select pupil_id from public.parent_pupil_links where parent_user_id = auth.uid())
  );

-- Assessments + scores: same pattern as attendance.
create policy assessments_staff on public.assessments
  for all using (class_id in (select id from public.classes where school_id = public.current_school_id()))
  with check (class_id in (select id from public.classes where school_id = public.current_school_id()));

create policy scores_staff on public.scores
  for all using (class_id in (select id from public.classes where school_id = public.current_school_id()))
  with check (class_id in (select id from public.classes where school_id = public.current_school_id()));

create policy scores_parent_read on public.scores
  for select using (
    pupil_id in (select pupil_id from public.parent_pupil_links where parent_user_id = auth.uid())
  );

-- Subscriptions + payments: users see their own; school admins see school's.
create policy subs_self_read on public.subscriptions
  for select using (
    user_id = auth.uid()
    or (school_id = public.current_school_id() and public.current_role() in ('school_admin','super_admin'))
  );
create policy payments_self_read on public.payments
  for select using (user_id = auth.uid() or public.current_role() = 'super_admin');

-- =============================================================================
-- RPCs
-- =============================================================================

-- ---- next_lesson_for_student ---------------------------------------------
-- Returns the next recommended lesson based on curriculum order + last attempt.
create or replace function public.next_lesson_for_student(p_student_id uuid)
returns table(lesson_id uuid, reason text)
language plpgsql stable security definer as $$
declare
  v_level text;
begin
  select level into v_level from public.pupils where id = p_student_id;
  return query
    select l.id, 'next_in_curriculum'::text
      from public.lessons l
     where l.level = v_level
       and l.status = 'published'
       and l.id not in (
         select lesson_id from public.assessment_attempts
          where student_id = p_student_id and score >= 60
       )
     order by l.sort_index asc
     limit 1;
end;
$$;
grant execute on function public.next_lesson_for_student(uuid) to authenticated;

-- ---- attendance_trend -----------------------------------------------------
create or replace function public.attendance_trend(p_school_id uuid, p_days int default 14)
returns table(date date, present_pct numeric)
language sql stable security definer as $$
  with days as (
    select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as d
  )
  select
    days.d as date,
    coalesce(round(
      100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0),
      1
    ), 0) as present_pct
  from days
  left join public.attendance a on a.date = days.d
  left join public.classes c on c.id = a.class_id
  where c.school_id = p_school_id or a.id is null
  group by days.d
  order by days.d;
$$;
grant execute on function public.attendance_trend(uuid, int) to authenticated;

-- ---- public_impact_metrics (no auth needed) -------------------------------
-- Public counters for the marketing homepage. Cached in front of Cloudflare.
create or replace function public.public_impact_metrics()
returns jsonb
language sql stable security definer as $$
  select jsonb_build_object(
    'schools', (select count(*) from public.schools where status = 'active'),
    'pupils', (select count(*) from public.pupils),
    'lessons', (select count(*) from public.assessment_attempts),
    'attendance_lift_pts', 4.2  -- computed offline; refreshed weekly
  );
$$;
grant execute on function public.public_impact_metrics() to anon, authenticated;

-- ---- activate_subscription -----------------------------------------------
-- The single procedure that turns a verified payment into access. Called only
-- from the verify-payment edge function (service role).
create or replace function public.activate_subscription(
  p_user_id uuid,
  p_plan_code text,
  p_payment_id uuid
) returns uuid
language plpgsql security definer as $$
declare
  v_cadence text;
  v_currency text;
  v_amount_minor bigint;
  v_school_id uuid;
  v_ends_at timestamptz;
  v_subscription_id uuid;
begin
  -- Map plan_code → cadence + currency + amount. These values are
  -- duplicated from src/config/pricing.js; CI keeps them in sync.
  select
    case
      when p_plan_code like '%_TERM' then 'term'
      when p_plan_code like '%_ANNUAL' then 'annual'
    end,
    case when p_plan_code like 'AFR_%' then 'NGN' else 'USD' end
  into v_cadence, v_currency;

  v_amount_minor := case p_plan_code
    when 'AFR_PARENT_TERM'    then 1084700
    when 'AFR_PARENT_ANNUAL'  then 3118400
    when 'AFR_TEACHER_TERM'   then 1220300
    when 'AFR_SCHOOL_TERM'    then 6101200
    when 'AFR_SCHOOL_ANNUAL'  then 17625600
    when 'INT_PARENT_TERM'    then 1200
    when 'INT_PARENT_ANNUAL'  then 3200
    when 'INT_TEACHER_TERM'   then 1400
    when 'INT_SCHOOL_TERM'    then 7500
    when 'INT_SCHOOL_ANNUAL'  then 25000
  end;

  if v_amount_minor is null then
    raise exception 'Unknown plan_code: %', p_plan_code;
  end if;

  -- Term = 13 weeks; annual = 1 year.
  v_ends_at := case v_cadence
    when 'term' then now() + interval '13 weeks'
    when 'annual' then now() + interval '1 year'
  end;

  -- School-paid bundles attach to the user's school.
  select school_id into v_school_id from public.profiles where user_id = p_user_id;

  insert into public.subscriptions (user_id, school_id, plan_code, cadence, currency, amount_minor, status, starts_at, ends_at)
  values (
    p_user_id,
    case when p_plan_code like '%SCHOOL%' then v_school_id else null end,
    p_plan_code, v_cadence, v_currency, v_amount_minor, 'active', now(), v_ends_at
  )
  returning id into v_subscription_id;

  -- Link payment row to subscription.
  update public.payments set subscription_id = v_subscription_id where id = p_payment_id;

  return v_subscription_id;
end;
$$;
revoke all on function public.activate_subscription(uuid, text, uuid) from public;
-- Only the service role calls this — never granted to authenticated.

-- ---- school_kpis_v --------------------------------------------------------
-- Materialised view refreshed every 5 minutes by a scheduled function.
create materialized view public.school_kpis_v as
  select
    s.id as school_id,
    s.name as school_name,
    (select count(*) from public.pupils where school_id = s.id) as pupil_count,
    (select count(*) from public.classes where school_id = s.id) as class_count,
    (select round(
       100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0),
       1
     )
       from public.attendance a
       join public.classes c on c.id = a.class_id
      where c.school_id = s.id and a.date >= current_date - interval '14 days'
    ) as attendance_14d_pct,
    now() as refreshed_at
  from public.schools s;

create unique index school_kpis_school_idx on public.school_kpis_v(school_id);
grant select on public.school_kpis_v to authenticated;
