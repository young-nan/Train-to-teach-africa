-- =============================================================================
-- 0011_school_billing.sql
--
-- School-side tuition billing. Completely separate from TTA platform
-- subscriptions (which track a school's or parent's TTA product access).
--
-- This module lets school admins:
--   - Generate invoices for parents (school fees, levies, uniform, etc.)
--   - Track manual payments (cash / transfer at the gate)
--   - Accept online payments via Paystack (optional)
--   - See outstanding balances by class or term
--
-- Parents see their own child's invoices and outstanding balance.
--
-- TABLES
--   school_invoices         — one invoice per pupil-term
--   school_invoice_items    — line items (tuition, levies, books, uniform)
--   school_invoice_payments — cash / transfer / Paystack records
--
-- FUNCTIONS
--   school_billing_summary(school_id, term, year)
--       → aggregate totals: expected, collected, outstanding, overdue
--   get_class_outstanding(class_id, term, year)
--       → per-pupil outstanding balance for a class
--   get_pupil_invoices(pupil_id)
--       → all invoices for a pupil across all terms
-- =============================================================================

begin;

-- ── Tables ───────────────────────────────────────────────────────────────────

create table public.school_invoices (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id)  on delete cascade,
  pupil_id      uuid not null references public.pupils(id)   on delete cascade,
  class_id      uuid             references public.classes(id) on delete set null,

  -- Term context
  term          text not null check (term in ('term_1', 'term_2', 'term_3')),
  academic_year int  not null,                               -- e.g. 2026

  -- Money — always in kobo (minor units). Never floats.
  total_kobo    bigint not null default 0 check (total_kobo >= 0),
  paid_kobo     bigint not null default 0 check (paid_kobo  >= 0),
  currency      text   not null default 'NGN',

  -- Status
  status        text not null default 'draft'
                check (status in ('draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled')),
  due_date      date,
  issued_at     timestamptz,
  notes         text,

  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint school_invoices_one_per_pupil_term
    unique (pupil_id, term, academic_year)
);

create index school_invoices_school_idx  on public.school_invoices (school_id, academic_year, term);
create index school_invoices_pupil_idx   on public.school_invoices (pupil_id);
create index school_invoices_class_idx   on public.school_invoices (class_id);
create index school_invoices_status_idx  on public.school_invoices (status);

comment on table  public.school_invoices is
  'Per-pupil-term invoices for school fees. Separate from TTA platform subscriptions.';
comment on column public.school_invoices.total_kobo is
  'Sum of all invoice items. Maintained in kobo; never use floats for money.';
comment on column public.school_invoices.paid_kobo  is
  'Sum of all accepted payments. Updated by trigger on school_invoice_payments.';


-- ── Line items ───────────────────────────────────────────────────────────────

create table public.school_invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.school_invoices(id) on delete cascade,
  description  text not null,                                  -- "Tuition Fee", "Library Levy"
  amount_kobo  bigint not null check (amount_kobo >= 0),
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index school_invoice_items_invoice_idx on public.school_invoice_items (invoice_id, sort_order);

comment on table public.school_invoice_items is
  'Line items on a school invoice — tuition, levies, uniform, books, etc.';


-- ── Payment records ──────────────────────────────────────────────────────────

create table public.school_invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.school_invoices(id) on delete cascade,
  school_id    uuid not null references public.schools(id)  on delete cascade,

  amount_kobo  bigint not null check (amount_kobo > 0),
  currency     text   not null default 'NGN',

  -- 'cash' | 'bank_transfer' | 'paystack' | 'pos' | 'other'
  method       text not null default 'cash',

  -- Paystack reference if paid online (nullable for offline methods)
  paystack_ref text,
  status       text not null default 'confirmed'
               check (status in ('pending', 'confirmed', 'reversed')),

  -- Who recorded it (staff member at the gate for cash, or automated for Paystack)
  recorded_by  uuid references auth.users(id),
  payment_date date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now()
);

create index school_invoice_payments_invoice_idx on public.school_invoice_payments (invoice_id);
create index school_invoice_payments_school_idx  on public.school_invoice_payments (school_id);
create index school_invoice_payments_date_idx    on public.school_invoice_payments (payment_date desc);

comment on table public.school_invoice_payments is
  'Payment records against school invoices. Cash, transfer, POS, or Paystack.';


-- ── Triggers — keep paid_kobo and status in sync automatically ───────────────

-- After any payment INSERT / UPDATE / DELETE on school_invoice_payments,
-- recompute paid_kobo and derive the status on the parent invoice.

create or replace function public.sync_invoice_balance()
returns trigger language plpgsql as $$
declare
  v_invoice_id uuid;
  v_total      bigint;
  v_paid       bigint;
  v_due_date   date;
  v_new_status text;
begin
  -- Work out which invoice changed
  v_invoice_id := coalesce(NEW.invoice_id, OLD.invoice_id);

  -- Sum all confirmed payments
  select
    i.total_kobo,
    coalesce(sum(p.amount_kobo) filter (where p.status = 'confirmed'), 0),
    i.due_date
  into v_total, v_paid, v_due_date
  from public.school_invoices i
  left join public.school_invoice_payments p on p.invoice_id = i.id
  where i.id = v_invoice_id
  group by i.total_kobo, i.due_date;

  -- Derive status
  v_new_status :=
    case
      when v_paid >= v_total                                           then 'paid'
      when v_paid > 0 and v_paid < v_total                           then 'partial'
      when v_due_date is not null and v_due_date < current_date
           and v_paid < v_total                                       then 'overdue'
      else 'issued'
    end;

  update public.school_invoices
  set
    paid_kobo  = v_paid,
    status     = v_new_status,
    updated_at = now()
  where id = v_invoice_id;

  return NEW;
end;
$$;

create trigger trg_sync_invoice_balance
after insert or update or delete on public.school_invoice_payments
for each row execute function public.sync_invoice_balance();

-- After any item INSERT / UPDATE / DELETE, recompute total_kobo on the invoice.

create or replace function public.sync_invoice_total()
returns trigger language plpgsql as $$
declare
  v_invoice_id uuid;
  v_total      bigint;
begin
  v_invoice_id := coalesce(NEW.invoice_id, OLD.invoice_id);

  select coalesce(sum(amount_kobo), 0)
  into v_total
  from public.school_invoice_items
  where invoice_id = v_invoice_id;

  update public.school_invoices
  set total_kobo = v_total, updated_at = now()
  where id = v_invoice_id;

  return NEW;
end;
$$;

create trigger trg_sync_invoice_total
after insert or update or delete on public.school_invoice_items
for each row execute function public.sync_invoice_total();


-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.school_invoices         enable row level security;
alter table public.school_invoice_items    enable row level security;
alter table public.school_invoice_payments enable row level security;

-- School staff: full CRUD on their own school's invoices / items / payments
create policy invoices_staff_all on public.school_invoices
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and school_id = school_invoices.school_id
        and role in ('school_admin', 'head_teacher', 'teacher')
    )
  );

create policy items_staff_all on public.school_invoice_items
  for all using (
    exists (
      select 1 from public.school_invoices i
      join public.profiles p on p.school_id = i.school_id
      where i.id = school_invoice_items.invoice_id
        and p.user_id = auth.uid()
        and p.role in ('school_admin', 'head_teacher', 'teacher')
    )
  );

create policy payments_staff_all on public.school_invoice_payments
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and school_id = school_invoice_payments.school_id
        and role in ('school_admin', 'head_teacher', 'teacher')
    )
  );

-- Parents: read their own children's invoices + items + payments
create policy invoices_parent_read on public.school_invoices
  for select using (
    exists (
      select 1 from public.parent_pupil_links
      where parent_user_id = auth.uid()
        and pupil_id = school_invoices.pupil_id
    )
  );

create policy items_parent_read on public.school_invoice_items
  for select using (
    exists (
      select 1 from public.school_invoices i
      join public.parent_pupil_links l on l.pupil_id = i.pupil_id
      where i.id = school_invoice_items.invoice_id
        and l.parent_user_id = auth.uid()
    )
  );

create policy payments_parent_read on public.school_invoice_payments
  for select using (
    exists (
      select 1 from public.school_invoices i
      join public.parent_pupil_links l on l.pupil_id = i.pupil_id
      where i.id = school_invoice_payments.invoice_id
        and l.parent_user_id = auth.uid()
    )
  );

grant select, insert, update, delete
  on public.school_invoices, public.school_invoice_items, public.school_invoice_payments
  to authenticated;


-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- school_billing_summary — term-level aggregate for the admin dashboard
create or replace function public.school_billing_summary(
  p_school_id uuid,
  p_term      text,
  p_year      int
)
returns jsonb language plpgsql stable security definer as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'total_invoices',     count(*)                                                               filter (where status != 'draft'),
    'expected_kobo',      coalesce(sum(total_kobo) filter (where status != 'draft'),      0),
    'collected_kobo',     coalesce(sum(paid_kobo),                                         0),
    'outstanding_kobo',   coalesce(sum(total_kobo - paid_kobo) filter (where status not in ('paid','draft','cancelled')), 0),
    'overdue_count',      count(*) filter (where status = 'overdue'),
    'paid_count',         count(*) filter (where status = 'paid'),
    'partial_count',      count(*) filter (where status = 'partial'),
    'draft_count',        count(*) filter (where status = 'draft'),
    'collection_rate_pct',
      case
        when sum(total_kobo) filter (where status != 'draft') > 0
        then round(
          100.0 * sum(paid_kobo) filter (where status != 'draft')
               / sum(total_kobo) filter (where status != 'draft'),
          1
        )
        else 0
      end
  )
  into v_result
  from public.school_invoices
  where school_id = p_school_id
    and term      = p_term
    and academic_year = p_year;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.school_billing_summary(uuid, text, int) to authenticated;

comment on function public.school_billing_summary is
  'Returns billing KPIs for a given school/term/year. Called by the admin billing dashboard.';


-- get_class_outstanding — per-pupil balance row for the class billing table
create or replace function public.get_class_outstanding(
  p_class_id uuid,
  p_term     text,
  p_year     int
)
returns table (
  pupil_id      uuid,
  pupil_name    text,
  invoice_id    uuid,
  total_kobo    bigint,
  paid_kobo     bigint,
  outstanding   bigint,
  status        text,
  due_date      date
) language plpgsql stable security definer as $$
begin
  return query
  select
    pu.id,
    pu.full_name,
    inv.id,
    inv.total_kobo,
    inv.paid_kobo,
    inv.total_kobo - inv.paid_kobo,
    inv.status,
    inv.due_date
  from public.pupils pu
  left join public.school_invoices inv
    on inv.pupil_id = pu.id
   and inv.term         = p_term
   and inv.academic_year = p_year
  where pu.class_id = p_class_id
  order by pu.full_name;
end;
$$;

grant execute on function public.get_class_outstanding(uuid, text, int) to authenticated;


-- get_pupil_invoice_detail — full invoice + items + payments for one pupil
-- Used by parent-facing view and the receipt.
create or replace function public.get_pupil_invoice_detail(
  p_pupil_id uuid,
  p_term     text,
  p_year     int
)
returns jsonb language plpgsql stable security definer as $$
declare
  v_invoice  public.school_invoices;
  v_items    jsonb;
  v_payments jsonb;
begin
  select * into v_invoice
  from public.school_invoices
  where pupil_id     = p_pupil_id
    and term         = p_term
    and academic_year = p_year;

  if not found then return null; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id, 'description', description,
      'amount_kobo', amount_kobo, 'sort_order', sort_order
    ) order by sort_order
  ), '[]'::jsonb)
  into v_items
  from public.school_invoice_items
  where invoice_id = v_invoice.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id, 'amount_kobo', amount_kobo,
      'method', method, 'status', status,
      'payment_date', payment_date, 'notes', notes
    ) order by payment_date desc
  ), '[]'::jsonb)
  into v_payments
  from public.school_invoice_payments
  where invoice_id = v_invoice.id;

  return jsonb_build_object(
    'id',            v_invoice.id,
    'term',          v_invoice.term,
    'academic_year', v_invoice.academic_year,
    'total_kobo',    v_invoice.total_kobo,
    'paid_kobo',     v_invoice.paid_kobo,
    'outstanding',   v_invoice.total_kobo - v_invoice.paid_kobo,
    'status',        v_invoice.status,
    'due_date',      v_invoice.due_date,
    'notes',         v_invoice.notes,
    'issued_at',     v_invoice.issued_at,
    'items',         v_items,
    'payments',      v_payments
  );
end;
$$;

grant execute on function public.get_pupil_invoice_detail(uuid, text, int) to authenticated;

commit;
