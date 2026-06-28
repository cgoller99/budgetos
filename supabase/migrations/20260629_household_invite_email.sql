-- Public invite preview by token (for email links before sign-in).
create or replace function public.get_household_invite_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', hi.id,
    'household_name', h.name,
    'invite_email', hi.email,
    'expires_at', hi.expires_at,
    'status', hi.status
  )
  into v_result
  from public.household_invites hi
  join public.households h on h.id = hi.household_id
  where hi.token = p_token
    and hi.status = 'pending'
    and hi.expires_at > now()
  limit 1;

  return v_result;
end;
$$;

grant execute on function public.get_household_invite_by_token(text) to anon, authenticated;
