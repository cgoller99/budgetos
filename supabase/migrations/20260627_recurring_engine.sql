-- Recurring Financial Engine columns for Buxme

alter table public.accounts
  add column if not exists contribution_frequency text,
  add column if not exists start_date date,
  add column if not exists next_occurrence date,
  add column if not exists last_processed_date date,
  add column if not exists recurring_status text default 'active';

alter table public.bills
  add column if not exists bill_frequency text default 'monthly',
  add column if not exists start_date date,
  add column if not exists next_occurrence date,
  add column if not exists last_processed_date date,
  add column if not exists recurring_status text default 'active';

alter table public.goals
  add column if not exists contribution_amount numeric(14, 2),
  add column if not exists contribution_frequency text,
  add column if not exists start_date date,
  add column if not exists next_occurrence date,
  add column if not exists last_processed_date date,
  add column if not exists recurring_status text default 'active';

alter table public.transactions
  add column if not exists start_date date,
  add column if not exists next_occurrence date,
  add column if not exists last_processed_date date,
  add column if not exists recurring_status text default 'active';
