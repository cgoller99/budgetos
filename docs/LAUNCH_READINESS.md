# Buxme launch readiness

Last updated for closed beta on **https://buxme.co**.

## Quick status

| Item | Beta required? | How to verify |
|------|----------------|---------------|
| Code deployed | Yes | `main` on Vercel Production |
| Plaid + Resend | Yes | `npm run audit:remote` |
| Supabase RLS | Yes | `npm run verify:supabase` |
| Plaid DTM | Yes | Plaid Dashboard (manual) |
| Phone smoke test | Yes | [SMOKE_TEST.md](./SMOKE_TEST.md) |
| Stripe webhook | Paid only | `GET /api/stripe/webhook` |
| PostHog | Recommended | `GET /api/health/launch` |
| Supabase auth URLs | Yes | `npm run configure:supabase-auth-urls` |
| CRON_SECRET | Yes | `GET /api/health/launch` |

---

## 1. Supabase RLS

**Issue:** `admin_feedback_reports` had policies but RLS was not enabled.

**Fix (production database):**

```bash
npm run apply:admin-feedback-rls
```

Or paste `supabase/migrations/20260709_admin_feedback_rls.sql` into **Supabase → SQL Editor**.

**Verify:**

```bash
curl -s https://buxme.co/api/health/supabase | jq .
npm run verify:supabase
```

Expect `adminFeedbackRlsEnabled: true` and **27/27** tables blocking anonymous writes locally.

**Household sharing:** unchanged — uses `user_household_ids()` policies in `20260628_household_complete.sql`.

---

## 2. Plaid DTM (Data Transparency Messaging)

Plaid Link in **production** requires published use cases.

1. Open [Plaid DTM dashboard](https://dashboard.plaid.com/link/data-transparency-v5)
2. Publish at least:
   - Track and manage your finances
   - Invest your money
   - Pay down debt
3. Optional: create a Link customization and set `PLAID_LINK_CUSTOMIZATION_NAME` on Vercel

**Verify Plaid:**

```bash
npm run audit:remote
```

Check `GET https://buxme.co/api/plaid/webhook` → `configured: true`, `environment: production`.

### OAuth banks (external)

Institutions like **Schwab** require separate registration:

https://dashboard.plaid.com/activity/status/oauth-institutions

Approval can take **weeks**. This is not a code bug.

---

## 3. Stripe (paid launch only)

**Do not enable paid tiers until webhook passes.**

1. Stripe Dashboard → **Developers → Webhooks**
2. Add endpoint: `https://buxme.co/api/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy signing secret → Vercel **`STRIPE_WEBHOOK_SECRET`**
5. Confirm live keys on Vercel:
   - `STRIPE_SECRET_KEY` (`sk_live_…`)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`)
   - `STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_PLUS_PRICE_ID`
   - `NEXT_PUBLIC_STRIPE_ENABLED=true`

**Verify:**

```bash
curl -s https://buxme.co/api/stripe/webhook | jq .
# webhookConfigured should be true

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://buxme.co/api/stripe/webhook
# should be 400 (missing signature), NOT 503
```

**Helper (local, with Stripe secret):**

```bash
npm run setup:stripe-webhook
```

Test manually: checkout → billing portal → cancel → upgrade/downgrade.

---

## 4. PostHog analytics

Set on **Vercel Production**:

- `NEXT_PUBLIC_POSTHOG_KEY` (`phc_…`)
- `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com`)

**Verify:** `GET https://buxme.co/api/health/launch` → `posthogConfigured: true`

### Event names (app → PostHog)

| Checklist name | PostHog event |
|----------------|---------------|
| signup | `account_created` |
| login | `login` |
| onboarding_complete | `completed_onboarding` |
| plaid_connected | `connected_plaid` |
| income_plan_created | `created_income_plan` |
| bill_created | `added_bill` |
| goal_created | `created_goal` |
| subscription_started | `subscription_started` |

---

## 5. Supabase Auth URLs

In **Supabase → Authentication → URL Configuration**:

| Setting | Value |
|---------|--------|
| Site URL | `https://buxme.co` |
| Redirect URLs | `https://buxme.co/auth/callback` |
| | `https://buxme.co/household/invite/*` |
| | `http://localhost:3000/auth/callback` |

Print full list:

```bash
npm run configure:supabase-auth-urls
```

Set `SUPABASE_ACCESS_TOKEN` to auto-apply via Management API.

---

## 6. CRON_SECRET

Vercel Cron runs `/api/cron/run-paychecks` daily (06:00 UTC).

- Set **`CRON_SECRET`** on Vercel Production (`openssl rand -hex 32`)
- Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`

**Verify:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://buxme.co/api/cron/run-paychecks
# expect 401 without secret

curl -s https://buxme.co/api/health/launch | jq .cronSecretConfigured
# expect true
```

---

## 7. Mobile layout (shipped)

- Bottom nav: Home · Accounts · Income · Bills · More
- More: Goals, Calendar, Transactions, Debt, Investments, Reports, Household, Settings, Support
- Dashboard mobile stack: Safe to Spend → Next Paycheck → Bills → Goals → Recent Activity
- Collapsible sections for secondary content
- Full-screen modals on small screens
- Income tabs use 2×2 grid (no horizontal tab scroll)
- Report charts fit viewport width

---

## 8. Full verification commands

```bash
npm run build
npm run lint
npm run verify:supabase
npm run verify:plaid
npm run verify:stripe
npm run verify:resend
npm run verify:production
npm run audit:remote
```

After `vercel env pull .env.local --environment=production` on your machine (secrets are not readable in CI sandboxes).

---

## Closed beta verdict

**Safe for closed beta when:**

- ✅ RLS migration applied (`verify:supabase` green)
- ✅ Plaid DTM published
- ✅ Phone smoke test passed
- ✅ Supabase auth URLs confirmed
- ✅ CRON_SECRET set
- ⚠ Stripe webhook optional if beta stays free
- ⚠ PostHog recommended before scaling invites
