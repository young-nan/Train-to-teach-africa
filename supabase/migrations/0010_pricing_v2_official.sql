-- =============================================================================
-- 0010_pricing_v2_official.sql
--
-- Applies the official approved pricing from the marketing copy update:
--
--   AFRICAN CURRICULUM (NGN, denominated and fixed)
--     Parent · Per Term         ₦12,240   (1,224,000 kobo)
--     Parent · Annual           ₦35,720   (3,572,000 kobo)
--     Teacher · Per Term        ₦14,688   (1,468,800 kobo)
--     School Bundle · Per Term  ₦78,657   (7,865,700 kobo)
--     School Bundle · Annual    ₦232,971  (23,297,100 kobo)
--
--   INTERNATIONAL CURRICULUM (USD)
--     Parent · Per Term         $18.78   (1,878 cents)
--     Parent · Annual           $55.34   (5,534 cents)
--     Teacher · Per Term        $21.78   (2,178 cents)
--     School Bundle · Per Term  $129.32  (12,932 cents)
--     School Bundle · Annual    $350.96  (35,096 cents)
--
-- What this migration does
--   1. CREATEs the subscription_tiers table if it does not already exist.
--      (Earlier code referenced it but no migration ever created it.)
--   2. UPSERTs all ten official tiers using (curriculum, audience, period) as
--      the natural key. Safe to re-run.
--   3. Replaces activate_subscription() so the price lookup uses the new
--      minor amounts. The earlier values were the old launch prices and are
--      now stale.
--   4. Grants anon SELECT on the new table with an RLS policy mirroring the
--      tiersService.listActiveTiers() contract: anon may read active rows.
-- =============================================================================

begin;

-- ── 1. Table ─────────────────────────────────────────────────────────────────

create table if not exists public.subscription_tiers (
  id                  uuid primary key default gen_random_uuid(),
  curriculum          text not null check (curriculum in ('african', 'foreign')),
  audience            text not null check (audience   in ('parent', 'teacher', 'school')),
  period              text not null check (period     in ('term', 'annual')),
  name                text not null,
  description         text,
  price_minor         bigint not null check (price_minor >= 0),
  currency            text not null check (currency in ('NGN', 'USD')),
  paystack_plan_code  text,
  active              boolean not null default true,
  display_order       integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- (curriculum, audience, period) is the stable identity tuple — used by
  -- the upserts below and by derivePlanCode() on the client.
  constraint subscription_tiers_identity_unique
    unique (curriculum, audience, period)
);

create index if not exists subscription_tiers_active_idx
  on public.subscription_tiers (active, curriculum, display_order);

comment on table  public.subscription_tiers is
  'Catalogue of subscription tiers shown on /pricing and used by the parent subscribe flow. (curriculum, audience, period) is the stable identity tuple.';
comment on column public.subscription_tiers.price_minor is
  'Price in minor units (kobo for NGN, cents for USD). NEVER floats.';

-- ── 2. RLS — anon may read active tiers ──────────────────────────────────────

alter table public.subscription_tiers enable row level security;

drop policy if exists tiers_public_read on public.subscription_tiers;
create policy tiers_public_read
  on public.subscription_tiers
  for select
  using (active = true);

-- Authenticated callers (incl. super_admin via separate policies) can already
-- read everything when active=true; super admin write policies live in 0008.

grant select on public.subscription_tiers to anon, authenticated;

-- ── 3. Seed the ten official tiers ──────────────────────────────────────────

insert into public.subscription_tiers
  (curriculum, audience, period, name,                       price_minor, currency, display_order)
values
  -- African (NGN)
  ('african', 'parent',  'term',   'Parent · Per Term',          1224000,  'NGN', 10),
  ('african', 'parent',  'annual', 'Parent · Annual',            3572000,  'NGN', 11),
  ('african', 'teacher', 'term',   'Teacher · Per Term',         1468800,  'NGN', 20),
  ('african', 'school',  'term',   'School Bundle · Per Term',   7865700,  'NGN', 30),
  ('african', 'school',  'annual', 'School Bundle · Annual',    23297100,  'NGN', 31),
  -- International (USD)
  ('foreign', 'parent',  'term',   'Parent · Per Term',             1878,  'USD', 10),
  ('foreign', 'parent',  'annual', 'Parent · Annual',               5534,  'USD', 11),
  ('foreign', 'teacher', 'term',   'Teacher · Per Term',            2178,  'USD', 20),
  ('foreign', 'school',  'term',   'School Bundle · Per Term',     12932,  'USD', 30),
  ('foreign', 'school',  'annual', 'School Bundle · Annual',       35096,  'USD', 31)
on conflict (curriculum, audience, period)
do update set
  name          = excluded.name,
  price_minor   = excluded.price_minor,
  currency      = excluded.currency,
  display_order = excluded.display_order,
  active        = true,
  updated_at    = now();

-- ── 4. activate_subscription() — new prices ─────────────────────────────────
--
-- This SECURITY DEFINER function is called from the verify-payment edge function
-- (service role) to flip a verified Paystack payment into an active row in the
-- subscriptions table. It must agree with src/config/pricing.js and with the
-- subscription_tiers seed above.

create or replace function public.activate_subscription(
  p_user_id    uuid,
  p_plan_code  text,
  p_payment_id uuid
) returns uuid
language plpgsql security definer as $$
declare
  v_cadence       text;
  v_currency      text;
  v_amount_minor  bigint;
  v_school_id     uuid;
  v_ends_at       timestamptz;
  v_subscription_id uuid;
begin
  -- Map plan_code → cadence + currency + amount. Values are mirrored from
  -- src/config/pricing.js (canonical) and subscription_tiers (DB-driven).
  select
    case
      when p_plan_code like '%_TERM'   then 'term'
      when p_plan_code like '%_ANNUAL' then 'annual'
    end,
    case when p_plan_code like 'AFR_%' then 'NGN' else 'USD' end
  into v_cadence, v_currency;

  v_amount_minor := case p_plan_code
    when 'AFR_PARENT_TERM'    then  1224000   -- ₦12,240.00
    when 'AFR_PARENT_ANNUAL'  then  3572000   -- ₦35,720.00
    when 'AFR_TEACHER_TERM'   then  1468800   -- ₦14,688.00
    when 'AFR_SCHOOL_TERM'    then  7865700   -- ₦78,657.00
    when 'AFR_SCHOOL_ANNUAL'  then 23297100   -- ₦232,971.00
    when 'INT_PARENT_TERM'    then     1878   -- $18.78
    when 'INT_PARENT_ANNUAL'  then     5534   -- $55.34
    when 'INT_TEACHER_TERM'   then     2178   -- $21.78
    when 'INT_SCHOOL_TERM'    then    12932   -- $129.32
    when 'INT_SCHOOL_ANNUAL'  then    35096   -- $350.96
  end;

  if v_amount_minor is null then
    raise exception 'Unknown plan_code: %', p_plan_code;
  end if;

  -- Term = 13 weeks; annual = 1 year. Matches client-side validity windows.
  v_ends_at := case v_cadence
    when 'term'   then now() + interval '13 weeks'
    when 'annual' then now() + interval '1 year'
  end;

  -- School-paid bundles attach to the user's school.
  select school_id into v_school_id
  from public.profiles
  where user_id = p_user_id;

  insert into public.subscriptions
    (user_id, school_id, plan_code, cadence, currency, amount_minor,
     status, starts_at, ends_at)
  values (
    p_user_id,
    case when p_plan_code like '%SCHOOL%' then v_school_id else null end,
    p_plan_code, v_cadence, v_currency, v_amount_minor,
    'active', now(), v_ends_at
  )
  returning id into v_subscription_id;

  -- Link payment row to subscription (mirrors prior behaviour).
  update public.payments
  set subscription_id = v_subscription_id
  where id = p_payment_id;

  return v_subscription_id;
end;
$$;

revoke all on function public.activate_subscription(uuid, text, uuid) from public;
-- Only the service role calls this — never granted to authenticated.

comment on function public.activate_subscription(uuid, text, uuid) is
  'Service-role only. Activates a verified Paystack payment. Prices mirror src/config/pricing.js and subscription_tiers; bump together.';

commit;
