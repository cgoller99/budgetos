# Stage 2.5 — Household bank_connections security

## Confirmed issue

Household membership previously allowed peers to `SELECT` `bank_connections`, including encrypted Plaid token columns (`access_token_encrypted`, IV/tag fields). App-layer select allowlists are defense-in-depth only; a crafted Supabase client can query subject to RLS.

## Existing RLS (before)

From `supabase/migrations/20260704_plaid_integration.sql` + `20260627_feature_expansion.sql`:

| Policy | Command | Predicate |
| --- | --- | --- |
| `Bank connections manageable by owner` | `FOR ALL` | `auth.uid() = user_id` |
| `Bank connections readable by household` | `FOR SELECT` | owner **OR** `household_id IN user_household_ids()` |

Ownership columns: `user_id`, `household_id`. Sensitive columns live on the same row as institution metadata.

## Dependency audit

| Flow | Access path | Needs household peer SELECT? |
| --- | --- | --- |
| Plaid sync / webhook | `createSupabaseAdminClient` (service role) | No |
| Exchange / create connection | Admin + owning `auth.user.id` | No |
| Reconnect | Owner connection by `user_id` | No |
| Disconnect / remove bank | `getConnectionById(userId, …)` | No |
| App list/map connections | `listConnections(userId)` filters `user_id` | No |
| Shared accounts / transactions | Separate tables + household RLS | No (credentials not required) |

**Verdict:** Safe to drop household SELECT. No production flow requires peer access to `bank_connections`.

## Proposed / applied policy change

Migration: `supabase/migrations/20261001_bank_connections_owner_only.sql`

1. `DROP POLICY "Bank connections readable by household"`
2. Recreate owner `FOR ALL` with `using` + `with check` on `auth.uid() = user_id`

After:

| Policy | Command | Predicate |
| --- | --- | --- |
| `Bank connections manageable by owner` | `FOR ALL` | `auth.uid() = user_id` |

Household members continue to see shared `accounts` / `transactions` via those tables’ policies. They must not inherit Plaid Item credentials.

## Apply

```bash
npm run apply:bank-connections-owner-rls
```

Requires production Supabase credentials in `.env.local`. Until applied remotely, the migration file is the source of truth for deployment.

## Regression test

```bash
npm run test:bank-connections-owner-rls
```

Asserts migration drops household SELECT, owner policy remains, app repository scopes by `user_id` + client column allowlist, and Plaid routes use admin/owner auth.
