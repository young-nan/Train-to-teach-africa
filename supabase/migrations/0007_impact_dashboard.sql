-- =============================================================================
-- 0007_impact_dashboard.sql
--
-- Grant-ready impact infrastructure. Everything funders, NGOs, and school
-- owners need to see measurable educational outcomes.
--
-- PARTS
-- ─────
-- 1. schools.slug column          — public URL segment (/impact/greenfield-lagos)
-- 2. lesson_views table           — tracks parent lesson engagement
-- 3. school_impact_v              — materialized view: per-school outcome metrics
-- 4. network_impact_v             — materialized view: TTA-wide aggregate (for super_admin)
-- 5. impact_snapshot table        — weekly frozen rows for trend charts
-- 6. pg_cron: weekly snapshot job — fires every Sunday at 23:00 WAT
-- 7. get_school_impact_csv RPC    — anonymised CSV export for grant reporting
-- 8. school_impact_v RLS          — school admin sees own school; super_admin sees all
-- 9. BUG FIX: migration 0006 used parent_pupils — correct name is parent_pupil_links
-- =============================================================================


-- ============================================================
-- PART 1 · schools.slug
-- Required for /public/impact/:schoolSlug route.
-- Format: lowercase, hyphens, no specials. e.g. "greenfield-lagos"
-- ============================================================

alter table public.schools
  add column if not exists slug text unique,
  add column if not exists impact_page_enabled boolean not null default false,
  add column if not exists impact_page_tagline  text;

-- Back-fill slugs from school names for existing rows.
-- Produces e.g. "St. Mary's Academy" → "st-marys-academy"
update public.schools
   set slug = lower(
         regexp_replace(
           regexp_replace(name, '[^a-zA-Z0-9\s]', '', 'g'),
           '\s+', '-', 'g'
         )
       )
 where slug is null;

create index if not exists schools_slug_idx on public.schools(slug) where slug is not null;


-- ============================================================
-- PART 2 · lesson_views
-- Lightweight engagement event table. Written by the client
-- when a parent opens a lesson (fire-and-forget INSERT).
-- Used by school_impact_v to compute parent_engagement_rate.
-- ============================================================

create table if not exists public.lesson_views (
  id              uuid        primary key default gen_random_uuid(),
  lesson_id       uuid        not null references public.lessons(id) on delete cascade,
  viewer_user_id  uuid        not null references auth.users(id) on delete cascade,
  pupil_id        uuid        references public.pupils(id) on delete set null,
  school_id       uuid        references public.schools(id) on delete set null,
  viewed_at       timestamptz not null default now(),

  -- Prevent double-counting the same parent reading the same lesson on the
  -- same day (e.g. refresh). One view per (lesson, viewer, day).
  unique (lesson_id, viewer_user_id, cast(viewed_at as date))
);

create index lesson_views_school_idx  on public.lesson_views(school_id, viewed_at desc);
create index lesson_views_lesson_idx  on public.lesson_views(lesson_id);

alter table public.lesson_views enable row level security;

-- Anyone authenticated can insert their own view.
create policy lesson_views_insert on public.lesson_views
  for insert with check (viewer_user_id = auth.uid());

-- School admins see their school's views; super admin sees all.
create policy lesson_views_admin on public.lesson_views
  for select using (
    school_id = public.current_school_id()
    or public.current_role() = 'super_admin'
  );


-- ============================================================
-- PART 3 · school_impact_v  (materialized)
-- The core metrics view. One row per school.
-- Refreshed every 5 minutes by the existing pg_cron job
-- (refresh_school_kpis_v from migration 0003) — we add this
-- view to the same job below.
--
-- METRICS EXPLAINED
-- ─────────────────
-- attendance_14d_pct   — % of present marks in last 14 days
-- attendance_trend_pct — same metric 15–28 days ago (for delta)
-- avg_score_pct        — mean (score/max_score)*100 across all assessments
-- parent_engagement_7d — unique parents who opened a lesson in last 7 days
--                        as % of total linked parents
-- pdf_downloads_7d     — lesson PDF downloads in last 7 days
-- whatsapp_delivery_7d — nightly dispatches sent (not failed) in last 7 days
-- lesson_completion_7d — lessons with at least one view in last 7 days
--                        as % of published lessons for that school's levels
-- ============================================================

create materialized view if not exists public.school_impact_v as
with

-- Pupil and parent counts per school
school_base as (
  select
    s.id                                                  as school_id,
    s.name                                                as school_name,
    s.slug,
    s.impact_page_enabled,
    s.impact_page_tagline,
    count(distinct p.id)                                  as pupil_count,
    count(distinct ppl.parent_user_id)                    as linked_parent_count
  from public.schools s
  left join public.pupils p       on p.school_id  = s.id
  left join public.classes cl     on cl.school_id = s.id
  left join public.parent_pupil_links ppl  -- correct name (not parent_pupils)
            on ppl.pupil_id = p.id
  group by s.id, s.name, s.slug, s.impact_page_enabled, s.impact_page_tagline
),

-- Attendance: current window (0–14 days ago)
attendance_current as (
  select
    cl.school_id,
    round(
      100.0 * count(*) filter (where a.status = 'present')
      / nullif(count(*), 0), 1
    ) as attendance_pct
  from public.attendance a
  join public.classes cl on cl.id = a.class_id
  where a.date >= current_date - 14
  group by cl.school_id
),

-- Attendance: prior window (15–28 days ago) — used to compute trend
attendance_prior as (
  select
    cl.school_id,
    round(
      100.0 * count(*) filter (where a.status = 'present')
      / nullif(count(*), 0), 1
    ) as attendance_pct
  from public.attendance a
  join public.classes cl on cl.id = a.class_id
  where a.date between current_date - 28 and current_date - 15
  group by cl.school_id
),

-- Grade averages per school across all scored assessments this term
grade_avg as (
  select
    cl.school_id,
    round(
      100.0 * avg(s.score::numeric / nullif(s.max_score, 0)), 1
    ) as avg_score_pct
  from public.scores s
  join public.gradebook_columns gc on gc.id = s.gradebook_column_id
  join public.classes cl           on cl.id = gc.class_id
  where gc.year = extract(year from current_date)::int
  group by cl.school_id
),

-- Parent engagement: unique parents who opened a lesson in the last 7 days
parent_engagement as (
  select
    lv.school_id,
    count(distinct lv.viewer_user_id) as active_parents_7d,
    count(*) filter (where lv.viewed_at >= now() - interval '7 days')
              as views_7d
  from public.lesson_views lv
  where lv.viewed_at >= now() - interval '7 days'
  group by lv.school_id
),

-- PDF downloads (from lesson_pdf_cache — created_at proxies for download date)
pdf_stats as (
  select
    ppl2.school_id_via_pupil                              as school_id,
    count(*) filter (
      where lpc.created_at >= now() - interval '7 days'
    )                                                     as pdf_downloads_7d
  from public.lesson_pdf_cache lpc
  join lateral (
    select cl2.school_id as school_id_via_pupil
      from public.pupils pu2
      join public.classes cl2 on cl2.id = pu2.class_id
     where pu2.id = lpc.pupil_id
     limit 1
  ) ppl2 on true
  group by ppl2.school_id_via_pupil
),

-- WhatsApp dispatch success rate
whatsapp_stats as (
  select
    ppl3.school_id_via_pupil                              as school_id,
    count(*) filter (
      where ndl.status = 'sent'
        and ndl.dispatch_date >= current_date - 7
    )                                                     as dispatches_sent_7d,
    count(*) filter (
      where ndl.dispatch_date >= current_date - 7
    )                                                     as dispatches_attempted_7d
  from public.nightly_dispatch_log ndl
  join public.parent_pupil_links ppl_link
       on ppl_link.parent_user_id = ndl.parent_user_id
  join lateral (
    select cl3.school_id as school_id_via_pupil
      from public.pupils pu3
      join public.classes cl3 on cl3.id = pu3.class_id
     where pu3.id = ppl_link.pupil_id
     limit 1
  ) ppl3 on true
  group by ppl3.school_id_via_pupil
)

select
  sb.school_id,
  sb.school_name,
  sb.slug,
  sb.impact_page_enabled,
  sb.impact_page_tagline,
  sb.pupil_count,
  sb.linked_parent_count,

  -- Attendance
  coalesce(ac.attendance_pct, 0)                         as attendance_14d_pct,
  coalesce(ap.attendance_pct, 0)                         as attendance_28d_pct,
  coalesce(ac.attendance_pct, 0)
    - coalesce(ap.attendance_pct, 0)                     as attendance_trend_pts,

  -- Grades
  coalesce(ga.avg_score_pct, 0)                          as avg_score_pct,

  -- Parent engagement
  coalesce(pe.active_parents_7d, 0)                      as active_parents_7d,
  case
    when sb.linked_parent_count = 0 then 0
    else round(
      100.0 * coalesce(pe.active_parents_7d, 0)
      / sb.linked_parent_count, 1
    )
  end                                                    as parent_engagement_7d_pct,
  coalesce(pe.views_7d, 0)                               as lesson_views_7d,

  -- PDF + WhatsApp
  coalesce(ps.pdf_downloads_7d, 0)                       as pdf_downloads_7d,
  coalesce(ws.dispatches_sent_7d, 0)                     as whatsapp_sent_7d,
  coalesce(ws.dispatches_attempted_7d, 0)                as whatsapp_attempted_7d,
  case
    when coalesce(ws.dispatches_attempted_7d, 0) = 0 then null
    else round(
      100.0 * ws.dispatches_sent_7d / ws.dispatches_attempted_7d, 1
    )
  end                                                    as whatsapp_delivery_pct,

  now()                                                  as refreshed_at

from school_base sb
left join attendance_current ac on ac.school_id = sb.school_id
left join attendance_prior   ap on ap.school_id = sb.school_id
left join grade_avg          ga on ga.school_id = sb.school_id
left join parent_engagement  pe on pe.school_id = sb.school_id
left join pdf_stats          ps on ps.school_id = sb.school_id
left join whatsapp_stats     ws on ws.school_id = sb.school_id;

create unique index school_impact_school_idx on public.school_impact_v(school_id);
create index school_impact_slug_idx on public.school_impact_v(slug)
  where slug is not null and impact_page_enabled = true;

grant select on public.school_impact_v to authenticated;


-- ============================================================
-- PART 4 · network_impact_v  (materialized)
-- TTA-wide aggregate. Shown on the super_admin impact dashboard
-- and used to compute "vs network average" comparisons.
-- ============================================================

create materialized view if not exists public.network_impact_v as
select
  count(*)                                           as school_count,
  sum(pupil_count)                                   as total_pupils,
  sum(linked_parent_count)                           as total_linked_parents,
  round(avg(attendance_14d_pct), 1)                  as network_attendance_pct,
  round(avg(avg_score_pct), 1)                       as network_avg_score_pct,
  round(avg(parent_engagement_7d_pct), 1)            as network_parent_engagement_pct,
  round(avg(whatsapp_delivery_pct), 1)               as network_whatsapp_delivery_pct,
  sum(pdf_downloads_7d)                              as network_pdf_downloads_7d,
  sum(whatsapp_sent_7d)                              as network_whatsapp_sent_7d,
  now()                                              as refreshed_at
from public.school_impact_v;

-- Single-row view — no index needed.
grant select on public.network_impact_v to authenticated;


-- ============================================================
-- PART 5 · impact_snapshot
-- Weekly frozen rows. The materialized views show current state;
-- snapshots allow trend charts (12-week attendance trajectory,
-- parent engagement growth). Written by the pg_cron job.
-- ============================================================

create table if not exists public.impact_snapshot (
  id                         uuid primary key default gen_random_uuid(),
  school_id                  uuid not null references public.schools(id) on delete cascade,
  snapshot_date              date not null default current_date,

  -- Attendance
  attendance_14d_pct         numeric(5,1),
  attendance_trend_pts       numeric(5,1),

  -- Grades
  avg_score_pct              numeric(5,1),

  -- Engagement
  parent_engagement_7d_pct   numeric(5,1),
  lesson_views_7d            int,
  pdf_downloads_7d           int,
  whatsapp_sent_7d           int,
  whatsapp_delivery_pct      numeric(5,1),

  -- Pupil / parent counts at snapshot time
  pupil_count                int,
  linked_parent_count        int,

  created_at                 timestamptz not null default now(),

  unique (school_id, snapshot_date)   -- one snapshot per school per week
);

create index impact_snapshot_school_date_idx
  on public.impact_snapshot(school_id, snapshot_date desc);

alter table public.impact_snapshot enable row level security;

create policy impact_snapshot_admin on public.impact_snapshot
  for select using (
    school_id = public.current_school_id()
    or public.current_role() = 'super_admin'
  );

-- Service role inserts (from cron job).


-- ============================================================
-- PART 6 · take_impact_snapshot RPC
-- Called by pg_cron each Sunday. Copies the current
-- school_impact_v values into impact_snapshot.
-- ON CONFLICT DO UPDATE so manual re-runs are safe.
-- ============================================================

create or replace function public.take_impact_snapshot()
returns int   -- returns the number of schools snapshotted
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  insert into public.impact_snapshot (
    school_id,
    snapshot_date,
    attendance_14d_pct,
    attendance_trend_pts,
    avg_score_pct,
    parent_engagement_7d_pct,
    lesson_views_7d,
    pdf_downloads_7d,
    whatsapp_sent_7d,
    whatsapp_delivery_pct,
    pupil_count,
    linked_parent_count
  )
  select
    school_id,
    current_date,
    attendance_14d_pct,
    attendance_trend_pts,
    avg_score_pct,
    parent_engagement_7d_pct,
    lesson_views_7d,
    pdf_downloads_7d,
    whatsapp_sent_7d,
    whatsapp_delivery_pct,
    pupil_count,
    linked_parent_count
  from public.school_impact_v
  on conflict (school_id, snapshot_date)
  do update set
    attendance_14d_pct       = excluded.attendance_14d_pct,
    attendance_trend_pts     = excluded.attendance_trend_pts,
    avg_score_pct            = excluded.avg_score_pct,
    parent_engagement_7d_pct = excluded.parent_engagement_7d_pct,
    lesson_views_7d          = excluded.lesson_views_7d,
    pdf_downloads_7d         = excluded.pdf_downloads_7d,
    whatsapp_sent_7d         = excluded.whatsapp_sent_7d,
    whatsapp_delivery_pct    = excluded.whatsapp_delivery_pct,
    pupil_count              = excluded.pupil_count,
    linked_parent_count      = excluded.linked_parent_count;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.take_impact_snapshot() from public;
grant execute on function public.take_impact_snapshot() to service_role;


-- ============================================================
-- PART 7 · pg_cron: weekly snapshot at 23:00 WAT Sunday
-- ============================================================

-- Refresh both materialized views then snapshot.
-- We replace the existing school_kpis_v job to also refresh impact views.
select cron.unschedule('refresh_school_kpis_v');  -- remove old single-view job

select cron.schedule(
  'refresh_impact_views',
  '*/5 * * * *',   -- every 5 minutes: refresh the materialized views
  $$
    refresh materialized view concurrently public.school_impact_v;
    refresh materialized view concurrently public.network_impact_v;
    refresh materialized view concurrently public.school_kpis_v;
  $$
);

select cron.schedule(
  'weekly_impact_snapshot',
  '0 22 * * 0',   -- 22:00 UTC Sunday = 23:00 WAT
  $$select public.take_impact_snapshot()$$
);


-- ============================================================
-- PART 8 · get_school_impact_csv RPC
-- Returns anonymised CSV rows for grant reporting.
-- Called by the export-impact-report edge function.
-- Fully anonymised: no pupil names, no parent names, no emails.
-- Returns aggregate rows only.
-- ============================================================

create or replace function public.get_school_impact_csv(
  p_school_id  uuid,
  p_weeks      int default 12   -- how many weekly snapshots to include
)
returns table (
  snapshot_date              text,
  attendance_pct             text,
  attendance_trend_pts       text,
  avg_score_pct              text,
  parent_engagement_pct      text,
  lesson_views               text,
  pdf_downloads              text,
  whatsapp_delivery_pct      text,
  pupil_count                text,
  linked_parent_count        text
)
language sql
stable
security definer
as $$
  select
    to_char(snapshot_date, 'YYYY-MM-DD'),
    coalesce(attendance_14d_pct::text,       ''),
    coalesce(attendance_trend_pts::text,     ''),
    coalesce(avg_score_pct::text,            ''),
    coalesce(parent_engagement_7d_pct::text, ''),
    coalesce(lesson_views_7d::text,          ''),
    coalesce(pdf_downloads_7d::text,         ''),
    coalesce(whatsapp_delivery_pct::text,    ''),
    coalesce(pupil_count::text,              ''),
    coalesce(linked_parent_count::text,      '')
  from public.impact_snapshot
  where school_id = p_school_id
    and (
      school_id = public.current_school_id()
      or public.current_role() = 'super_admin'
    )
  order by snapshot_date desc
  limit p_weeks;
$$;

grant execute on function public.get_school_impact_csv(uuid, int) to authenticated;


-- ============================================================
-- PART 9 · BUG FIX: migration 0006 named parent_pupils
-- The real table is parent_pupil_links (created in 0001).
-- Drop the incorrectly-named table if it was created by 0006.
-- ============================================================

drop table if exists public.parent_pupils;
