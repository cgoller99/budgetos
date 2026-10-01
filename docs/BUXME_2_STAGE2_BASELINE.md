# Buxme 2.0 — Stage 2 Bug & Regression Baseline

**Status:** Complete — stopped for review. Stage 3 not started.  
**Branch:** `cursor/buxme-2-stage2-baseline-c6fc`  
**Scope:** Tests, audits, low-risk confirmed bug fixes only. No redesign, no entitlement product changes, no RLS schema changes, no Stage 3 optimization.

---

## 1. Tests executed and results

| Test | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Pass (0 errors, 24 warnings) | Pre-existing unused-var warnings |
| `npm run build` | Pass | |
| `test:modal-focus-stability` | Pass | Wired into package.json |
| `test:finance-calculations` | Pass | |
| `test:income-annualization` | Pass | |
| `test:onboarding-progress` | Pass | |
| `test:plaid-credit-mapping` | Pass | |
| `test:recurring-bill-detection` | Pass | |
| `test:profile-privilege-guard` | Pass | Static migration checks |
| `test:beta-registration` | Pass | |
| `test:plaid-entitlements` | Pass | Confirms **Pro** (not Pro+) for new Plaid |
| `test:plaid-account-removal` | Pass | Harness fixed to use `npx esbuild` |
| `test:apple-iap` | Pass | |
| `test:apple-iap-crypto` | Pass | |
| `test:ios-native-nav` | Pass | |
| `test:ios-settings-nav` | Pass | |
| `test:ios-nav-insights` | Pass | |
| `test:ios-secondary-screens` | Pass | Wired |
| `test:ios-polish-data-intel` | Pass | |
| `test:account-deletion` | Pass | |
| `test:stripe-checkout-privilege` | Pass | |
| `test:stripe-plan-change-interval` | Pass | |
| `test:capacitor-deep-links` | Pass | |
| `test:payroll-income` | Pass | Wired (orphan) |
| `test:bill-reconciliation` | Pass | Wired (orphan) |
| `test:plaid-connection-ui` | Pass | Wired |
| `test:public-support-page` | Pass | |
| `test:app-store-review` | Pass | Harness fixed (esbuild, was `.ts` import fail) |
| **NEW** `test:paycheck-source-link` | Pass | Double-count regression |
| **NEW** `test:subscription-fail-closed` | Pass | |
| **NEW** `test:controlled-input-patterns` | Pass | |
| **NEW** `test:bank-connection-client-select` | Pass | |

**Not run live:** device smoke (`docs/SMOKE_TEST.md`), real Plaid Link, StoreKit purchase, production RLS against live DB (no credentials in this environment for interactive finance load timing).

---

## 2. Confirmed bugs found

| ID | Bug | Severity |
| --- | --- | --- |
| B1 | Automation “Apply paycheck” ignored `transactionId` and always created synthetic income + re-credited balance (double-count) | **High** (fixed) |
| B2 | `useSubscription()` outside provider returned `hasProAccess/hasProPlusAccess: true` (fail-open) | **High** (fixed) |
| B3 | Client `bank_connections.listConnections` used `.select("*")`, shipping encrypted token columns to the browser | **Medium** (app-layer fixed; RLS residual remains — see §6) |
| B4 | Household members can SELECT `bank_connections` including ciphertext columns via RLS (malicious client can still query `*`) | **High privacy** — **reported, not changed** |
| B5 | Joining a household backfills **all** accounts/bills/goals/transactions/investments with `household_id` → full share | Product design / privacy gap — **reported** |
| B6 | Pro+ marketed exclusive features (advanced reports, premium insights, early access) are **not hard-gated** | Product discrepancy — **documented, not changed** |
| B7 | Household Pro soft-gate only when `isStripeClientEnabled()` | Medium consistency — **deferred** |
| B8 | Test harness failures (`esbuild` path, `.ts` import) blocked CI-adjacent scripts | Low (fixed) |
| B9 | Modal one-char input class — shared Modal already fixed (#69); forms use local draft state | Pattern audit clean; residual risk if new modals skip Modal |

---

## 3. Bugs fixed (low-risk)

1. **Paycheck source link** — `MarkPaycheckReceivedInput.sourceTransactionId`; `executePaycheckAllocations` reuses existing income tx and skips balance re-credit; automation Apply passes payload id.
2. **Subscription fail-closed** — outside provider: Free, no Pro/Pro+.
3. **Bank connection client select allowlist** — `listConnections` omits `access_token_*`.
4. **Test harness** — wire orphans; fix plaid-account-removal + app-store-review runners; add Stage 2 regression scripts.

---

## 4. Bugs intentionally deferred

| Item | Why deferred |
| --- | --- |
| Household RLS / private vs shared accounts | Schema + production data; requires product decision |
| Remove household SELECT of bank_connections token columns | Needs migration / view / column privileges — stop-and-report |
| Hard-gate Pro+ reports/insights | Would shrink Free/Pro UX vs current users; entitlement product decision |
| Align household gate when Stripe client disabled | Touches paid UX; document first |
| Plaid webhook skip on duplicate `item_id` | Needs careful production investigation |
| Unbounded `transactions` select / FinanceContext split | Stage 3 |
| Money type / decimal library migration | Documented only (§7) |
| `is_disabled` on all API auth helpers | Security harden later; report only |
| Dual recurring detectors | Feature polish later |
| iOS Global Search missing | Stage 4 shell |
| Dead dashboard cards / CommandCenterV4 | Cleanup, not Stage 2 |

---

## 5. Exact entitlement matrix (CURRENT CODE — no behavior change to tiers)

### Correction to Stage 1 wording

**New Plaid connections require Pro (`hasProAccess`), NOT Pro+.**  
Pro+ also has Pro access via plan rank. Founder grants both. Free cannot create new Items; reconnect/sync of existing Items is grandfathered.

Evidence: `lib/plaid/plaidEntitlementGate.ts`, `lib/plaid/requirePlaidProAccess.ts` (`upgradePlan: "pro"`), `test:plaid-entitlements`.

### Matrix

Legend: **A** = Available · **H** = Hard-gated server · **U** = UI-gated only · **M** = Marketing-only / claimed · **R** = Restricted (partial)

| Feature | Free | Pro | Pro+ | Founder | Enforcement |
| --- | --- | --- | --- | --- | --- |
| Dashboard / manual accounts / txs / bills / income / goals / debt | A | A | A | A | Ungated |
| Safe-to-spend / money flow / net worth (manual data) | A | A | A | A | Ungated |
| Reports page + charts + CSV | A | A | A | A | Soft `ProUpgradeBanner` only (U/M for Pro+) |
| Smart insights / health score | A | A | A | A | Ungated (M claims Pro+-only) |
| Income Plan / allocations / forecast UI | A | A | A | A | Ungated (M implies Pro automation) |
| Automation suggestions | A | A | A | A | Ungated |
| Calendar / search / notifications / what’s new | A | A | A | A | Ungated |
| **New Plaid Link / exchange** | H block | A | A | A | **Server hard gate** `hasProAccess` |
| Existing Plaid reconnect / sync / disconnect | A | A | A | A | Explicit grandfather |
| Household create/invite | R* | A | A | A | *UI+API only if Stripe client enabled; else ungated |
| Priority support / early access | — | M | M | A | Marketing only |
| Advanced reports / premium insights (as exclusive) | A in practice | A | A | A | **Marketing discrepancy** |
| Stripe Checkout Pro/Pro+ | Web | Web | Web | — | Web billing |
| Apple IAP Pro/Pro+ | iOS | iOS | iOS | — | StoreKit |
| Admin / AI Team | — | — | — | Email allowlist | Separate |

### Marketing vs code

| Claim (`PLAN_DEFINITIONS` / `PricingSection`) | Reality |
| --- | --- |
| Pro: Plaid + automation + household | Plaid hard-gated ✓; automation/Income Plan available on Free; household soft-gated with Stripe flag |
| Pro+: advanced reports, premium insights, early access | **Not hard-gated** — Free can use Reports/insights |
| Landing: “Upgrade to Pro for Plaid… Pro+ for advanced insights” | Plaid part true; insights exclusivity **false in code** |

### Intended 2.0 direction (NOT implemented)

- Pro = connected banking + meaningful automation  
- Pro+ = Pro + advanced intelligence/planning/reports  

**Do not remap until customer promise audit.** Existing Pro customers already have Plaid; Free users already see Reports.

---

## 6. Household privacy / RLS findings

### What another household member can READ (when rows have matching `household_id`)

| Record | Readable by household? | Notes |
| --- | --- | --- |
| Accounts (incl. balances, debts as `record_kind`) | Yes | Policy + backfill |
| Transactions | Yes | Full history shared |
| Bills / bill_splits | Yes | |
| Goals | Yes | |
| Investments | Yes | |
| Income sources | Derived from accounts/transactions/plan | Personal income **display** filters exist in `personalIncomeScope.ts` (client calculation), but underlying rows may still be loaded |
| Income plans / envelopes / ledger | Yes (owner-or-household policies) | |
| Notifications | Owner-scoped typically | Not household-shared the same way |
| Profiles (limited) | Household member profile read policy exists | |
| **bank_connections** | **Yes SELECT** | Includes ability to request `access_token_encrypted` / iv / tag |

### Writes

Members can manage household-tagged finance rows (accounts/bills/goals/transactions/investments) — no viewer vs editor role.

### Intended vs accidental

- **Intended (current product):** joining a household is a shared finance graph. `backfillHouseholdFinanceRows` stamps the joiner’s existing finance with `household_id`.
- **Accidental / over-broad vs 2.0 privacy vision:** no private accounts; bank connection ciphertext readable under RLS; client loads full household finance into one context.

### STOP-AND-REPORT

**Serious residual issue:** Even after Stage 2 app-layer select hardening, a household member authenticated to Supabase can still `.from('bank_connections').select('*')` and receive encrypted token material if they craft a request. Ciphertext ≠ plaintext, but it is still a credential-adjacent secret that should not be client-readable. **Do not ship an RLS change in Stage 2 without a reviewed migration** (recommended later: revoke token columns from `authenticated` via view or column privileges; keep decrypt server-only).

**No schema/RLS changes made in Stage 2.**

---

## 7. Money precision findings

### Scope (no migration)

- DB: `numeric(14,2)` for money columns — good.
- App: JavaScript `number` throughout calculations; common pattern `Math.round(value * 100) / 100`.
- No `decimal.js` / Dinero / currency library.

### Risk by area

| Area | Risk | Notes |
| --- | --- | --- |
| Stored balances / txs | Low–Med | Written as numbers; Postgres numeric stores rounded values |
| Safe-to-spend / money flow | Med | Waterfall of floats; display rounded |
| Income Plan allocations | Med | Percent/remaining resolution in JS |
| Forecast | Med | Iterative pay dates + amounts |
| Debt interest / payoff | **Higher** | Monthly interest loops use float (`interestRate/100/12`); payoff dates can drift |
| Goals / net worth / reports | Med | Aggregations of floats |
| Plaid mappers | Low | `Math.abs` on amounts; DB numeric on write |

### Isolated safe fixes in Stage 2

None beyond existing round helpers — no production data risk taken. Recommend Stage 3+ introduce a shared `roundMoney` / integer-cents helper for **new** calc paths first; full migration later.

---

## 8. Controlled-input / focus findings

| Surface | Draft state | Shared Modal | Remount risk | Verdict |
| --- | --- | --- | --- | --- |
| Bills add/edit | Local `useState` | Yes | Low | OK after #69 |
| Transactions add/edit | Local | Yes | Low | OK |
| Income add/edit | Local | Yes | Low | OK |
| Debt add/edit/pay | Local | Yes | Low | OK |
| Goals create/edit/add money | Local | Yes | Low | OK |
| Accounts add/edit | Local | Yes | Low | OK |
| Income Plan | Local drafts in content | N/A (page form) | Low (stable allocation keys) | OK |
| Search | Local query | N/A | Low | OK |
| Settings / household / billing | Mixed local | Various | Watch BillingSection size | No confirmed one-char bug |
| BillFormFields | Calls `useFinance()` for accounts | Parent owns form | Re-render OK; Modal trap fixed | OK |

Automated: `test:modal-focus-stability`, `test:controlled-input-patterns` pass.  
**Device typing QA still recommended** on iOS WebView for Bills + Income Plan.

---

## 9. Performance baseline (measure only)

Environment lacked interactive authenticated session timings. **Static baseline for Stage 3 comparison:**

| Metric | Baseline observation |
| --- | --- |
| Initial finance load request shape | 1× household resolve → parallel `select('*')` on accounts, bills, bill_splits, goals, **transactions (unbounded)**, investments, notifications → then income plan + allocations → bank connections + dismissals |
| `loadFinanceData` call sites in `FinanceService` | **37** |
| `refreshFinance` references in `FinanceContext` | **14** |
| Transaction window | **None** (full history) |
| Payload size | Dominated by transactions JSON; scales ~O(n txs) — measure on prod sample in Stage 3 |
| Dashboard | Waits on `FinanceContext.isLoading`; iOS skeleton then `IosHomeScreen` |
| Navigation | Client route change; data already in context (fast after first load) |
| Plaid refresh | Blocks UI `isSyncing`; full `refreshFinance` after sync; webhook sync inline |
| Household realtime | Any change → full `refreshFinance` (no debounce) |
| Lint/build cold | lint ~17s; build ~22–26s in this VM |

**Stage 3 should record:** HAR/network on real account with known txn count; time-to-dashboard; time-to-interactive after tab switch.

---

## 10. Existing engine validation results

| Engine | Trust | Evidence | Notes |
| --- | --- | --- | --- |
| Safe-to-spend / money flow | **Medium-High** | Used widely; finance calc tests cover related nets | Formula transparent; float waterfall |
| Net worth | **High** | Dedup tests in `test-finance-calculations` | External-id dedup present |
| Health score | **Medium** | Deterministic scoring | Heuristic weights; not “magic” opaque |
| Recurring detection | **High** | 12 scenarios pass | Confirm-only create |
| Paycheck detection | **Medium** | Amount ±5% / 14d window | Needs linked apply (now fixed) |
| Income Plan apply | **Medium → improved** | Source-link test added | Cron/manual still synthetic income |
| Allocation / envelopes | **Medium** | Unit paths via apply | Complex; treat carefully |
| Forecast | **Medium** | Deterministic schedule walk | Depends on plan quality |
| Debt avalanche/snowball | **Medium-High** | Explicit strategies; interest float risk | Don’t label “best” |
| Transfer detection | **Medium** | Conservative pairing + patterns | Heuristic by design |
| Plaid credit mapping | **High** | Dedicated test pass | |

**Build new UX around these engines; do not rewrite.** Highest caution: Income Plan + allocation + debt interest loops.

---

## 11. Mobile / web boundary map

| Layer | Classification |
| --- | --- |
| Capacitor remote shell → `buxme.co` | Shared backend/UI origin |
| `AppProviders`, `FinanceContext`, `AuthContext`, finance libs, API routes | **Shared** |
| `MobileBottomNav` + `lib/mobile/navigation.ts` | **Conditional** (web vs iOS IA) |
| `TopBar` + `GlobalSearch` | **Web-primary**; iOS uses `IosPageHeader` (no search) |
| `DashboardContent` → `IosHomeScreen` | **Conditional** |
| `*Content.tsx` pages | Often **Conditional** via `useNativeIos()` |
| `components/native/ios/Ios*Screen.tsx` | **iOS-only presentation** |
| `PullToRefresh`, haptics, CapacitorBootstrap | **Native-only** behavior |
| Stripe Billing UI | **Web** purchase path |
| StoreKit / native purchases | **iOS-only** |
| Sidebar (`lg+`) | **Web desktop** |

~25 components import `useNativeIos`. Stage 4 must keep web IA (`MOBILE_PRIMARY_NAV`) stable when changing `IOS_PRIMARY_NAV`.

---

## 12. Files changed

- `context/SubscriptionContext.tsx`
- `context/FinanceContext.tsx`
- `lib/incomePlan/types.ts`
- `lib/allocation/paycheckEngine.ts`
- `lib/supabase/repositories/bankConnectionsRepository.ts`
- `package.json`
- `scripts/test-plaid-account-removal.mjs`
- `scripts/test-app-store-review.mjs`
- `scripts/test-paycheck-source-link.mjs` **(new)**
- `scripts/test-subscription-fail-closed.mjs` **(new)**
- `scripts/test-controlled-input-patterns.mjs` **(new)**
- `scripts/test-bank-connection-client-select.mjs` **(new)**
- `docs/BUXME_2_STAGE2_BASELINE.md` **(this file)**

---

## 13. Database changes

**None.** No migrations. No RLS policy edits.

---

## 14. Remaining risks

1. Household bank_connections SELECT still allows token ciphertext via crafted client query  
2. Full household data sharing vs user privacy expectations  
3. Pro+ marketing mismatch if future hard-gates shrink Free/Pro  
4. Finance megacontext + unbounded txs still dominate performance  
5. Float debt-interest accumulation edge cases  
6. Paycheck cron/manual path still creates synthetic income (by design for non-Plaid) — ensure UX doesn’t apply twice via schedule + automation  
7. No live device smoke in this Stage 2 environment  

---

## 15. Recommendation: is Stage 3 safe to begin?

**Conditionally yes — after human review of this report**, especially the household bank_connections STOP item.

Stage 3 (performance) can begin **without** waiting on household RLS redesign, as long as:

1. Product acknowledges Pro vs Pro+ matrix (no silent entitlement changes in Stage 3)  
2. Stage 3 limits itself to load/pagination/caching/context split — no RLS/schema  
3. A follow-up security ticket is filed for bank_connections column privileges before Stage 13 household privacy work  

**Do not start Stage 3 automatically from this agent.** Await explicit approval.
