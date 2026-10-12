-- Category budgets are personal and owned by one user.
-- Apply this migration before shipping budget sync. The app reads and writes
-- public.category_budgets for the signed-in user and keeps a device cache.
-- Household peers must not read or write another member's limits.
-- FOR ALL includes SELECT, so owner updates are not silently dropped.

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

alter table public.category_budgets enable row level security;

drop policy if exists "Category budgets manageable by owner"
  on public.category_budgets;

create policy "Category budgets manageable by owner"
  on public.category_budgets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.category_budgets from anon;
grant select, insert, update, delete on table public.category_budgets to authenticated;
