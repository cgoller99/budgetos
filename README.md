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
vercel env pull .env.local --environment=production
```

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
| `npm run verify:production` | Full production readiness audit (env, Supabase, Plaid, Stripe, lint, build) |
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
