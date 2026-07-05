-- Financial Allocation Engine: ledger, envelope balances, extended allocations

alter table public.income_plan_allocations
  add column if not exists allocation_type text default 'fixed',
  add column if not exists percentage numeric(5, 2),
  add column if not exists bill_id uuid references public.bills (id) on delete set null,
  add column if not exists debt_id uuid references public.accounts (id) on delete set null,
  add column if not exists investment_id uuid references public.investments (id) on delete set null,
  add column if not exists contribution_frequency text;

create table if not exists public.envelope_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  allocation_id uuid references public.income_plan_allocations (id) on delete cascade,
  envelope_type text not null default 'category',
  entity_id uuid,
  name text not null,
  icon text not null default '💰',
  balance numeric(14, 2) not null default 0,
  target numeric(14, 2),
  contribution_amount numeric(14, 2),
  contribution_frequency text,
  progress numeric(5, 2) not null default 0,
  next_contribution_date date,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.allocation_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  paycheck_event_id uuid references public.income_plan_paycheck_events (id) on delete set null,
  allocation_id uuid references public.income_plan_allocations (id) on delete set null,
  source_account_id uuid references public.accounts (id) on delete set null,
  destination_type text not null,
  destination_id uuid,
  destination_name text not null,
  amount numeric(14, 2) not null,
  transfer_date date not null,
  frequency text,
  transaction_id uuid references public.transactions (id) on delete set null,
  entry_type text not null default 'paycheck_allocation',
  created_at timestamptz not null default now()
);

create index if not exists envelope_balances_user_id_idx
  on public.envelope_balances (user_id);
create index if not exists envelope_balances_allocation_id_idx
  on public.envelope_balances (allocation_id);
create index if not exists allocation_ledger_user_id_idx
  on public.allocation_ledger (user_id, transfer_date desc);
create index if not exists allocation_ledger_paycheck_idx
  on public.allocation_ledger (paycheck_event_id);

alter table public.envelope_balances enable row level security;
alter table public.allocation_ledger enable row level security;

drop policy if exists "Envelope balances readable by owner or household" on public.envelope_balances;
create policy "Envelope balances readable by owner or household"
  on public.envelope_balances for select
  using (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  );

drop policy if exists "Envelope balances manageable by owner or household" on public.envelope_balances;
create policy "Envelope balances manageable by owner or household"
  on public.envelope_balances for all
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

drop policy if exists "Allocation ledger readable by owner or household" on public.allocation_ledger;
create policy "Allocation ledger readable by owner or household"
  on public.allocation_ledger for select
  using (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  );

drop policy if exists "Allocation ledger manageable by owner or household" on public.allocation_ledger;
create policy "Allocation ledger manageable by owner or household"
  on public.allocation_ledger for all
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
