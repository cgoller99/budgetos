-- Additive schedule for category budgets.
-- Existing rows keep their amount and category. Frequency defaults to
-- monthly, which is the calendar-month behavior those rows already have.
-- This file does not rewrite or delete customer budget rows.
-- Apply it before the new columns can sync. Until then the app keeps the
-- schedule on the device and still reads and writes the original columns.

alter table public.category_budgets
  add column if not exists frequency text not null default 'monthly',
  add column if not exists anchor_date date,
  add column if not exists weekday smallint,
  add column if not exists month_days smallint[],
  add column if not exists interval_days integer;

alter table public.category_budgets
  drop constraint if exists category_budgets_frequency_check;

alter table public.category_budgets
  add constraint category_budgets_frequency_check
  check (frequency in ('weekly', 'biweekly', 'twice_monthly', 'monthly', 'custom'));

alter table public.category_budgets
  drop constraint if exists category_budgets_weekday_check;

alter table public.category_budgets
  add constraint category_budgets_weekday_check
  check (weekday is null or (weekday >= 0 and weekday <= 6));

alter table public.category_budgets
  drop constraint if exists category_budgets_interval_days_check;

alter table public.category_budgets
  add constraint category_budgets_interval_days_check
  check (interval_days is null or (interval_days >= 1 and interval_days <= 366));
