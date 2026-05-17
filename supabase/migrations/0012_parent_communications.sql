-- =============================================================================
-- 0012_parent_communications.sql
--
-- Parent communications log. Every contact a teacher or admin makes with
-- a parent is logged here: notes, phone calls, WhatsApp messages, in-person
-- meetings, and any other kind of follow-up.
--
-- DESIGN DECISIONS
-- ────────────────
-- 1. This is a LOG, not an inbox. There is no read/reply flow in v1.
--    Teachers write; parents read (if the school chooses to share).
--    Full in-app messaging is v2.
--
-- 2. WhatsApp is an external action. The platform constructs the wa.me
--    link and opens it on the teacher's phone. We log the INTENT
--    (teacher clicked "Send on WhatsApp") not the delivery. v2 will
--    add webhook delivery confirmation from the Meta Cloud API.
--
-- 3. `shared_with_parent` defaults to false. This lets teachers write
--    internal notes (concerns, observations) that the parent never sees.
--    When ready, the teacher (or head teacher) flips it to true.
--
-- 4. `pupil_id` is always set. `class_id` is denormalised for fast
--    class-level queries (the teacher's hub view reads by class).
--
-- TABLES
--   parent_comms         — one row per logged contact event
--
-- FUNCTIONS
--   get_class_comms_summary(class_id)
--       → per-pupil count of shared notes and last contact date
--   get_pupil_comms(pupil_id)
--       → all comms for a pupil the caller is allowed to see
-- =============================================================================

begin;

-- ── Main table ────────────────────────────────────────────────────────────────

create table public.parent_comms (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id)   on delete cascade,
  pupil_id          uuid not null references public.pupils(id)    on delete cascade,
  class_id          uuid             references public.classes(id) on delete set null,

  -- Who wrote it
  author_id         uuid not null references auth.users(id),

  -- Contact type
  -- 'note'      — internal written note (may or may not be shared)
  -- 'whatsapp'  — teacher opened a WhatsApp chat (intent logged)
  -- 'call'      — phone call made or attempted
  -- 'meeting'   — in-person meeting at school
  -- 'other'     — anything else
  contact_type      text not null default 'note'
                    check (contact_type in ('note', 'whatsapp', 'call', 'meeting', 'other')),

  -- The note body (required for 'note'; optional but encouraged for others)
  body              text,

  -- Whether the parent can see this in their app
  shared_with_parent boolean not null default false,

  -- For whatsapp entries: the pre-filled message body that was opened
  -- (helps reconstruct what was said if the teacher didn't write a note)
  whatsapp_preview  text,

  -- Flags
  follow_up_needed  boolean not null default false,
  follow_up_date    date,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index parent_comms_pupil_idx   on public.parent_comms (pupil_id, created_at desc);
create index parent_comms_class_idx   on public.parent_comms (class_id, created_at desc);
create index parent_comms_school_idx  on public.parent_comms (school_id);
create index parent_comms_followup_idx on public.parent_comms (school_id, follow_up_needed, follow_up_date)
  where follow_up_needed = true;

comment on table  public.parent_comms is
  'Log of all teacher/admin → parent contact. One row per interaction. shared_with_parent controls parent visibility.';
comment on column public.parent_comms.shared_with_parent is
  'False = internal note only. True = parent can read this in their app.';
comment on column public.parent_comms.whatsapp_preview is
  'Pre-filled message text opened in WhatsApp. Logged for audit; not sent by the platform.';


-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.parent_comms enable row level security;

-- School staff: full CRUD on their own school's entries
create policy comms_staff_all on public.parent_comms
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and school_id = parent_comms.school_id
        and role in ('school_admin', 'head_teacher', 'teacher')
    )
  );

-- Parents: read only entries explicitly shared with them (for their child)
create policy comms_parent_read on public.parent_comms
  for select using (
    shared_with_parent = true
    and exists (
      select 1 from public.parent_pupil_links
      where parent_user_id = auth.uid()
        and pupil_id = parent_comms.pupil_id
    )
  );

grant select, insert, update, delete on public.parent_comms to authenticated;


-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- get_class_comms_summary — one row per pupil showing last contact + counts.
-- Used by the teacher's class comms hub to surface who needs a follow-up.
create or replace function public.get_class_comms_summary(p_class_id uuid)
returns table (
  pupil_id          uuid,
  pupil_name        text,
  total_notes       bigint,
  shared_notes      bigint,
  last_contact_at   timestamptz,
  follow_up_needed  boolean,
  follow_up_date    date
) language plpgsql stable security definer as $$
begin
  return query
  select
    pu.id,
    pu.full_name,
    coalesce(count(c.id), 0),
    coalesce(count(c.id) filter (where c.shared_with_parent = true), 0),
    max(c.created_at),
    -- follow_up if any open item exists
    bool_or(coalesce(c.follow_up_needed, false)),
    min(c.follow_up_date) filter (where c.follow_up_needed = true)
  from public.pupils pu
  left join public.parent_comms c on c.pupil_id = pu.id
  where pu.class_id = p_class_id
  group by pu.id, pu.full_name
  order by pu.full_name;
end;
$$;

grant execute on function public.get_class_comms_summary(uuid) to authenticated;

comment on function public.get_class_comms_summary is
  'Per-pupil comms summary for a class. Drives the teacher hub table.';


-- get_pupil_comms — full log for one pupil (staff sees all, parent sees shared only).
-- This RPC is just a convenience wrapper; the UI can also query the table directly
-- because RLS handles visibility automatically.
create or replace function public.get_pupil_comms(
  p_pupil_id  uuid,
  p_limit     int default 50,
  p_offset    int default 0
)
returns table (
  id                uuid,
  contact_type      text,
  body              text,
  shared_with_parent boolean,
  whatsapp_preview  text,
  follow_up_needed  boolean,
  follow_up_date    date,
  author_name       text,
  created_at        timestamptz
) language plpgsql stable security definer as $$
begin
  return query
  select
    c.id,
    c.contact_type,
    c.body,
    c.shared_with_parent,
    c.whatsapp_preview,
    c.follow_up_needed,
    c.follow_up_date,
    coalesce(p.full_name, 'Staff'),
    c.created_at
  from public.parent_comms c
  left join public.profiles p on p.user_id = c.author_id
  where c.pupil_id = p_pupil_id
  order by c.created_at desc
  limit p_limit offset p_offset;
end;
$$;

grant execute on function public.get_pupil_comms(uuid, int, int) to authenticated;

commit;
