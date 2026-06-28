-- Household management RPCs: leave, remove member, transfer ownership, revoke invite.

create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to leave a household.';
  end if;

  select household_id into v_household_id
  from public.profiles
  where id = v_user_id;

  if v_household_id is null then
    select hm.household_id, hm.role
    into v_household_id, v_role
    from public.household_members hm
    where hm.user_id = v_user_id
    limit 1;
  else
    select hm.role into v_role
    from public.household_members hm
    where hm.household_id = v_household_id
      and hm.user_id = v_user_id;
  end if;

  if v_household_id is null then
    raise exception 'You are not in a household.';
  end if;

  if v_role = 'owner' then
    raise exception 'Transfer ownership to another member before leaving.';
  end if;

  delete from public.household_members
  where household_id = v_household_id
    and user_id = v_user_id;

  update public.profiles
  set household_id = null,
      updated_at = now()
  where id = v_user_id;
end;
$$;

create or replace function public.remove_household_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_caller_id is null then
    raise exception 'You must be signed in.';
  end if;

  if p_user_id is null then
    raise exception 'Member user id is required.';
  end if;

  if p_user_id = v_caller_id then
    raise exception 'Use leave household to remove yourself.';
  end if;

  select id into v_household_id
  from public.households
  where owner_id = v_caller_id;

  if v_household_id is null then
    raise exception 'Only the household owner can remove members.';
  end if;

  if not exists (
    select 1
    from public.household_members
    where household_id = v_household_id
      and user_id = p_user_id
  ) then
    raise exception 'User is not a member of this household.';
  end if;

  delete from public.household_members
  where household_id = v_household_id
    and user_id = p_user_id;

  update public.profiles
  set household_id = null,
      updated_at = now()
  where id = p_user_id
    and household_id = v_household_id;
end;
$$;

create or replace function public.transfer_household_ownership(p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_caller_id is null then
    raise exception 'You must be signed in.';
  end if;

  if p_new_owner_id is null then
    raise exception 'New owner user id is required.';
  end if;

  if p_new_owner_id = v_caller_id then
    raise exception 'You are already the owner.';
  end if;

  select id into v_household_id
  from public.households
  where owner_id = v_caller_id;

  if v_household_id is null then
    raise exception 'Only the household owner can transfer ownership.';
  end if;

  if not exists (
    select 1
    from public.household_members
    where household_id = v_household_id
      and user_id = p_new_owner_id
  ) then
    raise exception 'New owner must be an existing household member.';
  end if;

  update public.households
  set owner_id = p_new_owner_id,
      updated_at = now()
  where id = v_household_id;

  update public.household_members
  set role = 'owner'
  where household_id = v_household_id
    and user_id = p_new_owner_id;

  update public.household_members
  set role = 'member'
  where household_id = v_household_id
    and user_id = v_caller_id;
end;
$$;

create or replace function public.revoke_household_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_caller_id is null then
    raise exception 'You must be signed in.';
  end if;

  if p_invite_id is null then
    raise exception 'Invite id is required.';
  end if;

  select id into v_household_id
  from public.households
  where owner_id = v_caller_id;

  if v_household_id is null then
    raise exception 'Only the household owner can revoke invites.';
  end if;

  update public.household_invites
  set status = 'revoked'
  where id = p_invite_id
    and household_id = v_household_id
    and status = 'pending';

  if not found then
    raise exception 'Pending invite not found.';
  end if;
end;
$$;

grant execute on function public.leave_household() to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
grant execute on function public.transfer_household_ownership(uuid) to authenticated;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
