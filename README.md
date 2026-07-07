# Buxme

**Everything about your money.**

Buxme is a personal finance web app for tracking accounts, income, bills, transactions, savings goals, debt, and reports — built with Next.js and Supabase.

Production: [https://buxme.co](https://buxme.co)

## Getting started

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Pull production environment variables to your new dev machine:

```bash
cp .env.local.example .env.local
npm run sync:env
vercel env pull .env.local --environment=production
npm run sync:env
```

`sync:env` pulls public vars (Supabase anon key, site URL, defaults) from the live site without overwriting server secrets. **`env:pull` runs `vercel env pull` then merges public vars only** — it no longer runs a full `sync:env` that commented out empty Vercel values.

If variables appear **missing** after pull, run `npm run audit:env` to see whether they are absent or **empty in Vercel Production** (dashboard values never saved).

If you do not use the Vercel CLI, copy every Production variable manually from **Vercel → Project → Settings → Environment Variables**.

3. Apply Supabase migrations from `supabase/migrations/` if needed (oldest first).

4. Verify your environment:

```bash
npm run verify:production
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification scripts

| Command | Description |
|---------|-------------|
| `npm run sync:env` | Pull public env vars from buxme.co into `.env.local` |
| `npm run setup:production` | Full setup: sync env, Vercel pull, Supabase SQL, verify |
| `npm run audit:remote` | Probe live buxme.co for Plaid/Resend configuration gaps |
| `npm run verify:production` | Full production readiness audit (env, Supabase, Plaid, Stripe, Resend, build) |
| `npm run verify:resend` | Resend API key and sender configuration |
| `npm run env:pull` | Pull Vercel Production secrets, merge public vars (does not wipe secrets) |
| `npm run audit:env` | Diagnose missing/empty env vars + full checklist by service |
| `npm run audit:env -- --vercel` | Compare `.env.local` with Vercel Production |
| `npm run verify:env` | All required environment variables |
| `npm run verify:supabase` | Supabase connectivity, tables, RLS, storage |
| `npm run verify:plaid` | Plaid Production credentials and webhook |
| `npm run verify:stripe` | Stripe Live Mode keys and price IDs |
| `npm run debug:household-invite-email` | Test invite email delivery |

## Stack

- **Next.js 16** — App Router, React 19
- **Supabase** — Auth, Postgres, RLS, Realtime
- **Plaid** — Production bank linking and transaction sync
- **Stripe** — Live subscriptions (Pro / Pro+)
- **Resend** — Transactional email
- **PostHog** — Product analytics
- **Tailwind CSS 4** — UI styling

## Legacy domain

The previous domain `budgetos.co` may remain configured as a redirect at the DNS/Vercel level. Application code uses `NEXT_PUBLIC_SITE_URL` for all links and callbacks.
