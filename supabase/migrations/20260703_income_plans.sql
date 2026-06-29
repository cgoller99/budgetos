-- Income Plans: paycheck-based budgeting with allocation rules.

create table if not exists public.income_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  pay_schedule text not null default 'biweekly',
  paycheck_amount numeric(14, 2) not null default 0,
  anchor_date date not null,
  weekly_day_of_week integer check (weekly_day_of_week >= 0 and weekly_day_of_week <= 6),
  monthly_days integer[] not null default array[1, 15],
  custom_interval_days integer,
  deposit_account_id uuid references public.accounts (id) on delete set null,
  next_pay_date date not null,
  last_processed_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income_plan_allocations (
  id uuid primary key default gen_random_uuid(),
  income_plan_id uuid not null references public.income_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null,
  icon text not null default '💰',
  amount numeric(14, 2),
  is_remaining_balance boolean not null default false,
  account_id uuid references public.accounts (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  monthly_target numeric(14, 2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income_plan_paycheck_events (
  id uuid primary key default gen_random_uuid(),
  income_plan_id uuid not null references public.income_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  pay_date date not null,
  gross_amount numeric(14, 2) not null,
  is_extra_paycheck boolean not null default false,
  income_transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.income_plan_allocation_events (
  id uuid primary key default gen_random_uuid(),
  paycheck_event_id uuid not null references public.income_plan_paycheck_events (id) on delete cascade,
  allocation_id uuid not null references public.income_plan_allocations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists income_plans_user_id_idx on public.income_plans (user_id);
create index if not exists income_plan_allocations_plan_id_idx
  on public.income_plan_allocations (income_plan_id);
create index if not exists income_plan_paycheck_events_plan_id_idx
  on public.income_plan_paycheck_events (income_plan_id, pay_date desc);
create index if not exists income_plan_allocation_events_paycheck_idx
  on public.income_plan_allocation_events (paycheck_event_id);

alter table public.income_plans enable row level security;
alter table public.income_plan_allocations enable row level security;
alter table public.income_plan_paycheck_events enable row level security;
alter table public.income_plan_allocation_events enable row level security;

drop policy if exists "Income plans readable by owner or household" on public.income_plans;
create policy "Income plans readable by owner or household"
  on public.income_plans for select
  using (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  );

drop policy if exists "Income plans manageable by owner or household" on public.income_plans;
create policy "Income plans manageable by owner or household"
  on public.income_plans for all
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

drop policy if exists "Income plan allocations readable by owner or household" on public.income_plan_allocations;
create policy "Income plan allocations readable by owner or household"
  on public.income_plan_allocations for select
  using (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  );

drop policy if exists "Income plan allocations manageable by owner or household" on public.income_plan_allocations;
create policy "Income plan allocations manageable by owner or household"
  on public.income_plan_allocations for all
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

drop policy if exists "Income plan paycheck events readable by owner or household" on public.income_plan_paycheck_events;
create policy "Income plan paycheck events readable by owner or household"
  on public.income_plan_paycheck_events for select
  using (
    auth.uid() = user_id
    or (
      household_id is not null
      and household_id in (select public.user_household_ids())
    )
  );

drop policy if exists "Income plan paycheck events manageable by owner or household" on public.income_plan_paycheck_events;
create policy "Income plan paycheck events manageable by owner or household"
  on public.income_plan_paycheck_events for all
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

drop policy if exists "Income plan allocation events readable by owner or household" on public.income_plan_allocation_events;
create policy "Income plan allocation events readable by owner or household"
  on public.income_plan_allocation_events for select
  using (auth.uid() = user_id);

drop policy if exists "Income plan allocation events manageable by owner or household" on public.income_plan_allocation_events;
create policy "Income plan allocation events manageable by owner or household"
  on public.income_plan_allocation_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
