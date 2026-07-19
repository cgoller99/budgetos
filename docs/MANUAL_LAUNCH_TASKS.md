# Manual launch tasks (requires you)

These items cannot be completed in code alone. Do them in order before a hard public or paid launch.

## P0 — Before widening access

### 1. Real-device smoke test
Run every checkbox in [docs/SMOKE_TEST.md](./SMOKE_TEST.md) on:
- iPhone Safari (required)
- Android Chrome (required)

### 2. Plaid DTM (production Link)
1. Open https://dashboard.plaid.com/link/data-transparency-v5
2. Publish use cases: Track finances, Invest, Pay down debt
3. Verify: `npm run audit:remote`

### 3. Supabase auth URLs
```bash
npm run configure:supabase-auth-urls
```
Confirm in Supabase Dashboard → Authentication → URL configuration:
- Site URL: `https://buxme.co`
- Redirect URLs include `/auth/callback`, `/auth/confirm`, `/oauth/plaid`

### 4. Production env vars (Vercel)
Set in **Vercel → Project → Settings → Environment Variables**:

| Variable | Required for | Notes |
|----------|--------------|-------|
| `ADMIN_EMAILS` | Admin dashboard | Comma-separated admin emails |
| `FOUNDER_EMAILS` | Founder bypass | Your email for full access |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics | From PostHog project settings |
| `NEXT_PUBLIC_POSTHOG_HOST` | Analytics | `https://us.i.posthog.com` |

Verify: `curl -s https://buxme.co/api/health/launch | jq .`

### 5. Beta policy decision
In **Admin → Beta** (or Supabase `beta_settings`):
- **Open launch:** set `invite_only = false`
- **Invite-only:** keep `invite_only = true` and approve users from waitlist

---

## P0 — Paid launch only

### 6. Stripe live mode
In Stripe Dashboard (live mode):
1. Create webhook: `https://buxme.co/api/stripe/webhook`
2. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
3. Copy webhook signing secret

On Vercel:
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PRO_PLUS_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...        # optional; auto-resolved from product if omitted
STRIPE_PRO_PLUS_YEARLY_PRICE_ID=price_...   # optional
NEXT_PUBLIC_STRIPE_ENABLED=true
```

Or run locally with production creds:
```bash
npm run configure:public-launch
```

Verify:
```bash
npm run audit:public-launch
curl -s https://buxme.co/api/stripe/webhook | jq .
# POST without signature should return 400, NOT 503
```

### 7. Live billing smoke test
Complete [docs/SMOKE_TEST.md §7](./SMOKE_TEST.md): checkout → portal → cancel → upgrade/downgrade with a real card in live mode (refund after).

---

## P1 — Recommended before marketing push

### 8. OAuth banks (optional, slow)
Register OAuth institutions (e.g. Schwab) at https://dashboard.plaid.com/activity/status/oauth-institutions — approval can take weeks.

### 9. Domain email (optional)
If you want `support@buxme.com` instead of `support@buxme.co`, configure DNS for buxme.com and update `lib/legal/constants.ts`.

### 10. Post-launch monitoring
- Watch Vercel deployment logs on launch day
- Check Admin → Health and Admin → Feedback daily for first week
- PostHog funnel: signup → onboarding complete → bank connect

---

## Quick verification commands

```bash
npm run audit:remote              # closed beta health
npm run audit:public-launch       # paid public launch (needs live Stripe)
npm run verify:production         # full check (needs .env.local with secrets)
```

---

## What was fixed in code (this pass)

- Beta gate fail-closed (`/api/beta/access`, `AuthGate` profile errors)
- ESLint errors (ProfileMenu positioning, DonutChart)
- CI pipeline (`.github/workflows/ci.yml`)
- Landing copy (nav, hero, FAQ, social proof, support email → `@buxme.co`)
- Yearly billing support in Stripe checkout + pricing links
- Reports / Settings upgrade banners
- Open Graph image (`app/opengraph-image.tsx`)
