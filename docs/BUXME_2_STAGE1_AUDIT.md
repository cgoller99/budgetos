# Buxme 2.0 — Stage 1 Repository / Product Audit

**Status:** Read-only audit complete. No product code or schema changes in this stage.  
**Base:** `main` @ audit date  
**Scope:** Understand current Buxme before any Stage 2+ implementation.

---

## 1. Current architecture map

### Stack

| Layer | Reality |
| --- | --- |
| Framework | Next.js **16.3.4** App Router + React **19.2** |
| Hosting | Vercel (`buxme.co`); API routes + SSR |
| Data | Supabase Auth + Postgres + RLS |
| Banks | Plaid (production) — link, sync, webhooks |
| Web billing | Stripe Live (Pro / Pro+) |
| iOS billing | StoreKit via `@capgo/native-purchases` + Apple App Store Server API |
| Analytics | PostHog (`posthog-js`); **no Sentry** |
| Email | Resend |
| iOS shell | Capacitor 8 remote-URL shell → loads `https://buxme.co` |
| Styling | Tailwind CSS 4, dark-first CSS variables |

### High-level request / data flow

```
iOS Capacitor WebView  ──┐
Web browser              ─┼─► Next.js (SSR pages + API routes)
                          │
                          ├─► Supabase (Auth session cookies / client)
                          │     └─► Postgres tables + RLS
                          ├─► Plaid API (server-only token vault)
                          ├─► Stripe / Apple IAP verify (server-only)
                          └─► PostHog (client events)
```

### Client architecture (critical)

Almost all authenticated UI is **client-driven**:

1. `AppProviders` wraps Toast → Theme → Capacitor → Auth → Analytics → Household → **Finance**
2. Authenticated routes use `AuthGate` → `SubscriptionProvider` → `WhatsNewProvider` → `OnboardingGate` → `AppLayout`
3. `FinanceContext` (~2,078 lines) owns the in-memory finance model, CRUD mutations, Plaid refresh triggers, automation suggestions, and dashboard derivation
4. Mutations typically: optimistic/local apply → Supabase write → **`loadFinanceData` full reload** (~21 reload call sites in `FinanceService`)

### Server architecture

- **API routes:** ~69 (`app/api/**`) — Plaid, Stripe, Apple IAP, entitlements, household invite, cron, admin, feedback, health
- **Proxy/middleware:** `proxy.ts` — Supabase session refresh + admin/plan path gates
- **Domain libs:** `lib/finance`, `lib/plaid`, `lib/subscription`, `lib/iap`, `lib/allocation`, `lib/automation`, `lib/incomePlan`, `lib/calculations`, `lib/supabase/{repositories,services}`
- **Admin AI Team / Buxme OS:** large private founder tooling under `lib/ai-team` + `app/api/admin/ai-team` (orthogonal to consumer product; do not conflate with user-facing “AI insights”)

### Client vs server boundaries

| Concern | Boundary |
| --- | --- |
| Finance CRUD | Client `FinanceContext` → Supabase JS client (RLS) via `FinanceService` |
| Plaid link/sync | Client calls API → server uses encrypted access tokens |
| Entitlements | `/api/entitlements` + profile privilege guard (DB trigger) |
| Stripe / Apple | Server-only secrets; webhooks update `profiles` |
| Founder / admin | Email allowlist + `admin_founder_granted`; proxy gates `/admin` |

---

## 2. Existing feature inventory

### Authenticated product routes

| Route | Feature |
| --- | --- |
| `/dashboard` | Home — web cards **or** `IosHomeScreen` on native iOS |
| `/accounts` | Manual + Plaid accounts, disconnect, preferences |
| `/transactions` | List/filter/edit; transfer detection helpers |
| `/bills` | Recurring bills, splits, partial payments, recurring prompt |
| `/income` | Income sources hub |
| `/income/plan` | Paycheck / Income Plan + allocations |
| `/savings` | Goals |
| `/debt` | Debts + avalanche/snowball strategy UI |
| `/investments` | Investment accounts / contributions |
| `/reports` | Reports / insights surface (not hard-gated by Pro+) |
| `/calendar` | Cash-flow calendar events |
| `/roadmap` | Product roadmap |
| `/whats-new` | Release notes |
| `/settings` | Profile, billing (Stripe/IAP), household, notifications, deletion |

### Public / auth / onboarding

- Landing `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/onboarding`, `/auth/callback`, `/auth/confirm`, `/auth/complete`
- `/oauth/plaid`, `/household/invite/[token]`
- Legal: `/privacy`, `/terms`, `/security`, `/support`
- `/beta`, `/admin` (founder)

### Domain engines already in code

| Area | Location | Notes |
| --- | --- | --- |
| Safe-to-spend | `lib/finance/safeToSpend.ts` + `moneyFlow.ts` | Waterfall: income → bills → debts → goals → investments |
| Money flow / “plan” | `lib/finance/moneyFlow.ts`, dashboard cards | Not yet continuous Pro+ Money Plan |
| Net worth | `lib/calculations/netWorth.ts`, `NetWorthTimeline` | |
| Financial health score | `lib/calculations/financialHealth.ts` | Composite 0–100 with reasons |
| Smart insights | `lib/finance/financialEngine.ts` `buildSmartInsights` | Heuristic, limited |
| Recurring bills detection | `lib/plaid/recurringBillDetection.ts`, automation | Confirm/dismiss UX exists |
| Paycheck detection | `lib/automation/detectPaycheck.ts`, Plaid income detection | Suggests “Apply Income Plan” |
| Income Plan / paycheck alloc | `lib/incomePlan/*`, `lib/allocation/*` | Schedules, envelopes, ledger, forecast |
| Allocation forecast | `lib/allocation/forecastEngine.ts` | 30d/90d/6mo/1yr envelope forecast |
| Debt optimizer | `lib/finance/debts.ts` | Avalanche + snowball + interest estimates |
| Goals analytics | `lib/finance/goals.ts`, `goalAnalytics.ts` | Progress, insights |
| Transfer detection | `lib/transactions/transferDetection.ts` | Pattern + pairing heuristics |
| Global search | `lib/search/globalSearch.ts` + `GlobalSearch` | Substring search over loaded finance data |
| Notifications center | `lib/notifications/*`, in-app events | Preferences: bills/goals/household/weeklySummary |
| Automation suggestions | `lib/automation/*` | Max 3 suggestions; kinds listed below |
| Weekly plan / intelligence | `lib/intelligence/generateWeeklyPlan.ts` | |
| Demo mode | `lib/demo/*` | Onboarding demo profiles |

### Automation suggestion kinds (today)

`recurring_bill` · `paycheck_detected` · `goal_fundable` · `extra_paycheck_month` · `allocation_unfunded` · `emergency_fund_low`

### What is **not** a first-class feature today

- No dedicated **budgets** table/UI (analytics event `CREATED_BUDGET` exists; no budget CRUD)
- No natural-language financial search (“transactions over $100”)
- No push notification pipeline (in-app + preference flags only)
- No private-vs-shared household account model (see security)
- No continuous Pro+ Money Plan that recalculates on bill changes
- No merchant-learning categorization beyond Plaid PFC + user edits

---

## 3. Mobile architecture assessment

### Capacitor model

Documented in `docs/IOS_APP_STORE.md` and `capacitor.config.ts`:

- **Remote URL shell** — native app loads production web app
- Placeholder `native/www` for Capacitor sync only
- Native plugins: App, Browser, Haptics, Keyboard, SplashScreen, StatusBar, native-purchases
- Deep links + Apple App Site Association present

### Native presentation layer (partially built)

When `useNativeIos()` is true:

- `native-ios-shell` CSS, safe areas, compact top bar
- `MobileBottomNav` with **iOS-specific IA**: Home · Accounts · Bills · Debt (+ More sheet)
- Web mobile IA differs: Home · Accounts · Income · Bills (+ More)
- Dedicated screens under `components/native/ios/*` (Home, Accounts, Bills, Transactions, etc.)
- Pull-to-refresh, scroll restoration, haptics helpers, bottom-sheet-ish More menu
- Page transitions via `PageTransition`

### Honest assessment vs Buxme 2.0 “native app” bar

| Strength | Gap |
| --- | --- |
| Separate iOS Home and many iOS screens already exist | Still a **WebView of Next.js routes**, not native navigation stacks |
| Bottom tabs + More already chosen | Docs mention “Activity” tab; code uses **Debt** as 4th tab — IA drift |
| Safe areas / keyboard / haptics started | Many flows still feel like **web modals/forms** |
| Pull-to-refresh on major paths | No swipe actions on transactions; limited bottom sheets for edit |
| Dual web/iOS nav config | Risk of web regressions when “improving iOS” if shared components diverge poorly |

**Verdict:** Mobile shell Phase 4 should **extend** `components/native/ios` + `lib/mobile/navigation.ts`, not replace Capacitor or rebuild auth/data.

### Additional mobile IA / UX notes (from UI audit)

- **Global Search is web-only** (`TopBar`); iOS header has notifications/profile but no search.
- **`useNativeIos()` hydrates false→true** after mount — first paint can flash web chrome before iOS shell.
- Dual trees (`*Content` vs `Ios*Screen`) mean redesign cost is roughly 2× unless primitives stay shared.
- Unused / orphaned dashboard cards still in tree (`MobileSafeToSpendCard`, `QuickActions`, `DashboardAtAGlance`, etc.) — cleanup candidate, not Stage 2 blockers.
- No `/budgets` route; budgeting today = Income Plans + envelopes + Safe To Spend.
---

## 4. Current automation inventory

### Automatic today (Pro + connected banks)

1. Plaid balance + transaction sync (API + webhook)
2. Plaid personal finance category → Buxme category mapping (`lib/plaid/mappers.ts`)
3. Recurring bill **candidates** + confirmation prompt
4. Payroll/paycheck **candidates** (Plaid + amount match to Income Plan)
5. Bill payment reconciliation cron/API (`/api/finance/reconcile-bills`, sync path)
6. Income Plan auto-run when paycheck due (`FinanceContext` + `/api/cron/run-paychecks` daily 06:00 UTC)
7. Automation suggestion tray (dismissible, localStorage dismissals)
8. Transfer heuristics for spending/income hygiene
9. Dashboard KPIs / safe-to-spend / health score recalculated client-side from loaded data

### Manual / confirmation-required today

- Confirm recurring bills, apply paycheck plan, create/edit goals/bills/debts
- Categorization corrections (persist on transaction; limited learning loop)
- Household invites, billing upgrades, account preferences

### Entitlement reality (preserve this)

| Tier | Price (marketing) | What code actually gates |
| --- | --- | --- |
| **Free** | $0 | Manual tracking; **cannot create new Plaid links** |
| **Pro** | $7.99/mo | Plaid new connections; household marketed as Pro |
| **Pro+** | $14.99/mo | Same Pro access today; **`PRO_PLUS_ROUTE_PREFIXES` is empty** — no hard Pro+ route gate |
| **Founder** | allowlist / `admin_founder_granted` | Treated as full Pro+ |

Stripe products: web. Apple products: `com.buxme.pro.monthly`, `com.buxme.proplus.monthly`.

**Implication for Buxme 2.0 tier matrix:** Do **not** relocate existing Pro capabilities behind Pro+ without grandfathering. Pro+ differentiation is currently mostly **marketing** (“advanced reports & premium insights”); implementing Stage 12 Money Plan as Pro+-only is consistent *if* Pro keeps Plaid + core automation.

---

## 5. Performance findings

### Confirmed high-impact issues

1. **Unbounded transaction load**  
   `FinanceService.loadFinanceData` uses `select("*")` on `transactions` with **no limit**. Users with thousands of rows pay full download + map + context recompute on every refresh/mutation.

2. **Full reload after mutations**  
   ~21 `loadFinanceData` return paths after writes. Correct for consistency; expensive for perceived speed.

3. **Monolithic `FinanceContext`**  
   Single provider value drives most authenticated UI. Any finance state change can rerender large trees. Classic source of controlled-input focus bugs when forms sit under heavy context consumers.

4. **Auth / beta / entitlements gating chain**  
   Cold path: Auth loading → profile beta check → onboarding → finance load → dashboard. Easy to show blank/skeleton longer than necessary; iOS Home does show skeletons while loading.

5. **No durable offline / stale-while-revalidate cache of finance snapshot**  
   Preferences/dismissals use `localStorage`; finance data does not. Pull-to-refresh always hits network.

6. **Plaid sync can be heavy**  
   Cursor sync loops (500/page), historical backfill lookback up to **730 days** (`INITIAL_SYNC_LOOKBACK_DAYS`). Can block “useful UI” if awaited on connect path.

7. **219 `"use client"` modules**  
   Expected for this architecture; means JS payload and client hydration cost matter on iOS WebView.

8. **Sequential second-wave loads in `loadFinanceData`**  
   Core tables parallelized; then income plan + allocations sequential; then bank connections. Opportunity to parallelize more without schema change.

9. **Plaid sync N+1 persistence**  
   Sync upserts accounts/transactions with per-row select+write patterns; first sync + 730-day backfill can generate thousands of round-trips. Exchange and webhook runs sync **inline** (timeout risk).

10. **Household realtime stampede**  
    `postgres_changes` on household finance tables triggers full `refreshFinance()` with no debounce — multiplies unbounded loads.

11. **Transaction count helper smell**  
    Some Plaid paths load all `account_id` rows into memory to count instead of SQL `count(*)`.

### Measurement not yet run in this stage

Cold/warm launch timings, bundle size, and render profiling were **not** instrumented here (Stage 3). Findings above are from code structure, not production APM.

---

## 6. Confirmed / likely bugs

### Confirmed (fixed recently — regression risk)

| Issue | Fix | Risk |
| --- | --- | --- |
| Modal focus trap stole focus every keystroke (one-char-at-a-time inputs) | #69 `Modal.tsx` — `onClose` via ref | Any new modal effect deps can reintroduce |
| Regression test added | #70 `test-modal-focus-stability.mjs` | Keep in Stage 2 suite — **script exists but is not in `package.json` / CI** |
| Apple Pro purchase resolving as Pro+ (stale lineage) | Multiple IAP commits | High sensitivity; do not casually rewrite IAP |
| StoreKit restore fallback hardened | recent main | |
| iOS WebView navigation Build 14 | recent main | |

### Confirmed open (code-verified in Stage 1)

| Issue | Evidence | Stage |
| --- | --- | --- |
| **Paycheck automation Apply double-counts income** | Suggestion payload includes `transactionId`, but `MarkPaycheckReceivedInput` has no such field and `completeAutomationSuggestion` calls `markIncomePlanPaycheckReceived()` with **no args**. Apply always creates a synthetic “Income Plan paycheck received” income tx even when a Plaid deposit already exists. | **Stage 2 fix** |
| **Pro+ has no exclusive hard gates** | `PRO_PLUS_ROUTE_PREFIXES = []`; reports/insights fully usable on Free with soft banners only | Document before Stage 12; don’t “fix” by gating existing Free UX without product decision |
| **`useSubscription` fail-open** | Outside `SubscriptionProvider`, hook returns `hasProAccess: true` / `hasProPlusAccess: true` | Stage 2 harden to fail-closed |
| **Household soft-gate tied to Stripe flag** | Invite/create UI + API soft-block only when Stripe client enabled; Apple-only paid users can diverge from intended Pro gate | Stage 2 review |
| **Plaid webhook skip on duplicate item_id** | Webhook path ignores sync when >1 `bank_connections` share an Item | Stage 2 investigate / fix |

### Likely / architectural risks

1. **Context-driven form rerenders** — same class as modal focus bug; hunt all forms using `useFinance()` directly for local draft state isolation
2. **Household oversharing** — RLS shares accounts/bills/goals/transactions/investments with all household members when `household_id` set; **no private account flag**. Personal income scoping exists in places; privacy model incomplete vs 2.0 spec
3. **Pro+ vs Pro feature parity** — users may believe Pro+ unlocks reports/insights that Free/Pro also see
4. **Floating-point money** — `numeric(14,2)` in DB, but JS uses `number` + `Math.round(value * 100) / 100` in places; no decimal library — edge-case drift risk
5. **Smart insights fallbacks** — can show generic “Add income and bills…” style copy; fails “no meaningless motivational messages” bar when data thin
6. **Docs vs nav drift** — `IOS_APP_STORE.md` tab list ≠ `lib/mobile/navigation.ts`
7. **Cron migration one-shots** still in tree (`apply-*-migration` cron routes) — operational clutter / footgun if secrets misused
8. **Dual recurring detectors** (`lib/plaid/recurringBillDetection.ts` + `lib/automation/detectRecurringBills.ts`) can surface overlapping suggestions
9. **Schedule auto-run + cron + manual apply races** on Income Plan `next_pay_date` without requiring a linked deposit
10. **Disconnect inconsistency** — connection disconnect may null IDs while leaving accounts/txs; account disconnect deletes accounts optionally leaving orphan txs
11. **TODO/FIXME grep** returned empty in source — debt is mostly implicit (large contexts, AI Team surface area), not annotated

---

## 7. Security concerns

### Strong

- Supabase **service role** confined to server (`lib/supabase/admin.ts` + `server-only`); not shipped to client
- Profile **privilege guard** trigger blocks client self-elevation of subscription/admin/beta fields
- Apple IAP verify uses crypto + ownership binding (`appAccountToken`) with fail-closed expiry rules
- Stripe webhook privilege path; checkout privilege tests exist
- Plaid access tokens encrypted server-side (`tokenVault`)
- Admin routes gated in `proxy.ts` + `canAccessAdminDashboard`

### Concerns / gaps

1. **Household RLS is coarse** — members can read/manage shared finance rows; no server-enforced private accounts. UI-only hiding (`is_hidden`) is **owner preference**, not household privacy. No viewer-vs-editor household role split.
2. **`bank_connections` ciphertext reaches the browser** — client `listConnections` uses `.select("*")`, so `access_token_encrypted` / `iv` / `tag` are fetched over the authenticated Supabase client before `mapBankConnectionRow` drops them. Household SELECT policy also allows members to read those rows. Tokens are encrypted at rest (good), but ciphertext should not ship to clients — prefer column-restricted selects / a view / server-only reads. **Stage 2 security fix candidate.**
3. **Finance mutations rely on RLS + client-supplied entity IDs** — generally OK with auth.uid(); still audit admin and invite endpoints carefully before expanding automation.
4. **Founder / admin email allowlists** — powerful; compromised mailbox = full admin + service-role APIs.
5. **`is_disabled` enforced in AuthGate UI only** — API auth helpers (`requireStripeApiUser`, etc.) do not consistently re-check disabled profiles.
6. **`useSubscription` fail-open** outside provider (see bugs) can falsely unlock client-only soft gates.
7. **`past_due` still grants Pro access** — intentional grace, but product/security tradeoff should stay explicit.
8. **Powerful cron/migration routes** — most require `CRON_SECRET`; some also accept Vercel cron headers; secret hygiene critical.
9. **Large admin AI Team attack surface** — separate from consumer app but shares DB; keep RLS/grants tight.
10. **Error leakage** — Stage 2 should verify Plaid/Supabase failure UX never shows raw stack/Plaid JSON.
11. **Do not weaken** privilege guard / IAP / Stripe guards when adding automation.
12. Historical ops note: `admin_feedback_reports` RLS must remain enabled in production (`docs/LAUNCH_READINESS.md`).
13. **`schema.sql` is incomplete** vs migrations — do not bootstrap production from it alone.
---

## 8. Technical debt relevant to Buxme 2.0

| Debt | Why it matters for 2.0 |
| --- | --- |
| God-object `FinanceContext` | Blocks fast nav, causes input bugs, hard to add background refresh |
| Full-table finance fetch | Blocks “thousands of transactions” and Speed Test |
| Dual web/iOS presentation | Good start; needs discipline so web doesn’t regress |
| Entitlement marketing ≠ code gates | Must document before re-tiering features; only **hard** paid gate today is **new Plaid links** (+ household when Stripe enabled) |
| Paycheck apply not deposit-linked | Automation spine is suggestion + schedule, not closed-loop |
| Dual recurring detectors | Unify before expanding subscription intelligence |
| Insights are shallow heuristics | 2.0 Insights should build on `financialEngine` / calculations, not replace with LLM invention |
| Allocation + Income Plan already complex | Expand Paycheck Planner 2.0 **on top** of `lib/incomePlan` + `lib/allocation` |
| AI Team / Mission Control codebase weight | Noise for consumer work; keep out of consumer PRs; `CommandCenterV4` appears unreferenced |
| Schema.sql vs migrations | `schema.sql` is partial baseline; **migrations** are source of truth |
| Test scripts are Node assert suites, not e2e browser | ~34 scripts; CI runs only ~7; several high-value tests (modal focus, Apple IAP, Plaid entitlements) not in CI |
| Orphan test scripts | e.g. `test-modal-focus-stability.mjs` not wired in `package.json` |
| No crash reporting (Sentry etc.) | Observability gap for production iOS WebView failures; PostHog optional and silent when unset |

---

## 9. Buxme 2.0 capabilities that **already partially exist**

| 2.0 ask | Existing foundation | Gap to close later |
| --- | --- | --- |
| Native mobile shell | Capacitor + iOS screens + bottom nav | Deeper sheets, swipe, IA finalize, feel less “web” |
| Home financial understanding | `IosHomeScreen`, safe-to-spend, KPIs, bills, activity | Adaptive insights hierarchy; less card clutter on web |
| Auto transactions / categorize | Plaid sync + PFC mapping | Merchant normalize, learning from corrections |
| Recurring bills/subs | Detection + prompt + dismissals | Subscription view, price-change detection, annual cost |
| Paycheck detection | Automation + Plaid payroll candidates | Confirmation UX polish; uncertain income handling |
| Paycheck Planner 2.0 | Income Plan + allocations + envelopes + ledger | Auto-prepare on detection; richer schedules UX |
| Safe-to-spend | Canonical money-flow waterfall | Transparency UI (“why this number”) |
| Cash-flow forecast | `forecastEngine` + calendar | User-facing timeline; low-balance warnings |
| Smart budgets | — | **Net-new** (suggest from 60–90d history) |
| Financial feed | Events/notifications + recent activity cards | Unified chronological feed |
| Buxme Insights | `buildSmartInsights` + health reasons | Deterministic insight library expansion |
| Pro+ Money Plan | Money flow stages | Continuous recalc + change explanations |
| Goals 2.0 | Goals + analytics + contributions | Cash-flow-aware suggestions |
| Debt optimizer | Avalanche/snowball simulation | Tradeoff copy polish; link to plan |
| Net worth | Calculations + timeline | Range selectors / sparse-data honesty |
| Financial health | Scored metrics with reasons | Prefer transparent metrics in UI |
| Household | Invites, shared RLS, bill splits | **Private vs shared** enforcement |
| Global search | Client substring search | Query language / amounts / date ranges; **add to iOS shell** |
| Notifications | In-app + coarse prefs | Push + granular types; anti-spam |
| Entitlements Free/Pro/Pro+/Founder | Solid billing plumbing | Align feature matrix carefully |

---

## 10. Recommended implementation plan (based on this repo)

Follow the user’s staged order, mapped to **real modules**:

| Stage | Focus | Primary touchpoints | Avoid |
| --- | --- | --- | --- |
| **1** | Audit (this doc) | — | Code changes |
| **2** | Bug/regression baseline | Modal forms, IAP restore, Plaid disconnect, entitlements, iOS nav smoke | New features |
| **3** | Performance | Paginate/limit transactions; parallelize load; split context; stale-while-revalidate | Schema rewrite |
| **4** | Native shell | `components/native/ios`, `MobileBottomNav`, sheets, swipe | Replacing Capacitor remote URL |
| **5** | Home redesign | `IosHomeScreen` + web `DashboardContent` | Deleting money-flow engines |
| **6** | Transaction intelligence | `lib/plaid/mappers`, transfer detection, category corrections | Replacing syncService wholesale |
| **7** | Recurring + paycheck | existing detection services + confirmation UX | Silent auto-create bills |
| **8** | Paycheck Planner 2.0 + STS transparency | `lib/incomePlan`, `lib/allocation`, `safeToSpend` | New parallel allocation system |
| **9** | Forecast + smart budgets | `forecastEngine` + **new** budget suggestion module | Auto-enforcing budgets |
| **10** | Feed + Insights | `lib/events`, `financialEngine` | LLM-invented numbers |
| **11** | Goals/debt/net worth polish | existing libs | |
| **12** | Pro+ Money Plan | gate new continuous plan; preserve Pro Plaid | Moving Plaid to Pro+ |
| **13** | Household/search/notifications | RLS privacy model first | UI-only privacy |
| **14–15** | Regression / security / launch | existing script suite + smoke doc | |

**PR discipline:** one stage (or thin vertical slice) per PR; never combine shell + IAP + schema.

---

## 11. Risks to address **before** implementation

1. **Entitlement promise audit with production customers** — document what App Store / Stripe subscribers were sold; code today does not hard-gate Pro+ features.
2. **Transaction volume in production** — measure max transactions/user before changing Home/automation; pagination strategy depends on it.
3. **Household privacy product decision** — shared-all vs private/shared accounts must be decided before Stage 13; may need careful migration.
4. **IAP/Stripe dual-billing invariants** — treat `lib/iap/*` and privilege guards as load-bearing; Stage 2 must include restore + Pro/Pro+ mapping tests.
5. **Do not conflate Admin AI Team with consumer Insights.**
6. **Web regression risk** — every native presentation change must be verified on desktop/web mobile IA.
7. **App Store Build readiness** is a parallel track (`docs/APP_STORE_BUILD_13_REVIEW.md`); don’t block Stage 2 bugfix on Mac signing, but don’t break IAP paths.

---

## 12. Exact proposal for Stage 2

### Goal

Establish a **regression baseline** and fix **confirmed** product bugs only. No redesign, no new automation engines, no schema migrations unless required to fix a confirmed production bug.

### Stage 2 workstreams

1. **Wire missing regression harness pieces**  
   - Add `test:modal-focus-stability` (and other orphan high-value scripts) to `package.json`  
   - Run CI-relevant suite locally and record results  
   - Prefer importing app modules over duplicated logic in orphan scripts

2. **Automated baseline (run & record)**  
   - Modal focus stability  
   - `test:finance-calculations`, `test:recurring-bill-detection`, `test:plaid-credit-mapping`  
   - `test:plaid-entitlements`, `test:plaid-account-removal`  
   - `test:apple-iap`, `test:apple-iap-crypto`  
   - `test:ios-native-nav`, `test:ios-settings-nav`, `test:ios-nav-insights`  
   - `test:account-deletion`, `test:profile-privilege-guard`, `test:stripe-checkout-privilege`  
   - `npm run lint` + `npm run build`

3. **Fix confirmed open bugs (priority order)**  
   - **P0:** Link Income Plan Apply to detected Plaid deposit (`transactionId`) — prevent double income  
   - **P0:** Make `useSubscription` fail-closed outside provider  
   - **P0/P1:** Stop shipping `bank_connections` ciphertext columns to the client (`select` allowlist / view)  
   - **P1:** Align household Pro gate with entitlements even when Stripe client flag is off  
   - **P1:** Plaid webhook behavior when duplicate `item_id` rows exist  
   - Controlled-input / focus hunt across finance forms (bills, transactions, income plan, debt, goals)
4. **Lifecycle smoke (manual checklist)** against `docs/SMOKE_TEST.md`  
   - Auth → onboarding → Plaid (if credentials) → CRUD → billing surfaces → logout/login  
   - Free vs Pro entitlement UI for Plaid CTA  
   - Paycheck detect → Apply path (verify no duplicate income)  
   - iOS shell nav: primary tabs + More destinations  
   - Record failures as Stage 2 tickets; fix only confirmed bugs

5. **Edge-case static review (code + targeted tests)**  
   - Pending→posted duplicates, transfers, refunds, credit mapping  
   - Empty / no-account Home empty states  
   - Plaid reauth UI (`plaidConnectionUi`)  
   - Expired Apple entitlement fail-closed  
   - `is_disabled` API auth consistency (document or harden)

6. **Deliverables**  
   - Stage 2 report: bugs found / fixed / deferred  
   - Updated smoke checklist results  
   - Explicit go/no-go for Stage 3 performance work  
   - **Stop** for manual verification before Stage 3 if any critical path fails

### Out of scope for Stage 2

- Bottom nav IA redesign  
- Home visual redesign  
- New tables / smart budgets / Money Plan  
- Refactors of `FinanceContext` beyond bugfix necessity  
- Entitlement matrix product changes (except fail-closed / gate consistency fixes above)  
- Non-blocking webhook worker / sync batching (Stage 3 unless it blocks a bug fix)

---

## Appendix A — Database inventory (migrations = source of truth)

### Consumer finance tables

`profiles`, `accounts`, `bills`, `bill_splits`, `goals`, `transactions`, `investments`, `recurring_items`, `notifications`, `bank_connections`, `plaid_recurring_dismissals`, `households`, `household_members`, `household_invites`, `income_plans`, `income_plan_allocations`, `income_plan_paycheck_events`, `income_plan_allocation_events`, `envelope_balances`, `allocation_ledger`

### Product ops / admin

`admin_feedback_reports`, `admin_event_logs`, `beta_settings`, `beta_waitlist`, `app_releases`, `app_release_changes`, `user_release_views`, plus AI Team / mission tables (`ai_team_*`)

### Notable columns

- Accounts: Plaid fields, nickname/icon, `include_in_net_worth`, `include_in_safe_to_spend`, `is_hidden`, `archived_at`
- Profiles: Stripe + Apple subscription fields, `admin_founder_granted`, notification preferences, beta flags
- Money stored as `numeric(14,2)`

### Cron

- Scheduled: `/api/cron/run-paychecks` daily (`vercel.json`)
- One-shot/ops crons also present under `app/api/cron/*`

---

## Appendix B — Analytics events (current)

Defined in `lib/analytics/events.ts`: login, onboarding, Plaid connect/fail, dashboard open, CRUD-ish events, Stripe subscription lifecycle, household invite, feedback, beta waitlist.  

**Gaps vs 2.0:** app launch, restore purchases, paycheck detected/approved, transaction edited, budget created (event name exists unused), IAP-specific funnel, client error reporting.

---

## Appendix C — Files changed in Stage 1

- `docs/BUXME_2_STAGE1_AUDIT.md` (this document only)

## Schema / migrations

- None

## Security / performance implications of Stage 1

- None (documentation only)

## Tests performed in Stage 1

- Static repository audit (routes, libs, migrations, recent git history, entitlement/IAP/Plaid/finance paths)
- Cross-checked deep-dive findings from parallel audits of auth/billing, Plaid/finance pipelines, and bugs/debt/security
- Code-verified paycheck Apply double-count path and subscription fail-open behavior
- No production data access; no interactive App Store / Plaid live exercise in this stage

## Remaining risks entering Stage 2

- Live environment / credentials may be required for full lifecycle smoke
- Production transaction volume unknown until measured
- Confirmed paycheck double-count and subscription fail-open should be fixed before expanding automation
- Device QA still required; static audit does not replace `docs/SMOKE_TEST.md`
