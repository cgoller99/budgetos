-- Debt planner columns on unified accounts table
alter table public.accounts
  add column if not exists due_day integer,
  add column if not exists original_balance numeric(14, 2);
