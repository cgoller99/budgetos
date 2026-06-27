-- BudgetOS Supabase schema
-- Run in the Supabase SQL editor or via Supabase CLI.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  onboarding_complete boolean not null default false,
  onboarding_mode text,
  demo_profile_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.account_record_kind as enum ('account', 'debt', 'investment');

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  record_kind public.account_record_kind not null default 'account',
  name text not null,
  institution text not null default '',
  type text not null,
  balance numeric(14, 2) not null default 0,
  monthly_change numeric(14, 2) not null default 0,
  interest_rate numeric(8, 4),
  minimum_payment numeric(14, 2),
  due_day integer,
  original_balance numeric(14, 2),
  monthly_contribution numeric(14, 2),
  contribution_frequency text,
  start_date date,
  next_occurrence date,
  last_processed_date date,
  recurring_status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null,
  due_day integer not null default 1,
  autopay boolean not null default false,
  recurring boolean not null default true,
  category text not null,
  paid_month text,
  bill_frequency text default 'monthly',
  start_date date,
  next_occurrence date,
  last_processed_date date,
  recurring_status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  goal_type text not null,
  icon text not null default '⭐',
  current_amount numeric(14, 2) not null default 0,
  target_amount numeric(14, 2) not null,
  contribution_amount numeric(14, 2),
  contribution_frequency text,
  start_date date,
  next_occurrence date,
  last_processed_date date,
  recurring_status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.transaction_type as enum (
  'income',
  'expense',
  'transfer',
  'goal_contribution',
  'investment_contribution',
  'debt_payment'
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  transaction_type public.transaction_type not null,
  name text not null,
  amount numeric(14, 2) not null,
  frequency text,
  category text not null default '',
  goal_id uuid references public.goals (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  bill_id uuid references public.bills (id) on delete set null,
  transfer_to_account_id uuid references public.accounts (id) on delete set null,
  notes text,
  start_date date,
  next_occurrence date,
  last_processed_date date,
  recurring_status text default 'active',
  transaction_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists bills_user_id_idx on public.bills (user_id);
create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists transactions_user_id_idx on public.transactions (user_id);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.bills enable row level security;
alter table public.goals enable row level security;
alter table public.transactions enable row level security;

create policy "Profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Accounts are manageable by owner"
  on public.accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Bills are manageable by owner"
  on public.bills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Goals are manageable by owner"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Transactions are manageable by owner"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Extended backend tables (investments, recurring_items, notifications)

create type public.recurring_entity_type as enum (
  'income',
  'bill',
  'goal',
  'investment'
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  type text not null default 'brokerage',
  value numeric(14, 2) not null default 0,
  monthly_change numeric(14, 2) not null default 0,
  monthly_contribution numeric(14, 2),
  contribution_frequency text,
  start_date date,
  next_occurrence date,
  last_processed_date date,
  recurring_status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type public.recurring_entity_type not null,
  entity_id uuid not null,
  frequency text not null default 'monthly',
  amount numeric(14, 2),
  start_date date,
  next_occurrence date,
  last_processed_date date,
  recurring_status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  label text not null,
  description text not null default '',
  icon text not null default '✓',
  tone text not null default 'neutral',
  surfaces text[] not null default array['activity', 'notification'],
  entity_id uuid,
  entity_type text,
  amount numeric(14, 2),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists investments_user_id_idx on public.investments (user_id);
create index if not exists recurring_items_user_id_idx on public.recurring_items (user_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);

alter table public.investments enable row level security;
alter table public.recurring_items enable row level security;
alter table public.notifications enable row level security;

create policy "Investments are manageable by owner"
  on public.investments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Recurring items are manageable by owner"
  on public.recurring_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Notifications are manageable by owner"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
