-- Transaction Engine columns for BudgetOS

alter type public.transaction_type add value if not exists 'transfer';

alter table public.transactions
  add column if not exists transfer_to_account_id uuid references public.accounts (id) on delete set null,
  add column if not exists notes text;

create index if not exists transactions_account_id_idx on public.transactions (account_id);
create index if not exists transactions_transfer_to_account_id_idx on public.transactions (transfer_to_account_id);
