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
2. Set `PLAID_ENV=production` in `.env.local` and in Vercel project environment variables.
3. Set `PLAID_WEBHOOK_URL` to your public webhook endpoint (e.g. `https://buxme.co/api/plaid/webhook`) and register the same URL in Plaid.
4. Generate a secure random string (32+ characters) for `PLAID_TOKEN_ENCRYPTION_KEY`.
5. Set `NEXT_PUBLIC_PLAID_ENABLED=true` and redeploy.

**Note:** Sandbox bank connections do not carry over to production. Users will need to reconnect their banks after the switch.

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
| `npm run debug:household-invite-email` | Test invite email delivery |

## Stack

- **Next.js 16** — App Router, React 19
- **Supabase** — Auth, Postgres, RLS
- **Resend** — Transactional email
- **Plaid** — Bank account linking and transaction sync (Production)
- **Tailwind CSS 4** — UI styling

## Legacy domain

The previous domain `budgetos.co` may remain configured as a redirect at the DNS/Vercel level. Application code uses `NEXT_PUBLIC_SITE_URL` for all links and callbacks.
