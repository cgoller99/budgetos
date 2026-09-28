-- Tracks when we last billed a /transactions/refresh and when a live
-- /accounts/balance/get actually succeeded. last_synced_at remains "Buxme
-- saved Plaid data" and is not a bank-check timestamp.

alter table public.bank_connections
  add column if not exists transactions_refresh_requested_at timestamptz,
  add column if not exists balances_checked_at timestamptz;
