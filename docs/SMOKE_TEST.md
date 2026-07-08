# Buxme phone smoke test

Run this checklist on **production** (https://buxme.co) before inviting beta users.
Use a **real phone** — not desktop responsive mode alone.

## Devices

- [ ] iPhone — Mobile Safari
- [ ] iPhone — Mobile Chrome (optional)
- [ ] Android — Chrome

## Account & auth

- [ ] **Create account** — register with a new email
- [ ] **Verify email** — confirmation link opens and completes
- [ ] **Complete onboarding** — guided flow finishes; dashboard loads
- [ ] **Log out** — session cleared; protected routes redirect to login
- [ ] **Log back in** — existing data still present
- [ ] **Forgot password** — reset email arrives; new password works

## Bank sync (Plaid)

- [ ] **Connect bank** — Plaid Link opens and completes (use a non-OAuth institution first, e.g. Chase)
- [ ] **Accounts appear** — Settings → Connected institutions shows cash (and debt if applicable)
- [ ] **Sync transactions** — Transactions page populates after connect
- [ ] **OAuth resume** (if testing OAuth bank) — `/oauth/plaid` resumes after redirect

## Core data entry

- [ ] **Create income** — Income → Sources → add source; appears in list
- [ ] **Create bill** — Bills → add bill; shows on dashboard “Bills due soon”
- [ ] **Create Income Plan** — Income → Paycheck plan → save; Next Paycheck card updates
- [ ] **Create goal** — Goals (More → Goals) → add goal; progress shows on dashboard

## Household

- [ ] **Invite household member** — Settings → Household → send invite
- [ ] **Invite email** — recipient receives email with working link
- [ ] **Accept invite** — second account joins household; shared data visible

## Mobile UX

- [ ] **Bottom nav** — Home · Accounts · Income · Bills · More
- [ ] **More sheet** — Goals, Calendar, Transactions, Debt, Investments, Reports, Household, Settings, Support
- [ ] **Dashboard priority** — Safe to Spend, Next Paycheck, Bills, Goals, Recent Activity visible without scrolling far
- [ ] **No horizontal scroll** — main pages don’t require sideways scrolling
- [ ] **Modals full-screen** — add/edit flows use full-screen sheets on phone
- [ ] **Tap targets** — buttons easy to tap; no mis-taps on nav

## Support

- [ ] **Support** — More → Support opens feedback form
- [ ] **Submit feedback** — submission succeeds

## Pass criteria

All **Account**, **Bank sync**, **Core data entry**, and **Mobile UX** items must pass on at least one iOS and one Android device.

Household and OAuth bank tests are required if you promote those features in beta.

## If something fails

1. Note device, browser, and exact step
2. Check browser console / network tab if possible
3. Submit via More → Support with screenshot
4. Check Vercel logs and Supabase for the user id
