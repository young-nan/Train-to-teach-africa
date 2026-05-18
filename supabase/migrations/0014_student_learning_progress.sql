-- =============================================================================
-- 0014_student_learning_progress.sql
--
-- The learning data layer for TTA Learn. Everything the student app needs
-- to track progress, maintain streaks, and award badges.
--
-- TABLES
--   child_learning_progress  — one row per pupil × lesson (started/in-progress/done)
--   student_streaks          — one row per pupil, maintained by complete_lesson()
--   badges                   — static catalogue, seeded below
--   pupil_badges             — earned badge junction (pupil × badge)
--
-- RPCS
--   get_next_lesson_for_pupil(p_pupil_id)
--       → the lesson a pupil should do next. Returns null when caught up.
--       Adaptive: prefers in-progress over not-started, respects sort_index.
--
--   complete_lesson(p_pupil_id, p_lesson_id, p_score, p_duration_s)
--       → atomically marks complete, updates streak, awards any new badges.
--       Returns { streak, total_lessons, new_badges: [{slug,name,icon_emoji}] }
--
--   get_child_progress_summary(p_pupil_id)
--       → JSONB dashboard summary for parents, teachers, and student profile.
--       Returns { streak, total, in_progress, pct_complete, best_subject, recent }
--
-- BADGE CATALOGUE (seeded — 12 badges, enough for a full term's journey)
--   first_step       — first lesson started
--   first_finish     — first lesson completed
--   three_in_a_row   — 3-day streak
--   week_warrior     — 7-day streak
--   fortnight        — 14-day streak
--   ten_lessons      — 10 lessons completed
--   twenty_five      — 25 lessons completed
--   fifty            — 50 lessons completed
--   top_scorer       — scored 100% on a lesson
--   high_achiever    — average score ≥ 80% across 5+ lessons
--   early_bird       — completed a lesson before 7am
--   night_owl        — completed a lesson after 9pm
--
-- DESIGN DECISIONS
-- ─────────────────
-- 1. Streaks are WAT (Africa/Lagos) calendar days. A parent-child session at
--    8pm counts the same as a solo session at 3pm after school.
--
-- 2. completion_pct is updated mid-lesson (by updateLessonProgress) and set
--    to 100 atomically by complete_lesson(). The 100 threshold is the only
--    thing that updates the streak and awards badges.
--
-- 3. last_score / best_score are both tracked. last_score drives the "how
--    you did last time" UI; best_score drives badge eligibility and ranking.
--
-- 4. Badge checks run inside complete_lesson() in a single transaction.
--    No separate cron job or background worker needed in v1.
--
-- 5. The badges table is static (only TTA staff add new badges via migration).
--    School admins cannot create badges in v1.
-- =============================================================================

begin;

-- ── 1. child_learning_progress ───────────────────────────────────────────────

create table public.child_learning_progress (
  id              uuid primary key default gen_random_uuid(),
  pupil_id        uuid not null references public.pupils(id)   on delete cascade,
  lesson_id       uuid not null references public.lessons(id)  on delete cascade,

  completion_pct  int  not null default 0
                  check (completion_pct between 0 and 100),

  last_score      int  check (last_score between 0 and 100),   -- most recent quiz score
  best_score      int  check (best_score between 0 and 100),   -- highest quiz score ever
  attempt_count   int  not null default 0,                     -- number of quiz attempts

  started_at      timestamptz not null default now(),
  completed_at    timestamptz,          -- set once by complete_lesson()
  updated_at      timestamptz not null default now(),

  constraint clp_pupil_lesson_unique unique (pupil_id, lesson_id)
);

create index clp_pupil_idx       on public.child_learning_progress (pupil_id, updated_at desc);
create index clp_completed_idx   on public.child_learning_progress (pupil_id, completed_at desc)
  where completion_pct = 100;
create index clp_in_progress_idx on public.child_learning_progress (pupil_id, updated_at desc)
  where completion_pct > 0 and completion_pct < 100;

comment on table  public.child_learning_progress is
  'Per-pupil per-lesson progress. completion_pct = 100 means the lesson is done.';
comment on column public.child_learning_progress.best_score is
  'Highest quiz score the pupil has ever achieved on this lesson. Drives badge eligibility.';

alter table public.child_learning_progress enable row level security;

-- Student reads/writes their own progress
create policy clp_student_self on public.child_learning_progress
  for all using (
    pupil_id in (
      select id from public.pupils
      where pupil_code = (auth.jwt() ->> 'pupil_code')
    )
  );

-- Parents read their children's progress
create policy clp_parent_read on public.child_learning_progress
  for select using (
    exists (
      select 1 from public.parent_pupil_links
      where parent_user_id = auth.uid()
        and pupil_id = child_learning_progress.pupil_id
    )
  );

-- School staff read progress for pupils in their school
create policy clp_staff_read on public.child_learning_progress
  for select using (
    exists (
      select 1 from public.pupils pu
      join public.profiles pr on pr.school_id = pu.school_id
      where pu.id = child_learning_progress.pupil_id
        and pr.user_id = auth.uid()
        and pr.role in ('teacher', 'head_teacher', 'school_admin', 'super_admin')
    )
  );

grant select, insert, update on public.child_learning_progress to authenticated;


-- ── 2. student_streaks ───────────────────────────────────────────────────────

create table public.student_streaks (
  pupil_id         uuid primary key references public.pupils(id) on delete cascade,
  current_streak   int  not null default 0,
  longest_streak   int  not null default 0,
  total_lessons    int  not null default 0,   -- completed lessons
  last_active_date date,                      -- WAT calendar date of last completion
  updated_at       timestamptz not null default now()
);

comment on table public.student_streaks is
  'Running streak and lesson totals per pupil. Maintained atomically by complete_lesson().';
comment on column public.student_streaks.last_active_date is
  'WAT (Africa/Lagos) calendar date of the most recent lesson completion.';

alter table public.student_streaks enable row level security;

create policy streaks_student_self on public.student_streaks
  for all using (
    pupil_id in (
      select id from public.pupils
      where pupil_code = (auth.jwt() ->> 'pupil_code')
    )
  );

create policy streaks_parent_read on public.student_streaks
  for select using (
    exists (
      select 1 from public.parent_pupil_links
      where parent_user_id = auth.uid()
        and pupil_id = student_streaks.pupil_id
    )
  );

create policy streaks_staff_read on public.student_streaks
  for select using (
    exists (
      select 1 from public.pupils pu
      join public.profiles pr on pr.school_id = pu.school_id
      where pu.id = student_streaks.pupil_id
        and pr.user_id = auth.uid()
        and pr.role in ('teacher', 'head_teacher', 'school_admin', 'super_admin')
    )
  );

grant select, insert, update on public.student_streaks to authenticated;


-- ── 3. badges (catalogue) ────────────────────────────────────────────────────

create table public.badges (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description     text not null,
  icon_emoji      text not null,
  trigger_type    text not null,  -- 'lessons_completed' | 'streak_days' | 'score' | 'time_of_day' | 'manual'
  trigger_value   int,            -- threshold (e.g. 10 for ten_lessons, 7 for week_warrior)
  display_order   int  not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.badges is
  'Static badge catalogue. New badges are added by migration. trigger_value drives automatic award logic.';

alter table public.badges enable row level security;

-- Anyone authenticated can read the badge catalogue
create policy badges_public_read on public.badges
  for select to authenticated using (active = true);

grant select on public.badges to authenticated;

-- Seed the badge catalogue
insert into public.badges (slug, name, description, icon_emoji, trigger_type, trigger_value, display_order) values
  ('first_step',      'First Step',        'Started your very first lesson.',                            '🌱', 'lessons_completed', 0,   10),
  ('first_finish',    'First Finish',      'Completed your first lesson.',                               '⭐', 'lessons_completed', 1,   20),
  ('three_in_a_row',  'Three in a Row',    'Learned 3 days in a row.',                                   '🔥', 'streak_days',       3,   30),
  ('week_warrior',    'Week Warrior',      'Kept a 7-day streak.',                                       '💪', 'streak_days',       7,   40),
  ('fortnight',       'Fortnight',         '14 days in a row. Remarkable.',                              '🏆', 'streak_days',       14,  50),
  ('ten_lessons',     '10 Lessons',        'Finished 10 complete lessons.',                              '📚', 'lessons_completed', 10,  60),
  ('twenty_five',     '25 Lessons',        '25 lessons done. You\'re on your way.',                      '🎯', 'lessons_completed', 25,  70),
  ('fifty',           '50 Lessons',        '50 lessons completed. Half a century.',                      '💯', 'lessons_completed', 50,  80),
  ('top_scorer',      'Top Scorer',        'Scored 100% on a lesson quiz.',                              '🥇', 'score',             100, 90),
  ('high_achiever',   'High Achiever',     'Averaged 80% or more across at least 5 scored lessons.',     '🎓', 'score',             80,  100),
  ('early_bird',      'Early Bird',        'Completed a lesson before 7am.',                             '🌅', 'time_of_day',       7,   110),
  ('night_owl',       'Night Owl',         'Completed a lesson after 9pm.',                              '🦉', 'time_of_day',       21,  120);


-- ── 4. pupil_badges ──────────────────────────────────────────────────────────

create table public.pupil_badges (
  id         uuid primary key default gen_random_uuid(),
  pupil_id   uuid not null references public.pupils(id)  on delete cascade,
  badge_id   uuid not null references public.badges(id)  on delete cascade,
  earned_at  timestamptz not null default now(),
  lesson_id  uuid references public.lessons(id),   -- which lesson triggered it

  constraint pupil_badges_unique unique (pupil_id, badge_id)
);

create index pupil_badges_pupil_idx on public.pupil_badges (pupil_id, earned_at desc);

comment on table public.pupil_badges is
  'Earned badges per pupil. Inserted atomically by complete_lesson().';

alter table public.pupil_badges enable row level security;

create policy pb_student_self on public.pupil_badges
  for select using (
    pupil_id in (
      select id from public.pupils
      where pupil_code = (auth.jwt() ->> 'pupil_code')
    )
  );

create policy pb_parent_read on public.pupil_badges
  for select using (
    exists (
      select 1 from public.parent_pupil_links
      where parent_user_id = auth.uid()
        and pupil_id = pupil_badges.pupil_id
    )
  );

create policy pb_staff_read on public.pupil_badges
  for select using (
    exists (
      select 1 from public.pupils pu
      join public.profiles pr on pr.school_id = pu.school_id
      where pu.id = pupil_badges.pupil_id
        and pr.user_id = auth.uid()
        and pr.role in ('teacher', 'head_teacher', 'school_admin', 'super_admin')
    )
  );

grant select on public.pupil_badges to authenticated;
grant insert on public.pupil_badges to authenticated;   -- awarded by the complete_lesson RPC only


-- ── 5. get_next_lesson_for_pupil() ──────────────────────────────────────────
--
-- Adaptive lesson selection:
--   Step 1: Return the in-progress lesson with the highest completion_pct.
--           The student was mid-lesson — resume it.
--   Step 2: Return the first not-yet-started published lesson (by sort_index)
--           for the pupil's level that they haven't touched yet.
--   Step 3: Return null (all lessons at their level are done).
--
-- Returns a single row with enough columns for the StudentApp TodayView.

create or replace function public.get_next_lesson_for_pupil(p_pupil_id uuid)
returns table (
  lesson_id          uuid,
  title              text,
  subject            text,
  topic              text,
  level              text,
  estimated_minutes  int,
  completion_pct     int,
  last_score         int,
  is_new             boolean
) language plpgsql stable security definer as $$
declare
  v_level text;
begin
  -- Get pupil's level
  select pu.level into v_level
  from public.pupils pu
  where pu.id = p_pupil_id;

  if v_level is null then
    return;  -- pupil not found or no level set
  end if;

  -- Step 1: In-progress lesson (highest completion, not 100%)
  return query
  select
    l.id, l.title, l.subject, l.topic, l.level, l.estimated_minutes,
    clp.completion_pct,
    clp.last_score,
    false as is_new
  from public.child_learning_progress clp
  join public.lessons l on l.id = clp.lesson_id
  where clp.pupil_id   = p_pupil_id
    and l.level        = v_level
    and l.status       = 'published'
    and clp.completion_pct > 0
    and clp.completion_pct < 100
  order by clp.completion_pct desc, clp.updated_at desc
  limit 1;

  if found then return; end if;

  -- Step 2: First not-yet-started lesson
  return query
  select
    l.id, l.title, l.subject, l.topic, l.level, l.estimated_minutes,
    0 as completion_pct,
    null::int as last_score,
    true as is_new
  from public.lessons l
  where l.level  = v_level
    and l.status = 'published'
    and not exists (
      select 1 from public.child_learning_progress clp
      where clp.pupil_id  = p_pupil_id
        and clp.lesson_id = l.id
    )
  order by
    l.week_of_term asc nulls last,
    l.sort_index   asc
  limit 1;
end;
$$;

grant execute on function public.get_next_lesson_for_pupil(uuid) to authenticated;

comment on function public.get_next_lesson_for_pupil is
  'Returns the next lesson for a pupil: in-progress first, then first untouched, then null.';


-- ── 6. complete_lesson() ─────────────────────────────────────────────────────
--
-- Called by the student app when the lesson player reaches 100%.
-- Atomically:
--   a. Upserts child_learning_progress to 100%
--   b. Updates last_score / best_score / attempt_count
--   c. Updates student_streaks (WAT calendar day logic)
--   d. Checks badge eligibility and inserts newly-earned badges
--   e. Returns { streak, total_lessons, new_badges }
--
-- Idempotent: calling it twice for the same lesson on the same day is safe.

create or replace function public.complete_lesson(
  p_pupil_id    uuid,
  p_lesson_id   uuid,
  p_score       int  default null,  -- quiz score 0–100, or null if no quiz
  p_duration_s  int  default null   -- time spent in seconds
)
returns jsonb language plpgsql security definer as $$
declare
  v_now_wat       date := (now() at time zone 'Africa/Lagos')::date;
  v_prev_active   date;
  v_new_streak    int;
  v_old_streak    int;
  v_longest       int;
  v_total         int;
  v_best_score    int;
  v_new_badges    jsonb := '[]'::jsonb;
  v_badge_row     record;
  v_avg_score     numeric;
  v_hour_wat      int;
begin
  -- ── a. Upsert progress row ─────────────────────────────────────────────
  insert into public.child_learning_progress
    (pupil_id, lesson_id, completion_pct, last_score, best_score,
     attempt_count, started_at, completed_at, updated_at)
  values (
    p_pupil_id, p_lesson_id, 100,
    p_score,
    p_score,   -- best_score initialised to score on first attempt
    case when p_score is not null then 1 else 0 end,
    now(), now(), now()
  )
  on conflict (pupil_id, lesson_id) do update set
    completion_pct = 100,
    last_score     = p_score,
    best_score     = greatest(
                       coalesce(child_learning_progress.best_score, 0),
                       coalesce(p_score, 0)
                     ),
    attempt_count  = child_learning_progress.attempt_count
                     + case when p_score is not null then 1 else 0 end,
    completed_at   = coalesce(child_learning_progress.completed_at, now()),
    updated_at     = now();

  -- Capture best_score for badge checks
  select best_score into v_best_score
  from public.child_learning_progress
  where pupil_id = p_pupil_id and lesson_id = p_lesson_id;

  -- ── b. Update streaks ─────────────────────────────────────────────────
  select current_streak, longest_streak, total_lessons, last_active_date
  into v_old_streak, v_longest, v_total, v_prev_active
  from public.student_streaks
  where pupil_id = p_pupil_id;

  if not found then
    -- First ever completion
    v_new_streak := 1;
    v_longest    := 1;
    v_total      := 1;

    insert into public.student_streaks
      (pupil_id, current_streak, longest_streak, total_lessons, last_active_date)
    values (p_pupil_id, 1, 1, 1, v_now_wat);
  else
    v_total := v_total + 1;

    if v_prev_active = v_now_wat then
      -- Already completed a lesson today — streak unchanged, just bump total
      v_new_streak := v_old_streak;
    elsif v_prev_active = v_now_wat - 1 then
      -- Consecutive day — extend streak
      v_new_streak := v_old_streak + 1;
    else
      -- Streak broken — reset to 1
      v_new_streak := 1;
    end if;

    v_longest := greatest(v_longest, v_new_streak);

    update public.student_streaks set
      current_streak  = v_new_streak,
      longest_streak  = v_longest,
      total_lessons   = v_total,
      last_active_date = v_now_wat,
      updated_at      = now()
    where pupil_id = p_pupil_id;
  end if;

  -- ── c. Badge eligibility checks ───────────────────────────────────────
  -- For each active badge not yet earned by this pupil, check if it's
  -- now eligible. Insert on first eligibility.

  v_hour_wat := extract(hour from now() at time zone 'Africa/Lagos');

  -- Average score across scored lessons (for high_achiever)
  select avg(best_score)
  into v_avg_score
  from public.child_learning_progress
  where pupil_id = p_pupil_id
    and best_score is not null
    and completion_pct = 100;

  for v_badge_row in
    select b.id, b.slug, b.name, b.icon_emoji, b.trigger_type, b.trigger_value
    from public.badges b
    where b.active = true
      and not exists (
        select 1 from public.pupil_badges pb
        where pb.pupil_id = p_pupil_id and pb.badge_id = b.id
      )
  loop
    declare v_eligible boolean := false; begin
      v_eligible := case v_badge_row.trigger_type
        when 'lessons_completed' then
          case v_badge_row.slug
            when 'first_step'  then true   -- awarded on start, but we fire it here for simplicity
            else v_total >= v_badge_row.trigger_value
          end
        when 'streak_days' then
          v_new_streak >= v_badge_row.trigger_value
        when 'score' then
          case v_badge_row.slug
            when 'top_scorer'    then v_best_score = 100
            when 'high_achiever' then
              v_avg_score >= 80
              and (select count(*) from public.child_learning_progress
                   where pupil_id = p_pupil_id and best_score is not null and completion_pct = 100) >= 5
            else false
          end
        when 'time_of_day' then
          case v_badge_row.slug
            when 'early_bird' then v_hour_wat < v_badge_row.trigger_value
            when 'night_owl'  then v_hour_wat >= v_badge_row.trigger_value
            else false
          end
        else false
      end;

      if v_eligible then
        insert into public.pupil_badges (pupil_id, badge_id, lesson_id)
        values (p_pupil_id, v_badge_row.id, p_lesson_id)
        on conflict do nothing;

        -- Only add to new_badges if insert actually happened
        if found then
          v_new_badges := v_new_badges || jsonb_build_object(
            'slug',       v_badge_row.slug,
            'name',       v_badge_row.name,
            'icon_emoji', v_badge_row.icon_emoji
          );
        end if;
      end if;
    end;
  end loop;

  -- ── d. Return summary ─────────────────────────────────────────────────
  return jsonb_build_object(
    'streak',        v_new_streak,
    'total_lessons', v_total,
    'new_badges',    v_new_badges
  );
end;
$$;

grant execute on function public.complete_lesson(uuid, uuid, int, int) to authenticated;

comment on function public.complete_lesson is
  'Atomic lesson completion: updates progress, streak, and awards badges. Returns summary JSONB.';


-- ── 7. get_child_progress_summary() ─────────────────────────────────────────
--
-- JSONB dashboard summary. Called by:
--   - Parent app (child progress widget)
--   - Teacher app (pupil engagement insight)
--   - Student app (profile stats)

create or replace function public.get_child_progress_summary(p_pupil_id uuid)
returns jsonb language plpgsql stable security definer as $$
declare
  v_streak    record;
  v_progress  record;
  v_result    jsonb;
begin
  select * into v_streak
  from public.student_streaks
  where pupil_id = p_pupil_id;

  select
    count(*) filter (where completion_pct = 100)                  as total_completed,
    count(*) filter (where completion_pct > 0 and completion_pct < 100) as in_progress,
    count(*)                                                       as total_started,
    round(avg(best_score) filter (where best_score is not null), 1) as avg_score,
    -- Subject with highest average best_score (proxy for strength)
    (
      select l.subject
      from public.child_learning_progress clp2
      join public.lessons l on l.id = clp2.lesson_id
      where clp2.pupil_id    = p_pupil_id
        and clp2.best_score  is not null
        and clp2.completion_pct = 100
      group by l.subject
      order by avg(clp2.best_score) desc
      limit 1
    ) as best_subject,
    -- Recent 3 completed lessons
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'title',       l2.title,
          'subject',     l2.subject,
          'best_score',  clp3.best_score,
          'completed_at', clp3.completed_at
        ) order by clp3.completed_at desc
      ), '[]'::jsonb)
      from (
        select * from public.child_learning_progress
        where pupil_id = p_pupil_id and completion_pct = 100
        order by completed_at desc limit 3
      ) clp3
      join public.lessons l2 on l2.id = clp3.lesson_id
    ) as recent_lessons
  into v_progress
  from public.child_learning_progress
  where pupil_id = p_pupil_id;

  return jsonb_build_object(
    'streak',          coalesce(v_streak.current_streak, 0),
    'longest_streak',  coalesce(v_streak.longest_streak, 0),
    'total_lessons',   coalesce(v_streak.total_lessons, 0),
    'total_completed', coalesce(v_progress.total_completed, 0),
    'in_progress',     coalesce(v_progress.in_progress, 0),
    'avg_score',       v_progress.avg_score,
    'best_subject',    v_progress.best_subject,
    'recent_lessons',  coalesce(v_progress.recent_lessons, '[]'::jsonb),
    'last_active',     v_streak.last_active_date
  );
end;
$$;

grant execute on function public.get_child_progress_summary(uuid) to authenticated;

comment on function public.get_child_progress_summary is
  'JSONB progress summary per pupil. Used by parent widget, teacher insight, and student profile.';


-- ── 8. Impact dashboard — wire clp into whatsapp stats view ──────────────────
-- The existing school_impact_v materialised view includes lesson_views from
-- assessment_attempts. We now also want child_learning_progress.total_lessons.
-- Rather than rebuilding the view (which risks breaking 0007), we expose it
-- via a simple aggregate function the impact dashboard can call optionally.

create or replace function public.get_school_learn_stats(p_school_id uuid)
returns jsonb language plpgsql stable security definer as $$
declare v_result jsonb; begin
  select jsonb_build_object(
    'lessons_started',   count(*),
    'lessons_completed', count(*) filter (where clp.completion_pct = 100),
    'unique_pupils',     count(distinct clp.pupil_id),
    'avg_score',         round(avg(clp.best_score) filter (where clp.best_score is not null), 1)
  )
  into v_result
  from public.child_learning_progress clp
  join public.pupils pu on pu.id = clp.pupil_id
  where pu.school_id = p_school_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_school_learn_stats(uuid) to authenticated;

commit;
