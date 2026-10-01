-- Stage 2.5: bank_connections credentials are owner-only.
--
-- BEFORE:
--   "Bank connections manageable by owner"  FOR ALL  (auth.uid() = user_id)
--   "Bank connections readable by household" FOR SELECT
--     (auth.uid() = user_id OR household_id IN user_household_ids())
--
-- AFTER:
--   Owner FOR ALL only. Household members must NOT SELECT connection rows
--   (including access_token_encrypted / iv / tag). Shared accounts/transactions
--   remain available via accounts/transactions household policies.
--
-- Server/admin Plaid sync + webhooks use service_role and are unaffected.
-- App listConnections/getConnection* already filter by user_id.

drop policy if exists "Bank connections readable by household"
  on public.bank_connections;

-- Ensure owner policy remains present (idempotent recreate).
drop policy if exists "Bank connections manageable by owner"
  on public.bank_connections;

create policy "Bank connections manageable by owner"
  on public.bank_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.bank_connections is
  'Plaid Item credentials are owner-only. Household members share finance rows (accounts/transactions), not bank_connections secrets.';
