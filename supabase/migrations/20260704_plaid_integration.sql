-- Plaid bank sync integration

alter table public.bank_connections
  add column if not exists access_token_encrypted text,
  add column if not exists access_token_iv text,
  add column if not exists access_token_tag text,
  add column if not exists institution_id text,
  add column if not exists institution_logo_url text,
  add column if not exists transactions_cursor text,
  add column if not exists investments_cursor text,
  add column if not exists error_code text,
  add column if not exists error_message text;

alter table public.accounts
  add column if not exists bank_connection_id uuid references public.bank_connections (id) on delete set null,
  add column if not exists external_account_id text,
  add column if not exists external_item_id text,
  add column if not exists institution_logo_url text,
  add column if not exists available_balance numeric(14, 2),
  add column if not exists last_four text,
  add column if not exists last_synced_at timestamptz;

alter table public.transactions
  add column if not exists external_transaction_id text;

alter table public.investments
  add column if not exists bank_connection_id uuid references public.bank_connections (id) on delete set null,
  add column if not exists external_account_id text,
  add column if not exists external_item_id text,
  add column if not exists institution_logo_url text,
  add column if not exists available_balance numeric(14, 2),
  add column if not exists last_four text,
  add column if not exists last_synced_at timestamptz;

create table if not exists public.plaid_recurring_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  merchant_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create index if not exists accounts_bank_connection_id_idx
  on public.accounts (bank_connection_id);

create index if not exists accounts_external_account_id_idx
  on public.accounts (external_account_id)
  where external_account_id is not null;

create index if not exists transactions_external_transaction_id_idx
  on public.transactions (external_transaction_id)
  where external_transaction_id is not null;

create index if not exists plaid_recurring_dismissals_user_id_idx
  on public.plaid_recurring_dismissals (user_id);

alter table public.plaid_recurring_dismissals enable row level security;

create policy "Plaid dismissals manageable by owner"
  on public.plaid_recurring_dismissals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Bank connections readable by household"
  on public.bank_connections for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

create unique index if not exists bank_connections_external_item_id_user_idx
  on public.bank_connections (user_id, external_item_id)
  where external_item_id is not null;

create unique index if not exists accounts_external_account_user_idx
  on public.accounts (user_id, external_account_id)
  where external_account_id is not null;

create unique index if not exists transactions_external_transaction_user_idx
  on public.transactions (user_id, external_transaction_id)
  where external_transaction_id is not null;
