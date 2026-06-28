-- Buxme feature expansion: paycheck split, household sharing, bank sync placeholder

-- Paycheck bill assignment
alter table public.bills
  add column if not exists paycheck_assignment text not null default 'first_paycheck',
  add column if not exists custom_pay_day integer,
  add column if not exists payment_account_id uuid references public.accounts (id) on delete set null;

-- Household sharing
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists household_id uuid references public.households (id) on delete set null;

alter table public.accounts
  add column if not exists household_id uuid references public.households (id) on delete set null;

alter table public.bills
  add column if not exists household_id uuid references public.households (id) on delete set null;

alter table public.goals
  add column if not exists household_id uuid references public.households (id) on delete set null;

alter table public.transactions
  add column if not exists household_id uuid references public.households (id) on delete set null;

alter table public.investments
  add column if not exists household_id uuid references public.households (id) on delete set null;

-- Bank sync placeholder (Plaid-ready)
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  provider text not null default 'plaid',
  status text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disconnected')),
  institution_name text,
  external_item_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_user_id_idx
  on public.household_members (user_id);

create index if not exists household_invites_email_idx
  on public.household_invites (email);

create index if not exists bank_connections_user_id_idx
  on public.bank_connections (user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.bank_connections enable row level security;

create or replace function public.user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select hm.household_id
  from public.household_members hm
  where hm.user_id = auth.uid()
  union
  select h.id
  from public.households h
  where h.owner_id = auth.uid();
$$;

create policy "Households readable by members"
  on public.households for select
  using (id in (select public.user_household_ids()));

create policy "Households insertable by owner"
  on public.households for insert
  with check (auth.uid() = owner_id);

create policy "Households updatable by owner"
  on public.households for update
  using (auth.uid() = owner_id);

create policy "Household members readable by members"
  on public.household_members for select
  using (household_id in (select public.user_household_ids()));

create policy "Household members insertable by owner"
  on public.household_members for insert
  with check (
    household_id in (
      select id from public.households where owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "Household invites manageable by owner"
  on public.household_invites for all
  using (
    household_id in (
      select id from public.households where owner_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select id from public.households where owner_id = auth.uid()
    )
  );

create policy "Bank connections manageable by owner"
  on public.bank_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared household read access on finance tables
create policy "Accounts readable by household"
  on public.accounts for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

create policy "Bills readable by household"
  on public.bills for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

create policy "Goals readable by household"
  on public.goals for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

create policy "Transactions readable by household"
  on public.transactions for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

create policy "Investments readable by household"
  on public.investments for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );
