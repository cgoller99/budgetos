-- Link savings goals to bank/investment accounts by account ID.
-- Owner-only RLS is already enforced on public.goals; these columns inherit it.
-- linked_allocated_amount is used only for partial tracking.
-- current_amount stays the confirmed contribution ledger and is never overwritten
-- by an account balance unless the user explicitly confirms a link action in-app.

alter table public.goals
  add column if not exists linked_account_id uuid
    references public.accounts (id) on delete set null,
  add column if not exists link_mode text
    check (link_mode is null or link_mode in ('full', 'partial')),
  add column if not exists linked_allocated_amount numeric(14, 2)
    check (linked_allocated_amount is null or linked_allocated_amount >= 0),
  add column if not exists linked_at timestamptz,
  add column if not exists linked_snapshot_balance numeric(14, 2),
  add column if not exists linked_snapshot_at timestamptz;

comment on column public.goals.linked_account_id is
  'Optional funding/progress account for this goal. Uses account IDs, never names.';
comment on column public.goals.link_mode is
  'full = track eligible account balance; partial = track linked_allocated_amount only.';
comment on column public.goals.linked_allocated_amount is
  'Dollars of the linked account assigned to this goal when link_mode = partial.';
comment on column public.goals.linked_snapshot_balance is
  'Last known eligible account balance used when the link is stale/disconnected.';
comment on column public.goals.linked_snapshot_at is
  'When linked_snapshot_balance was last refreshed from a live account.';

create index if not exists goals_linked_account_id_idx
  on public.goals (linked_account_id)
  where linked_account_id is not null;

-- Keep owner-only policies intact (goals already RLS-enabled).
-- Ensure authenticated role can update the new columns via existing owner policies.
