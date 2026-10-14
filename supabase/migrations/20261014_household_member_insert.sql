-- Authenticated users must not be able to insert themselves into an
-- arbitrary household. That membership is what user_household_ids() uses
-- to grant select on shared accounts, transactions, bills, goals, and
-- income plans.
--
-- The household owner can insert only their own membership, which is how
-- household creation records the owner. Other members join through
-- accept_household_invite(), which is security definer and checks the invite.

drop policy if exists "Household members insertable by owner" on public.household_members;

create policy "Household members insertable by owner"
  on public.household_members for insert
  with check (
    auth.uid() = user_id
    and household_id in (
      select id from public.households where owner_id = auth.uid()
    )
  );
