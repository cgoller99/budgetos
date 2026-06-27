-- Household sharing: tables, RLS, invite accept, and shared finance policies.
-- Safe to run on databases that never applied 20260627_feature_expansion.sql.

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

create index if not exists household_members_user_id_idx
  on public.household_members (user_id);

create index if not exists household_invites_email_idx
  on public.household_invites (email);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

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

create or replace function public.current_profile_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where id = auth.uid();
$$;

-- Household table policies
drop policy if exists "Households readable by members" on public.households;
create policy "Households readable by members"
  on public.households for select
  using (id in (select public.user_household_ids()));

drop policy if exists "Households insertable by owner" on public.households;
create policy "Households insertable by owner"
  on public.households for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Households updatable by owner" on public.households;
create policy "Households updatable by owner"
  on public.households for update
  using (auth.uid() = owner_id);

drop policy if exists "Household members readable by members" on public.household_members;
create policy "Household members readable by members"
  on public.household_members for select
  using (household_id in (select public.user_household_ids()));

drop policy if exists "Household members insertable by owner" on public.household_members;
create policy "Household members insertable by owner"
  on public.household_members for insert
  with check (
    household_id in (
      select id from public.households where owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

drop policy if exists "Household invites manageable by owner" on public.household_invites;
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

drop policy if exists "Household invites readable by invitee" on public.household_invites;
create policy "Household invites readable by invitee"
  on public.household_invites for select
  using (
    status = 'pending'
    and lower(email) = lower(coalesce(public.current_profile_email(), ''))
  );

-- Shared finance read policies
drop policy if exists "Accounts readable by household" on public.accounts;
create policy "Accounts readable by household"
  on public.accounts for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

drop policy if exists "Bills readable by household" on public.bills;
create policy "Bills readable by household"
  on public.bills for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

drop policy if exists "Goals readable by household" on public.goals;
create policy "Goals readable by household"
  on public.goals for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

drop policy if exists "Transactions readable by household" on public.transactions;
create policy "Transactions readable by household"
  on public.transactions for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

drop policy if exists "Investments readable by household" on public.investments;
create policy "Investments readable by household"
  on public.investments for select
  using (
    auth.uid() = user_id
    or household_id in (select public.user_household_ids())
  );

-- Shared finance write policies (members can edit household-tagged rows)
drop policy if exists "Accounts manageable by household" on public.accounts;
create policy "Accounts manageable by household"
  on public.accounts for all
  using (
    household_id is not null
    and household_id in (select public.user_household_ids())
  )
  with check (
    household_id is not null
    and household_id in (select public.user_household_ids())
  );

drop policy if exists "Bills manageable by household" on public.bills;
create policy "Bills manageable by household"
  on public.bills for all
  using (
    household_id is not null
    and household_id in (select public.user_household_ids())
  )
  with check (
    household_id is not null
    and household_id in (select public.user_household_ids())
  );

drop policy if exists "Goals manageable by household" on public.goals;
create policy "Goals manageable by household"
  on public.goals for all
  using (
    household_id is not null
    and household_id in (select public.user_household_ids())
  )
  with check (
    household_id is not null
    and household_id in (select public.user_household_ids())
  );

drop policy if exists "Transactions manageable by household" on public.transactions;
create policy "Transactions manageable by household"
  on public.transactions for all
  using (
    household_id is not null
    and household_id in (select public.user_household_ids())
  )
  with check (
    household_id is not null
    and household_id in (select public.user_household_ids())
  );

drop policy if exists "Investments manageable by household" on public.investments;
create policy "Investments manageable by household"
  on public.investments for all
  using (
    household_id is not null
    and household_id in (select public.user_household_ids())
  )
  with check (
    household_id is not null
    and household_id in (select public.user_household_ids())
  );

create or replace function public.accept_household_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.household_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  select email into v_email from public.profiles where id = v_user_id;

  if v_email is null or btrim(v_email) = '' then
    raise exception 'Your profile email is required to accept a household invite.';
  end if;

  select *
  into v_invite
  from public.household_invites
  where id = p_invite_id
    and status = 'pending'
    and expires_at > now()
    and lower(email) = lower(v_email);

  if not found then
    raise exception 'Invite not found, expired, or sent to a different email.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_user_id, v_invite.role)
  on conflict (household_id, user_id) do update
    set role = excluded.role;

  update public.profiles
  set household_id = v_invite.household_id,
      updated_at = now()
  where id = v_user_id;

  update public.household_invites
  set status = 'accepted'
  where id = v_invite.id;

  update public.accounts
  set household_id = v_invite.household_id
  where user_id = v_user_id
    and household_id is null;

  update public.bills
  set household_id = v_invite.household_id
  where user_id = v_user_id
    and household_id is null;

  update public.goals
  set household_id = v_invite.household_id
  where user_id = v_user_id
    and household_id is null;

  update public.transactions
  set household_id = v_invite.household_id
  where user_id = v_user_id
    and household_id is null;

  update public.investments
  set household_id = v_invite.household_id
  where user_id = v_user_id
    and household_id is null;

  return v_invite.household_id;
end;
$$;

grant execute on function public.accept_household_invite(uuid) to authenticated;

drop policy if exists "Profiles readable by household members" on public.profiles;
create policy "Profiles readable by household members"
  on public.profiles for select
  using (
    id in (
      select hm.user_id
      from public.household_members hm
      where hm.household_id in (select public.user_household_ids())
    )
  );
