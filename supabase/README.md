# Buxme Supabase

Production backend for Buxme. All finance data, notifications, and onboarding state live in Supabase with Row Level Security enabled.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Apply schema (choose one):
   - **SQL editor:** run `schema.sql`, then run every file in `migrations/` oldest first
   - **CLI:** `supabase link` then `supabase db push`
4. **Household sharing requires** the SQL **contents** of `migrations/20260628_household_complete.sql`:
   - Open that file in your repo, copy **all** of it, paste into Supabase Dashboard → **SQL Editor** → **New query**, then click **Run**
   - Do **not** paste the filename/path (e.g. `supabase/migrations/...`) — that is not SQL
   - Or use CLI: `supabase link` then `supabase db push`
5. Verify: `npm run verify:supabase`

## Structure

```
supabase/
├── config.toml          # Local CLI config
├── schema.sql           # Full schema + RLS (reference)
├── migrations/          # Incremental migrations
└── README.md
```

## Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile + onboarding state |
| `accounts` | Cash accounts and debt rows |
| `transactions` | Ledger + recurring income |
| `bills` | Recurring bills |
| `goals` | Savings goals |
| `investments` | Investment holdings |
| `recurring_items` | Recurring schedule metadata |
| `notifications` | Activity / notification events |
| `households` | Shared household container |
| `household_members` | Household membership |
| `household_invites` | Pending partner invites |

All tables use RLS policies scoped to `auth.uid() = user_id`. Household finance rows also allow access when `household_id` matches a household the user belongs to.
