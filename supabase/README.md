# BudgetOS Supabase

Production backend for BudgetOS. All finance data, notifications, and onboarding state live in Supabase with Row Level Security enabled.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Apply schema (choose one):
   - **SQL editor:** run `schema.sql`
   - **CLI:** `supabase link` then `supabase db push`

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

All tables use RLS policies scoped to `auth.uid() = user_id`.
