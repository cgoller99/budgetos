-- Remove older duplicate pending rows, keep the newest per household + email.
delete from public.household_invites hi
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by household_id, lower(email)
        order by created_at desc
      ) as row_num
    from public.household_invites
    where status = 'pending'
  ) ranked
  where ranked.row_num > 1
) duplicates
where hi.id = duplicates.id;

-- Prevent duplicate pending invites for the same household + email.
create unique index if not exists household_invites_pending_unique_idx
  on public.household_invites (household_id, lower(email))
  where status = 'pending';
