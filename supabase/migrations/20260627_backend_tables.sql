-- BudgetOS permanent backend: investments, recurring_items, notifications
-- Run after schema.sql and prior migrations.

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
create index if not exists recurring_items_entity_idx
  on public.recurring_items (user_id, entity_type, entity_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_created_at_idx
  on public.notifications (user_id, created_at desc);

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

-- Migrate legacy investment rows from accounts into investments
insert into public.investments (
  id,
  user_id,
  name,
  type,
  value,
  monthly_change,
  monthly_contribution,
  contribution_frequency,
  start_date,
  next_occurrence,
  last_processed_date,
  recurring_status,
  created_at,
  updated_at
)
select
  id,
  user_id,
  name,
  type,
  balance,
  monthly_change,
  monthly_contribution,
  contribution_frequency,
  start_date,
  next_occurrence,
  last_processed_date,
  recurring_status,
  created_at,
  updated_at
from public.accounts
where record_kind = 'investment'
on conflict (id) do nothing;

delete from public.accounts where record_kind = 'investment';
