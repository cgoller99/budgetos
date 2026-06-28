-- Partial bill split payments: track amount paid per split per month.

alter table public.bill_splits
  add column if not exists paid_amount numeric(14, 2) not null default 0;

comment on column public.bill_splits.paid_amount is
  'Amount paid toward this split in paid_month. Resets when a new month begins.';
