-- =============================================================================
-- 0001_core_schema.sql
-- The spine of the platform: roles, profiles, schools, RLS foundation.
-- =============================================================================

-- ---- Roles enum -------------------------------------------------------------
-- Mirrors src/config/roles.js. If you add a role here, add it there too.
create type user_role as enum (
  'super_admin',
  'school_admin',
  'head_teacher',
  'teacher',
  'parent',
  'student'
);

-- ---- Schools ----------------------------------------------------------------
create table public.schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,             -- url-safe handle
  logo_url      text,
  city          text,
  state         text,
  country       text default 'Nigeria',
  phone         text,
  status        text not null default 'active',   -- active | suspended | onboarding
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---- Profiles ---------------------------------------------------------------
-- One row per auth.users user. The role column is what RLS checks against.
create table public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  phone         text,
  role          user_role not null,
  school_id     uuid references public.schools(id),  -- null for super_admin, parents
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_school_idx on public.profiles(school_id) where school_id is not null;

-- ---- Auto-create profile on auth.user signup --------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'parent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Children (parent-child link) -------------------------------------------
-- Pupils can be enrolled in a school OR in a parent-only home subscription.
create table public.pupils (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  pupil_code    text unique,                     -- school-issued, used for PIN login
  level         text not null,                    -- 'primary_3', etc.
  school_id     uuid references public.schools(id),
  class_id      uuid,                             -- references public.classes(id)
  date_of_birth date,
  photo_url     text,
  pin_hash      text,                             -- bcrypt of student PIN
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index pupils_school_idx on public.pupils(school_id);
create index pupils_class_idx on public.pupils(class_id);

create table public.parent_pupil_links (
  parent_user_id uuid references auth.users(id) on delete cascade,
  pupil_id       uuid references public.pupils(id) on delete cascade,
  relationship   text not null default 'parent',  -- parent | guardian
  created_at     timestamptz not null default now(),
  primary key (parent_user_id, pupil_id)
);

-- ---- Classes ----------------------------------------------------------------
create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  name          text not null,                   -- e.g. "Primary 3 Emerald"
  level         text not null,
  teacher_id    uuid references auth.users(id),  -- the class teacher
  pupil_count   int not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.pupils add constraint pupils_class_fk
  foreign key (class_id) references public.classes(id) on delete set null;

-- ---- Audit log --------------------------------------------------------------
-- Every meaningful write goes in here. The platform's compliance spine.
create table public.audit_log (
  id              bigserial primary key,
  occurred_at     timestamptz not null default now(),
  actor           text not null,                 -- user id, 'paystack_webhook', etc.
  action          text not null,                 -- 'attendance.marked', 'subscription.activated'
  target_user_id  uuid,
  target_pupil_id uuid,
  target_school_id uuid,
  details         jsonb
);
create index audit_log_occurred_idx on public.audit_log(occurred_at desc);
create index audit_log_target_user_idx on public.audit_log(target_user_id);

-- =============================================================================
-- RLS — enabled everywhere, denied by default, opened by explicit policies.
-- =============================================================================

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.pupils enable row level security;
alter table public.parent_pupil_links enable row level security;
alter table public.classes enable row level security;
alter table public.audit_log enable row level security;

-- ---- Helper: current_user role + school -------------------------------------
create or replace function public.current_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.current_school_id()
returns uuid language sql stable security definer as $$
  select school_id from public.profiles where user_id = auth.uid();
$$;

-- ---- Profiles policies ------------------------------------------------------
-- Users can read their own profile.
create policy profiles_self_read on public.profiles
  for select using (user_id = auth.uid());
-- School admins can read profiles in their school.
create policy profiles_school_read on public.profiles
  for select using (
    public.current_role() in ('school_admin', 'head_teacher', 'super_admin')
    and school_id = public.current_school_id()
  );

-- ---- Schools policies -------------------------------------------------------
create policy schools_member_read on public.schools
  for select using (
    id = public.current_school_id() or public.current_role() = 'super_admin'
  );

-- ---- Pupils policies --------------------------------------------------------
-- School staff can read pupils in their school.
create policy pupils_school_read on public.pupils
  for select using (
    school_id = public.current_school_id()
    and public.current_role() in ('school_admin', 'head_teacher', 'teacher', 'super_admin')
  );
-- Parents can read pupils they are linked to.
create policy pupils_parent_read on public.pupils
  for select using (
    exists (
      select 1 from public.parent_pupil_links l
      where l.pupil_id = pupils.id and l.parent_user_id = auth.uid()
    )
  );

-- ---- parent_pupil_links policies --------------------------------------------
create policy ppl_self_read on public.parent_pupil_links
  for select using (parent_user_id = auth.uid());

-- ---- Classes ----------------------------------------------------------------
create policy classes_school_read on public.classes
  for select using (school_id = public.current_school_id());

-- ---- Audit log --------------------------------------------------------------
-- Audit log is read-only to admins via a view. Inserts only via service role.
create policy audit_log_admin_read on public.audit_log
  for select using (public.current_role() in ('school_admin', 'super_admin'));

-- =============================================================================
-- Convenience view for app boot: current user's profile + school name.
-- =============================================================================
create or replace view public.current_user_profile with (security_invoker = true) as
  select
    p.user_id,
    p.full_name,
    p.email,
    p.role,
    p.school_id,
    s.name as school_name,
    p.avatar_url,
    coalesce(
      (select array_agg(pupil_id) from public.parent_pupil_links where parent_user_id = p.user_id),
      array[]::uuid[]
    ) as child_ids
  from public.profiles p
  left join public.schools s on s.id = p.school_id;

grant select on public.current_user_profile to authenticated;
