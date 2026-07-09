-- Account management preferences (nickname, visibility, net worth / safe to spend toggles)

alter table public.accounts
  add column if not exists nickname text,
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists include_in_net_worth boolean not null default true,
  add column if not exists include_in_safe_to_spend boolean not null default true,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists accounts_user_visible_idx
  on public.accounts (user_id)
  where record_kind = 'account' and is_hidden = false and archived_at is null;
