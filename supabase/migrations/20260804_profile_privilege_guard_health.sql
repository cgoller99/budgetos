-- RPC used by /api/health/supabase to confirm the privilege guard trigger exists.
-- Safe to re-run. Does not expose credentials; returns a boolean only.

create or replace function public.profile_privilege_guard_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and t.tgname = 'guard_profile_privileged_columns'
      and not t.tgisinternal
  );
$$;

revoke all on function public.profile_privilege_guard_active() from public;
revoke all on function public.profile_privilege_guard_active() from anon;
revoke all on function public.profile_privilege_guard_active() from authenticated;
grant execute on function public.profile_privilege_guard_active() to service_role;

comment on function public.profile_privilege_guard_active() is
  'Returns true when guard_profile_privileged_columns exists on public.profiles.';
