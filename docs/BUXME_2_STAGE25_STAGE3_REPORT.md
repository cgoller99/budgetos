# Stage 2.5 + Stage 3 Report

## 1. Stage 2.5 security fix

Dropped household `SELECT` on `bank_connections`. Plaid credentials / encrypted tokens are owner-only. Shared finance continues via `accounts` / `transactions` household RLS.

## 2. Exact RLS change

**Before**

- `Bank connections manageable by owner` — `FOR ALL` where `auth.uid() = user_id`
- `Bank connections readable by household` — `FOR SELECT` where owner **OR** household member

**After** (`supabase/migrations/20261001_bank_connections_owner_only.sql`)

- Drop `Bank connections readable by household`
- Keep/recreate owner `FOR ALL` with `using` + `with check` on `auth.uid() = user_id`

Apply remotely: `npm run apply:bank-connections-owner-rls` (needs DB credentials).

## 3. Security regression-test result

`npm run test:bank-connections-owner-rls` — expected pass (static policy + dependency audit).

## 4–7. Performance baseline / after (synthetic)

Instrumentation: `npm run test:stage3-performance`.

| Dataset | Full payload | Bootstrap window (≤2500) |
| --- | ---: | ---: |
| 0 | 2 B | 2 B |
| 100 | ~49 KB | ~49 KB |
| 1,000 | ~501 KB | ~501 KB |
| 5,000 | ~2.5 MB | ~1.26 MB |
| 10,000 | ~5.0 MB | ~1.26 MB (**~25%**) |

Cold load: windowed txs (120d / max 2500) + explicit column lists.  
Warm load: sessionStorage SWR hydrate then background refresh.

## 8. loadFinanceData call sites

| Area | Before (Stage 2 audit) | After |
| --- | ---: | ---: |
| `financeService` end-of-mutation reloads | ~21 `return this.loadFinanceData` | ~6 remaining (complex ops: replace, deleteAccount, pause, payments, paycheck, savePlan) |
| Simple CRUD | always reloaded full graph | returns `null` → context retains optimistic state |
| Transaction CRUD balances | reloaded after `persistAccountBalances` | returns optimistic `data` |

Context still has intentional `refreshFinance` / `loadFinanceData` for init, Plaid sync, and broad invalidation.

## 9. Transaction loading strategy

- Bootstrap: last **120 days**, cap **2500** rows, explicit columns
- Transactions UI: **Load older transactions** via `loadOlderTransactions` (page size **100**)
- Reports / engines: still use in-memory window; full history not required for dashboard bootstrap
- Meta: `transactionsMeta.truncated` drives pagination CTA

## 10. Cache strategy

- `sessionStorage` key `buxme-finance-cache-v1:{userId}`, TTL 30 minutes
- Open → hydrate cache immediately (mark freshness) → refresh network → update
- Never treats cache as authoritative forever; `financeDataUpdatedAt` / freshness label exposed
- Cleared on logout

## 11. FinanceContext changes

- SWR hydrate on init
- Debounced household realtime (900ms); **removed `bank_connections` channel**
- `runMutation` accepts `null` reload skip / `retainOptimistic`
- `loadOlderTransactions` + loading flag
- Incremental; no megacontext rewrite

## 12. Plaid improvements

- `awaitHistoricalBackfill` on `syncPlaidConnection` / `syncPlaidForUser`
- **Exchange** uses `awaitHistoricalBackfill: false` so Link completes after incremental sync
- Deferred accounts still selected by `selectAccountsNeedingBackfill` on later sync/webhook
- User **Sync now** / webhooks still perform full backfill (default `true`)

## 13. Realtime improvements

- Debounce coalesces bursty household changes
- No subscription to `bank_connections` (security + fewer useless reloads)

## 14. React rendering improvements

- Avoid full state rebuild after simple mutations (optimistic retain)
- Cache hydrate reduces empty-shell flash
- No blanket memoization pass; value memo extended for new fields only

## 15. Files changed (primary)

- `supabase/migrations/20261001_bank_connections_owner_only.sql`
- `scripts/test-bank-connections-owner-rls.mjs`, `scripts/apply-bank-connections-owner-rls.mjs`
- `scripts/test-stage3-performance.mjs`
- `lib/finance/{transactionWindow,queryColumns,financeCache,emptyFinanceData,types}.ts`
- `lib/supabase/services/financeService.ts`
- `context/FinanceContext.tsx`
- `components/transactions/TransactionsContent.tsx`
- `lib/plaid/syncService.ts`
- `app/api/plaid/{exchange,sync}/route.ts`
- `docs/BUXME_2_STAGE25_SECURITY.md`, this report
- `package.json`

## 16. Migrations

- `20261001_bank_connections_owner_only.sql` (Stage 2.5) — **must be applied to production before claiming live fix**

## 17. Tests executed / results

- `test:bank-connections-owner-rls` ✅
- `test:bank-connection-client-select` ✅
- `test:stage3-performance` ✅ (10k windowed payload ~25% of full)
- `test:paycheck-source-link` ✅
- `test:subscription-fail-closed` ✅
- `test:controlled-input-patterns` ✅
- `test:allocation-summary-precision` ✅
- `test:plaid-connection-ui` ✅
- `tsc --noEmit` ✅

`loadFinanceData(` mentions in financeService: **22** (includes method definition + remaining complex-path loads; end-of-mutation reloads cut from ~21 to ~6).

## 18. Remaining performance bottlenecks

- Several mutations still call `loadFinanceData` once up-front (e.g. `updateBill`, `updateIncome`, `updateDebt`, `updateAccount`)
- Complex money moves (paycheck, bill pay, goal contribution) still full-reload
- FinanceContext remains large (~2k lines); further domain split deferred
- Reports may still want dedicated date-range queries (not yet separate API)
- iOS Capacitor shell still remote-URL; native Stage 4 not started
- 10k+ histories: bootstrap capped, but older pages are sequential

## 19. Known regressions / risks

- Optimistic retain on CRUD can briefly diverge if another household member mutates concurrently (realtime debounce refresh corrects)
- Deferred historical backfill after Link: new accounts may show few txs until Sync/webhook
- Migration not auto-applied without credentials in this environment
- Windowed transactions may understate long-range local analytics until load-older / report queries expand

## 20. Stage 4 recommendation

**Not automatic.** Stage 4 native-mobile redesign is **conditionally safe to begin** only after:

1. Production apply of Stage 2.5 RLS migration
2. Manual smoke: auth, Plaid connect/reconnect/remove, household peer cannot SELECT `bank_connections`, shared accounts still visible
3. Manual smoke: Home/Accounts/Transactions feel faster; load-older works; edit bill/goal does not full-blank UI

Do **not** start Stage 4 until that review is approved.
