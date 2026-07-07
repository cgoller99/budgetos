# Buxme

**Everything about your money.**

Buxme is a personal finance web app for tracking accounts, income, bills, transactions, savings goals, debt, and reports — built with Next.js and Supabase.

Production: [https://buxme.co](https://buxme.co)

## Getting started

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy environment variables into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_DB_URL=
NEXT_PUBLIC_SITE_URL=https://buxme.co
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@buxme.co
RESEND_FROM_NAME=Buxme

# Plaid (Production)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=production
PLAID_TOKEN_ENCRYPTION_KEY=
PLAID_WEBHOOK_URL=https://buxme.co/api/plaid/webhook
NEXT_PUBLIC_PLAID_ENABLED=true
```

See `.env.local.example` for the full template.

### Plaid production setup

1. In the [Plaid Dashboard](https://dashboard.plaid.com/), switch to **Production** keys (not Sandbox).
2. Set these in `.env.local` and Vercel:
   - `PLAID_ENV=production`
   - `PLAID_CLIENT_ID` / `PLAID_SECRET` (production keys)
   - `PLAID_WEBHOOK_URL=https://buxme.co/api/plaid/webhook`
   - `PLAID_TOKEN_ENCRYPTION_KEY` (32+ character random string)
   - `NEXT_PUBLIC_PLAID_ENABLED=true`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for webhook processing)
3. Register `https://buxme.co/api/plaid/webhook` in the Plaid Dashboard.
4. Link token creation automatically attaches the production webhook URL to new Items.
5. Webhook requests are verified with Plaid JWT signatures (`Plaid-Verification` header) in production.

Verify configuration and webhook reachability:

```bash
npm run verify:plaid
```

**Note:** Sandbox bank connections do not carry over. Users must reconnect after switching to production keys.

3. Apply Supabase migrations from `supabase/migrations/`.

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run verify:supabase` | Verify Supabase connectivity |
| `npm run verify:plaid` | Verify Plaid production env and webhook health |
| `npm run debug:household-invite-email` | Test invite email delivery |

## Stack

- **Next.js 16** — App Router, React 19
- **Supabase** — Auth, Postgres, RLS
- **Resend** — Transactional email
- **Plaid** — Production bank linking, JWT-verified webhooks, transaction sync
- **Tailwind CSS 4** — UI styling

## Legacy domain

The previous domain `budgetos.co` may remain configured as a redirect at the DNS/Vercel level. Application code uses `NEXT_PUBLIC_SITE_URL` for all links and callbacks.
