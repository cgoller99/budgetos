-- Split bill payments: multiple due dates / amounts per bill.

create table if not exists public.bill_splits (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  amount numeric(14, 2) not null,
  due_day integer not null check (due_day >= 0 and due_day <= 31),
  paycheck_assignment text default 'first_paycheck',
  custom_pay_day integer,
  payment_account_id uuid references public.accounts (id) on delete set null,
  paid_month text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bill_splits_bill_id_idx on public.bill_splits (bill_id);
create index if not exists bill_splits_user_id_idx on public.bill_splits (user_id);

alter table public.bill_splits enable row level security;

drop policy if exists "Bill splits readable by owner or household" on public.bill_splits;
create policy "Bill splits readable by owner or household"
  on public.bill_splits for select
  using (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  );

drop policy if exists "Bill splits manageable by owner or household" on public.bill_splits;
create policy "Bill splits manageable by owner or household"
  on public.bill_splits for all
  using (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  )
  with check (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  );

-- Backfill one split per existing bill from legacy bill columns.
insert into public.bill_splits (
  bill_id,
  user_id,
  household_id,
  amount,
  due_day,
  paycheck_assignment,
  custom_pay_day,
  payment_account_id,
  paid_month,
  sort_order
)
select
  b.id,
  b.user_id,
  b.household_id,
  b.amount,
  b.due_day,
  coalesce(b.paycheck_assignment, 'first_paycheck'),
  b.custom_pay_day,
  b.payment_account_id,
  b.paid_month,
  0
from public.bills b
where not exists (
  select 1 from public.bill_splits s where s.bill_id = b.id
);
