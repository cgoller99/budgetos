-- BudgetOS Auth + RLS preparation
-- Run after schema.sql when enabling email/password authentication.

-- Ensure profiles sync with auth.users (trigger already in schema.sql).
-- Verify RLS is enabled on all user-owned tables:
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.bills enable row level security;
alter table public.goals enable row level security;
alter table public.transactions enable row level security;

-- All policies use auth.uid() = user_id (or id for profiles).
-- No changes required if schema.sql was applied — this migration documents
-- the RLS contract for authenticated email/password users.

comment on table public.profiles is 'User profile row keyed to auth.users.id for RLS';
comment on column public.accounts.user_id is 'Must equal auth.uid() for RLS insert/update/select';
comment on column public.bills.user_id is 'Must equal auth.uid() for RLS insert/update/select';
comment on column public.goals.user_id is 'Must equal auth.uid() for RLS insert/update/select';
comment on column public.transactions.user_id is 'Must equal auth.uid() for RLS insert/update/select';
