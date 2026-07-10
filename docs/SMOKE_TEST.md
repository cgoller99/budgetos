# Buxme public release smoke test

Run on **production** (https://buxme.co) before full public launch.
Use **real phones** — iPhone Safari and Android Chrome minimum. Desktop responsive mode alone is not sufficient.

## Devices

- [ ] iPhone — Mobile Safari (required)
- [ ] Android — Chrome (required)
- [ ] iPhone — Mobile Chrome (optional)

---

## 1. Account & authentication

- [ ] **Register** — new email, password meets requirements
- [ ] **Verify email** — confirmation link opens and completes signup
- [ ] **Login** — existing credentials work
- [ ] **Logout** — session cleared; protected routes redirect to login
- [ ] **Log back in** — data still present
- [ ] **Forgot password** — reset email arrives (check spam)
- [ ] **Reset password** — new password works on login

---

## 2. Onboarding

- [ ] Guided onboarding completes without errors
- [ ] Dashboard loads after onboarding
- [ ] Safe to Spend, Next Paycheck, Bills, Goals, Recent Activity visible on mobile Home

---

## 3. Plaid bank sync

- [ ] **Connect bank** — Plaid Link opens and completes (non-OAuth institution first, e.g. Chase)
- [ ] **Accounts appear** — correct institution, account name, type, last-four mask, balance
- [ ] **Transactions sync** — Transactions page populates after connect
- [ ] **Annual income** — Income page shows personal annual income only (not household-inflated)
- [ ] **Transfers not income** — account transfers do not inflate income totals
- [ ] **Disconnect** — Settings → Connected institutions → disconnect works
- [ ] **Reconnect** — link again; no duplicate accounts or duplicate income streams
- [ ] **Re-sync** — manual sync or webhook updates balances/transactions
- [ ] **OAuth bank** (if applicable) — `/oauth/plaid` resumes after redirect

---

## 4. Core financial data

- [ ] **Create income** — Income → Sources; appears in list and annual income updates
- [ ] **Income Plan** — Income → Paycheck plan; Next Paycheck card updates
- [ ] **Create bill** — Bills → add; appears on dashboard “Bills due soon”
- [ ] **Create goal** — More → Goals; progress shows on dashboard
- [ ] **Edit account** — nickname, icon, preferences persist after refresh
- [ ] **Delete account** — manual and Plaid disconnect flows work
- [ ] **Net worth / Safe to Spend** — values consistent across Home and Accounts
- [ ] **Reports** — monthly trends load without horizontal scroll on mobile

---

## 5. Transactions

- [ ] **Transaction list** — filters work (type, category, date, merchant)
- [ ] **Edit Transaction modal** — no blur/ghosting behind modal; keyboard does not hide Save
- [ ] **Deep link** — dashboard card or insight link opens Transactions with correct filters
- [ ] **Single transaction link** — scrolls to row and briefly highlights it
- [ ] **Clear filters** — banner and Clear Filters button reset view

---

## 6. Household

- [ ] **Invite member** — Settings → Household → send invite
- [ ] **Invite email** — second device receives working link
- [ ] **Accept invite** — second account joins; shared bills/goals visible
- [ ] **Personal income** — each member’s Income page shows only their income (not combined)

---

## 7. Stripe billing (live mode)

Requires `sk_live_`, `pk_live_`, and `STRIPE_WEBHOOK_SECRET` on Vercel.

- [ ] **Checkout** — Settings → Billing → start Pro or Pro+ checkout
- [ ] **Payment succeeds** — redirect to Settings with success state
- [ ] **Subscription active** — plan badge shows active in Settings
- [ ] **Upgrade** — Pro → Pro+ (or reverse downgrade path)
- [ ] **Downgrade** — plan change reflects in Settings
- [ ] **Cancel** — cancel at period end; status updates
- [ ] **Failed payment** — (Stripe test clock or test card) profile shows `past_due` after webhook
- [ ] **Renewal** — subscription period end advances; access continues when paid

---

## 8. Mobile navigation & layout

Bottom nav: **Home · Accounts · Income · Bills · More**

More sheet: Goals, Calendar, Transactions, Debt, Investments, Reports, Household, Settings, Support

- [ ] **Home** — priority stack only above fold: Safe to Spend, Next Paycheck, Bills, Goals, Recent Activity
- [ ] **Accounts** — cards readable; no horizontal scroll
- [ ] **Income** — Paycheck plan first on mobile; history/forecast behind View more
- [ ] **Bills** — Paycheck split behind View more on mobile
- [ ] **More** — all links open correct pages
- [ ] **Modals** — full-screen on phone; close button reachable
- [ ] **Tap targets** — buttons ≥44px; no mis-taps on nav
- [ ] **No horizontal overflow** on any major page
- [ ] **Charts** — Reports trends readable on phone width

---

## 9. Support & feedback

- [ ] **Support** — More → Support opens feedback form
- [ ] **Submit feedback** — submission succeeds

---

## Pass criteria

All sections **1–5**, **8**, and **9** must pass on at least one iOS and one Android device.

Section **6** required if household is promoted at launch.

Section **7** required if paid subscriptions are enabled at launch.

---

## If something fails

1. Note device, browser, OS version, and exact step
2. Capture screenshot or screen recording
3. Check browser console / network tab if possible
4. Submit via More → Support with details
5. Check Vercel logs and Supabase for the user id
6. For Stripe: Stripe Dashboard → Developers → Webhooks → event log
7. For Plaid: Vercel logs filtered by `[plaid/`
