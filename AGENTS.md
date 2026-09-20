<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Buxme is a single Next.js 16 (App Router, Turbopack) web app backed by Supabase (auth + Postgres + RLS), with optional Plaid/Stripe/Resend/PostHog integrations. There is only one runnable service: the Next.js dev server.

### Standard commands (see `package.json` / `.github/workflows/ci.yml`)
- Dev server: `npm run dev` → http://localhost:3000. It reads `.env.local`; **restart it after editing `.env.local`** (env is not hot-reloaded).
- Lint: `npm run lint` (passes with only warnings, 0 errors).
- Build: `npm run build`.
- CI tests: the `npm run test:*` scripts (e.g. `test:finance-calculations`, `test:income-annualization`, …) are pure, self-contained Node assertions — no DB or secrets needed. CI runs the exact set listed in `.github/workflows/ci.yml`.

### Env / secrets caveats
- The app degrades gracefully when Supabase is unconfigured: marketing pages render, but auth/finance pages show a "Supabase is not configured" state. Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable them.
- The `verify:*` / `audit:*` / `setup:*` scripts target the **live production** project (buxme.co) and real Plaid/Stripe/Resend secrets. They are NOT needed for local dev and will fail without production credentials — don't treat their failure as a broken environment.
- For local dev, set `NEXT_PUBLIC_STRIPE_ENABLED=false` and `NEXT_PUBLIC_PLAID_ENABLED=false` so `proxy.ts` subscription gating and bank-connect flows are skipped.

### Running a real backend locally (local Supabase) — non-obvious gotchas
Needed only for auth/data work (register, onboarding, dashboard). Requires Docker + the Supabase CLI (`supabase`), which are **not** in the update script; install them once if absent (Docker must run with `storage-driver: fuse-overlayfs` and iptables-legacy in this VM).
- `supabase start` auto-applies only `supabase/migrations/`, and the **first migration fails** because the migrations assume `supabase/schema.sql` was applied first (`relation "public.profiles" does not exist`). Do NOT rely on auto-migration. Instead bring the DB up cleanly, then apply SQL in this order: `schema.sql` first, then every file in `supabase/migrations/` sorted oldest→newest, via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"`. `20260627_backend_tables.sql` errors on a duplicate enum type already defined in `schema.sql` — that failure is benign (its tables/policies already exist in `schema.sql`).
- After applying SQL directly as the `postgres` role, PostgREST/API calls return `permission denied for table ...` (e.g. `/api/beta/access` → `service_unavailable`). The local Postgres default only grants `Dxt` (not DML) to `anon`/`authenticated`/`service_role`. Fix with the standard Supabase grants: `grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;` (plus sequences/functions) and matching `alter default privileges`.
- `.env.local` should point at `http://127.0.0.1:54321` with the local demo anon/service_role keys printed by `supabase start`. `supabase/config.toml` disables email confirmation, so signup logs the user in immediately; beta is not invite-only by default, so registration is open.
