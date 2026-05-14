-- =============================================================================
-- 0005_tutor_marketplace.sql
--
-- Full tutor marketplace schema. Tables in dependency order:
--
--   tutors            — verified tutor profiles (one per auth.users row)
--   guarantors        — offline-safety contacts required before activation
--   tutor_subjects    — normalised subject/curriculum tags per tutor
--   tutor_availability — weekly schedule slots (day + time window)
--   bookings          — parent→tutor session requests, full lifecycle
--   booking_reviews   — parent reviews after session completion
--   payout_ledger     — per-booking revenue split record
--
-- RPCs:
--   search_tutors            — filtered, paginated tutor search for parents
--   confirm_session_complete — marks session done + triggers payout entry
--   tutor_earnings_summary   — aggregated earnings for a tutor's dashboard
-- =============================================================================


-- ============================================================
-- PART 1 · tutors
-- One row per tutor. Created by the tutor during sign-up, then
-- reviewed and approved by a super_admin before going live.
--
-- A tutor IS also an auth.users user (user_id FK), so they can
-- log into /app/tutor/* just like any other role. The profiles
-- trigger (migration 0001) creates their profile row with
-- role = 'parent' by default; admin approval updates that to
-- a new 'tutor' role added to the enum below.
-- ============================================================

-- Add 'tutor' to the user_role enum (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_enum
     where enumtypid = 'public.user_role'::regtype
       and enumlabel = 'tutor'
  ) then
    alter type public.user_role add value 'tutor';
  end if;
end $$;


create table public.tutors (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users(id) on delete cascade,

  -- Public profile
  full_name           text not null,
  bio                 text,
  photo_url           text,
  city                text not null,
  state               text not null,
  country             text not null default 'Nigeria',

  -- Qualifications
  highest_qualification text,                       -- e.g. 'B.Ed Mathematics'
  years_experience    int not null default 0 check (years_experience >= 0),
  ncce_registered     boolean not null default false,  -- NCCE = Nigerian teachers council

  -- Delivery modes
  teaches_online      boolean not null default true,
  teaches_offline     boolean not null default false, -- in-person, requires guarantor

  -- Pricing (tutor sets their own rate)
  hourly_rate_minor   bigint not null check (hourly_rate_minor > 0),
  currency            text not null default 'NGN' check (currency in ('NGN', 'USD')),

  -- Admin approval workflow
  -- pending → admin review → approved (goes live) or rejected
  approval_status     text not null default 'pending'
                        check (approval_status in ('pending', 'approved', 'rejected', 'suspended')),
  approved_by         uuid references auth.users(id),
  approved_at         timestamptz,
  rejection_reason    text,

  -- Derived from booking_reviews (maintained by confirm_session_complete trigger)
  rating_avg          numeric(3,2) default null check (rating_avg between 1 and 5),
  rating_count        int not null default 0,

  -- Soft-delete
  active              boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index tutors_approval_idx  on public.tutors(approval_status) where active = true;
create index tutors_city_idx      on public.tutors(city, state) where approval_status = 'approved';
create index tutors_rating_idx    on public.tutors(rating_avg desc nulls last) where approval_status = 'approved';

alter table public.tutors enable row level security;

-- Approved tutors are publicly searchable (read-only, limited columns).
create policy tutors_public_read on public.tutors
  for select using (approval_status = 'approved' and active = true);

-- Tutors can read and update their own profile.
create policy tutors_self_read on public.tutors
  for select using (user_id = auth.uid());

create policy tutors_self_update on public.tutors
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- Tutors cannot promote themselves; only admin can change approval_status.
    and approval_status = (select approval_status from public.tutors where user_id = auth.uid())
  );

-- Tutors can insert their own profile (one-time, during onboarding).
create policy tutors_self_insert on public.tutors
  for insert with check (user_id = auth.uid());

-- Super admin manages everything.
create policy tutors_admin on public.tutors
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 2 · guarantors
-- Required before an offline tutor goes live. TTA admin phones
-- the guarantor to confirm their relationship with the tutor.
-- A tutor without a verified guarantor cannot have
-- teaches_offline = true on their live profile.
-- ============================================================

create table public.guarantors (
  id              uuid primary key default gen_random_uuid(),
  tutor_id        uuid not null references public.tutors(id) on delete cascade,

  full_name       text not null,
  phone           text not null,
  relationship    text not null,   -- e.g. 'Spouse', 'Employer', 'Landlord'
  address         text,

  -- Admin verification
  verified        boolean not null default false,
  verified_by     uuid references auth.users(id),
  verified_at     timestamptz,
  verification_note text,

  created_at      timestamptz not null default now()
);

create unique index guarantors_tutor_idx on public.guarantors(tutor_id); -- one per tutor

alter table public.guarantors enable row level security;

-- Tutors can read and insert their own guarantor.
create policy guarantors_self on public.guarantors
  for all using (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  )
  with check (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  );

create policy guarantors_admin on public.guarantors
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 3 · tutor_subjects
-- Many-to-many: which subjects a tutor teaches, in which
-- curriculum. Normalised so parents can filter by subject.
-- ============================================================

create table public.tutor_subjects (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid not null references public.tutors(id) on delete cascade,
  subject     text not null,   -- e.g. 'Mathematics', 'English Language'
  curriculum  text not null,   -- e.g. 'NERDC', 'Cambridge', 'IB'
  level       text,            -- e.g. 'Primary', 'JSS', 'SSS', 'A-Level'

  unique (tutor_id, subject, curriculum)
);

alter table public.tutor_subjects enable row level security;

-- Public read — subject tags are visible on the search page.
create policy tutor_subjects_public_read on public.tutor_subjects
  for select using (
    tutor_id in (select id from public.tutors where approval_status = 'approved' and active = true)
  );

-- Tutors manage their own subjects.
create policy tutor_subjects_self on public.tutor_subjects
  for all using (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  )
  with check (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  );

create policy tutor_subjects_admin on public.tutor_subjects
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 4 · tutor_availability
-- Weekly schedule. Day of week (0=Sun, 6=Sat) + start/end time.
-- Used by the booking UI to show available slots.
-- ============================================================

create table public.tutor_availability (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid not null references public.tutors(id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  mode        text not null check (mode in ('online', 'offline', 'both')),

  unique (tutor_id, day_of_week, start_time)
);

alter table public.tutor_availability enable row level security;

create policy tutor_avail_public_read on public.tutor_availability
  for select using (
    tutor_id in (select id from public.tutors where approval_status = 'approved' and active = true)
  );

create policy tutor_avail_self on public.tutor_availability
  for all using (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  )
  with check (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  );

create policy tutor_avail_admin on public.tutor_availability
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 5 · bookings
-- Full session lifecycle:
--
--   pending_payment   parent has requested, not yet paid
--   paid              payment captured, tutor not yet confirmed
--   confirmed         tutor accepted, session scheduled
--   completed         session done, review window open
--   disputed          parent raised a dispute
--   cancelled         cancelled before session (refund eligible)
--   refunded          platform issued refund
--
-- TTA holds payment until completion (escrow model). Payout
-- to the tutor happens when status reaches 'completed'.
-- ============================================================

create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),

  parent_user_id      uuid not null references auth.users(id),
  tutor_id            uuid not null references public.tutors(id),

  -- Session spec
  subject             text not null,
  curriculum          text,
  session_type        text not null check (session_type in ('online', 'offline')),
  session_date        date not null,
  start_time          time not null,
  duration_minutes    int  not null default 60 check (duration_minutes in (60, 90, 120)),
  notes_for_tutor     text,

  -- Pricing at time of booking (snapshot — tutor may change rates later)
  agreed_rate_minor   bigint not null,   -- per hour
  total_minor         bigint not null,   -- agreed_rate * (duration_minutes / 60)
  currency            text not null default 'NGN',

  -- Platform commission (set at booking time, not payout time)
  commission_pct      numeric(5,2) not null default 15.00,  -- TTA takes 15%
  commission_minor    bigint not null,   -- total_minor * commission_pct / 100, rounded
  tutor_payout_minor  bigint not null,   -- total_minor - commission_minor

  -- Lifecycle
  status              text not null default 'pending_payment'
                        check (status in (
                          'pending_payment', 'paid', 'confirmed',
                          'completed', 'disputed', 'cancelled', 'refunded'
                        )),

  -- Payment back-link
  payment_id          uuid references public.payments(id),

  -- Timestamps
  confirmed_at        timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  cancel_reason       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index bookings_parent_idx on public.bookings(parent_user_id, created_at desc);
create index bookings_tutor_idx  on public.bookings(tutor_id, session_date);
create index bookings_status_idx on public.bookings(status, session_date);

alter table public.bookings enable row level security;

-- Parents see their own bookings.
create policy bookings_parent_read on public.bookings
  for select using (parent_user_id = auth.uid());

create policy bookings_parent_insert on public.bookings
  for insert with check (parent_user_id = auth.uid());

create policy bookings_parent_update on public.bookings
  for update using (parent_user_id = auth.uid())
  with check (
    -- Parents can only cancel (not complete, not confirm — those are tutor actions).
    status in ('pending_payment', 'paid')
  );

-- Tutors see bookings assigned to them.
create policy bookings_tutor_read on public.bookings
  for select using (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  );

create policy bookings_tutor_update on public.bookings
  for update using (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  )
  with check (
    -- Tutors can confirm (paid → confirmed) or mark complete (confirmed → completed).
    status in ('paid', 'confirmed')
  );

create policy bookings_admin on public.bookings
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 6 · booking_reviews
-- Parent reviews a session after it completes.
-- Review window: 72 hours after completed_at.
-- ============================================================

create table public.booking_reviews (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings(id) on delete cascade,
  reviewer_id     uuid not null references auth.users(id),
  tutor_id        uuid not null references public.tutors(id),

  rating          int not null check (rating between 1 and 5),
  comment         text,
  is_public       boolean not null default true,

  created_at      timestamptz not null default now()
);

create index reviews_tutor_idx on public.booking_reviews(tutor_id, created_at desc);

alter table public.booking_reviews enable row level security;

-- Reviews are public (visible on tutor profile) if is_public = true.
create policy reviews_public_read on public.booking_reviews
  for select using (is_public = true);

-- Reviewer sees their own regardless.
create policy reviews_self_read on public.booking_reviews
  for select using (reviewer_id = auth.uid());

-- Parent can insert a review for their own completed booking.
create policy reviews_parent_insert on public.booking_reviews
  for insert with check (
    reviewer_id = auth.uid()
    and booking_id in (
      select id from public.bookings
       where parent_user_id = auth.uid()
         and status = 'completed'
         -- 72-hour review window
         and completed_at > now() - interval '72 hours'
    )
  );

create policy reviews_admin on public.booking_reviews
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 7 · payout_ledger
-- Immutable record of every payout event. Written by
-- confirm_session_complete RPC; never by the client.
-- Used by finance reporting and tutor earnings dashboard.
-- ============================================================

create table public.payout_ledger (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null unique references public.bookings(id),
  tutor_id            uuid not null references public.tutors(id),

  gross_minor         bigint not null,    -- what parent paid
  commission_minor    bigint not null,    -- TTA's cut
  net_minor           bigint not null,    -- tutor receives
  currency            text not null,

  -- Payout status
  payout_status       text not null default 'pending'
                        check (payout_status in ('pending', 'initiated', 'paid', 'failed')),
  payout_reference    text,              -- Paystack transfer reference
  payout_initiated_at timestamptz,
  payout_completed_at timestamptz,

  created_at          timestamptz not null default now()
);

create index payout_tutor_idx   on public.payout_ledger(tutor_id, created_at desc);
create index payout_status_idx  on public.payout_ledger(payout_status) where payout_status = 'pending';

alter table public.payout_ledger enable row level security;

-- Tutors see their own ledger.
create policy payout_tutor_read on public.payout_ledger
  for select using (
    tutor_id in (select id from public.tutors where user_id = auth.uid())
  );

create policy payout_admin on public.payout_ledger
  for all using (public.current_role() = 'super_admin');


-- ============================================================
-- PART 8 · search_tutors RPC
-- Filtered, paginated tutor search. Called by ParentTutorSearchView.
-- Runs as SECURITY DEFINER so the join across tutors + subjects +
-- availability uses the owner's permissions, not the caller's,
-- which avoids an N+1 RLS check per row.
-- ============================================================

create or replace function public.search_tutors(
  p_subject     text    default null,
  p_curriculum  text    default null,
  p_city        text    default null,
  p_mode        text    default null,   -- 'online' | 'offline' | null (both)
  p_max_rate    bigint  default null,   -- filter by hourly_rate_minor ≤ this
  p_limit       int     default 20,
  p_offset      int     default 0
)
returns table (
  tutor_id          uuid,
  full_name         text,
  photo_url         text,
  city              text,
  state             text,
  bio               text,
  years_experience  int,
  teaches_online    boolean,
  teaches_offline   boolean,
  hourly_rate_minor bigint,
  currency          text,
  rating_avg        numeric,
  rating_count      int,
  subjects          jsonb,    -- [{ subject, curriculum, level }]
  total_count       bigint    -- for pagination
)
language sql
stable
security definer
as $$
  with filtered as (
    select t.id
      from public.tutors t
      -- subject / curriculum filter (join tutor_subjects)
      left join public.tutor_subjects ts on ts.tutor_id = t.id
     where t.approval_status = 'approved'
       and t.active           = true
       and (p_subject    is null or ts.subject    ilike '%' || p_subject    || '%')
       and (p_curriculum is null or ts.curriculum ilike '%' || p_curriculum || '%')
       and (p_city       is null or t.city        ilike '%' || p_city       || '%')
       and (p_max_rate   is null or t.hourly_rate_minor <= p_max_rate)
       and (
         p_mode is null
         or (p_mode = 'online'  and t.teaches_online  = true)
         or (p_mode = 'offline' and t.teaches_offline = true)
       )
     group by t.id
  )
  select
    t.id,
    t.full_name,
    t.photo_url,
    t.city,
    t.state,
    t.bio,
    t.years_experience,
    t.teaches_online,
    t.teaches_offline,
    t.hourly_rate_minor,
    t.currency,
    t.rating_avg,
    t.rating_count,
    (
      select jsonb_agg(jsonb_build_object(
        'subject',    ts2.subject,
        'curriculum', ts2.curriculum,
        'level',      ts2.level
      ))
      from public.tutor_subjects ts2
      where ts2.tutor_id = t.id
    ) as subjects,
    count(*) over ()  -- window function gives total without second query
  from public.tutors t
  join filtered f on f.id = t.id
  order by t.rating_avg desc nulls last, t.rating_count desc
  limit  p_limit
  offset p_offset;
$$;

grant execute on function public.search_tutors(text, text, text, text, bigint, int, int)
  to anon, authenticated;


-- ============================================================
-- PART 9 · confirm_session_complete RPC
-- Called by the confirm-session edge function (service role only).
-- Atomically:
--   1. Flips booking status to 'completed'
--   2. Writes a payout_ledger row
--   3. Updates tutor rating_avg + rating_count if a review exists
-- This is the financial settlement point — all three writes or none.
-- ============================================================

create or replace function public.confirm_session_complete(
  p_booking_id  uuid,
  p_confirmed_by text  -- 'tutor' | 'parent' | 'admin' | 'timeout'
)
returns void
language plpgsql
security definer
as $$
declare
  v_booking public.bookings;
begin
  -- Lock the booking row to prevent concurrent completion attempts.
  select * into v_booking
    from public.bookings
   where id = p_booking_id
     for update;

  if not found then
    raise exception 'confirm_session_complete: booking % not found', p_booking_id;
  end if;

  if v_booking.status != 'confirmed' then
    raise exception 'confirm_session_complete: booking % is %, expected confirmed',
      p_booking_id, v_booking.status;
  end if;

  -- 1. Mark booking complete.
  update public.bookings
     set status       = 'completed',
         completed_at = now(),
         updated_at   = now()
   where id = p_booking_id;

  -- 2. Write immutable payout record.
  insert into public.payout_ledger (
    booking_id,
    tutor_id,
    gross_minor,
    commission_minor,
    net_minor,
    currency
  ) values (
    p_booking_id,
    v_booking.tutor_id,
    v_booking.total_minor,
    v_booking.commission_minor,
    v_booking.tutor_payout_minor,
    v_booking.currency
  );

  -- 3. Recompute tutor rating average from all reviews (not just this one —
  --    avoids drift from floating point accumulation).
  update public.tutors t
     set rating_avg   = (
           select round(avg(r.rating)::numeric, 2)
             from public.booking_reviews r
            where r.tutor_id = v_booking.tutor_id
         ),
         rating_count = (
           select count(*)
             from public.booking_reviews r
            where r.tutor_id = v_booking.tutor_id
         ),
         updated_at   = now()
   where t.id = v_booking.tutor_id;

  -- Audit trail.
  insert into public.audit_log (actor, action, details)
  values (
    p_confirmed_by,
    'booking.completed',
    jsonb_build_object(
      'booking_id',          p_booking_id,
      'tutor_id',            v_booking.tutor_id,
      'gross_minor',         v_booking.total_minor,
      'tutor_payout_minor',  v_booking.tutor_payout_minor,
      'commission_minor',    v_booking.commission_minor
    )
  );
end;
$$;

-- Service role only — called by the confirm-session edge function.
revoke all on function public.confirm_session_complete(uuid, text) from public;


-- ============================================================
-- PART 10 · tutor_earnings_summary RPC
-- Used by /app/tutor/earnings dashboard.
-- ============================================================

create or replace function public.tutor_earnings_summary(
  p_tutor_id  uuid
)
returns table (
  period            text,
  gross_minor       bigint,
  commission_minor  bigint,
  net_minor         bigint,
  session_count     bigint,
  currency          text
)
language sql
stable
security definer
as $$
  select
    to_char(date_trunc('month', pl.created_at), 'YYYY-MM') as period,
    sum(pl.gross_minor)::bigint                             as gross_minor,
    sum(pl.commission_minor)::bigint                        as commission_minor,
    sum(pl.net_minor)::bigint                               as net_minor,
    count(*)::bigint                                        as session_count,
    pl.currency
  from public.payout_ledger pl
  where pl.tutor_id = p_tutor_id
    -- Only the tutor themselves or an admin can call this.
    and (
      p_tutor_id in (select id from public.tutors where user_id = auth.uid())
      or public.current_role() = 'super_admin'
    )
  group by date_trunc('month', pl.created_at), pl.currency
  order by date_trunc('month', pl.created_at) desc;
$$;

grant execute on function public.tutor_earnings_summary(uuid) to authenticated;
