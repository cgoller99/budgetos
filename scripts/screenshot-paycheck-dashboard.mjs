#!/usr/bin/env node
/**
 * Renders Budgets sections 1–5 from the live $885.27 plan + posted balances
 * (read-only — does not write financial records). Captures narrow + desktop.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { buildPaycheckBreakdown } from "../lib/budgets/paycheckBreakdown.ts";
import { buildAccountForecasts } from "../lib/budgets/accountForecast.ts";

const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

// Live account IDs + posted balances from authenticated owner (read-only verify).
const accounts = [
  { id: "ec4d0815-61cd-4528-b857-d3b2e91c5f2b", name: "Savings", institution: "Bank", type: "savings", balance: 101.58, monthlyChange: 0, lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "66a17840-052d-41d0-bc74-c2943bd08bd8", name: "Vacation", institution: "Bank", type: "checking", balance: 401.05, monthlyChange: 0, lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "9c461135-c7d6-4f62-8147-a5d742a666de", name: "Investing", institution: "Bank", type: "checking", balance: 166.21, monthlyChange: 0, lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "b261ddbd-caf4-4092-b759-01f199f1fad6", name: "Bills", institution: "Bank", type: "checking", balance: 603.9, monthlyChange: 0, lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "f9d68006-b50a-43a1-9601-d316616acbee", name: "Credit Cards", institution: "Bank", type: "checking", balance: 2931.91, monthlyChange: 0, lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
];

const plan = {
  id: "96ef4833-a133-45bc-929b-a53c7c4c91a8",
  paySchedule: "weekly",
  paycheckAmount: 885.27,
  anchorDate: "2026-10-03",
  weeklyDayOfWeek: 5,
  monthlyDays: [1, 15],
  customIntervalDays: null,
  depositAccountId: accounts[4].id,
  nextPayDate: "2026-10-24",
  lastProcessedDate: null,
  isActive: true,
  ownerUserId: "2062b2b2-f80f-4782-be2d-e0da8d0755c8",
  allocations: [
    { id: "a1", name: "Emergency / House Savings", icon: "🏠", amount: 350.27, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: accounts[0].id, goalId: "76eecfec-12c4-434d-a9ae-927eb5333ae7", billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 0 },
    { id: "a2", name: "Vacation Savings", icon: "✈️", amount: 50, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: accounts[1].id, goalId: "aa14f12b-3115-4bca-ae7e-ac8471214829", billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 1 },
    { id: "a3", name: "Investments", icon: "📈", amount: 0, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: null, goalId: "f553fcde-3761-445a-b68b-43052b842eec", billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 2 },
    { id: "a4", name: "Rent Reserve", icon: "🔑", amount: 175, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: accounts[2].id, goalId: null, billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 3 },
    { id: "a5", name: "Bills", icon: "🧾", amount: 110, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: accounts[3].id, goalId: null, billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 4 },
    { id: "a6", name: "Personal Spending", icon: "🛒", amount: 200, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: accounts[4].id, goalId: null, billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 5 },
  ],
};

const data = {
  ...emptyFinanceData,
  viewerUserId: plan.ownerUserId,
  accounts,
  savingsGoals: [
    { id: "76eecfec-12c4-434d-a9ae-927eb5333ae7", name: "Emergency / House Savings", type: "emergency", icon: "🏠", current: 101.58, target: 20000, createdAt: "2026-01-01" },
    { id: "aa14f12b-3115-4bca-ae7e-ac8471214829", name: "Vacation", type: "vacation", icon: "✈️", current: 401.05, target: 2000, createdAt: "2026-01-01" },
    { id: "f553fcde-3761-445a-b68b-43052b842eec", name: "Investments", type: "investment", icon: "📈", current: 0, target: 10000, createdAt: "2026-01-01" },
  ],
  incomePlan: plan,
  incomePlanPaychecks: [],
};

const breakdown = buildPaycheckBreakdown(data);
const forecasts = buildAccountForecasts(data, { horizonWeeks: 13 });

function money(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const rowsHtml = breakdown.rows
  .map((row) => {
    const contrib = forecasts.contributionRows.find((c) => c.allocationId === row.allocationId);
    return `
    <article class="alloc">
      <div class="alloc-top">
        <span class="icon">${row.icon}</span>
        <div class="alloc-main">
          <div class="alloc-title">
            <strong>${row.name}</strong>
            <span class="amt">${money(row.amountPerPaycheck)}</span>
          </div>
          <div class="meta">${row.percentOfPaycheck}% · ${row.accountName ? `→ ${row.accountName}` : "No account linked"} · 13w +${money(contrib?.contributionsByHorizon[13] ?? 0)}</div>
        </div>
      </div>
    </article>`;
  })
  .join("");

const linkedHtml = forecasts.accounts
  .map(
    (account) => `
    <article class="forecast">
      <div class="forecast-top">
        <strong>${account.accountName}</strong>
        <span class="amt">${money(account.currentBalance)}</span>
      </div>
      <p class="disclaimer">${account.balanceSource}</p>
      <ul class="purposes">
        ${account.purposes
          .map(
            (p) =>
              `<li><span>${p.name}</span><span class="amt">${money(p.weeklyAddition)}/wk</span></li>`,
          )
          .join("")}
      </ul>
    </article>`,
  )
  .join("");

const contribHtml = forecasts.contributionRows
  .filter((r) => r.purposeKind === "accumulate" || r.purposeKind === "rent_reserve" || r.weeklyAmount > 0)
  .map(
    (row) => `
    <article class="forecast">
      <div class="forecast-top"><strong>${row.icon} ${row.name}</strong><span>${money(row.weeklyAmount)}/wk</span></div>
      <div class="alloc-grid">
        <div><span>4w</span><b>+${money(row.contributionsByHorizon[4])}</b></div>
        <div><span>13w</span><b>+${money(row.contributionsByHorizon[13])}</b></div>
        <div><span>26w</span><b>+${money(row.contributionsByHorizon[26])}</b></div>
        <div><span>52w</span><b>+${money(row.contributionsByHorizon[52])}</b></div>
      </div>
    </article>`,
  )
  .join("");

const endingHtml = forecasts.accounts
  .map((account) => {
    const h = account.horizons.find((item) => item.weeks === 13);
    return `
    <article class="forecast">
      <div class="forecast-top">
        <strong>${account.accountName}</strong>
        <span class="amt">${money(h.projectedBalance)}</span>
      </div>
      <div class="alloc-grid">
        <div><span>Current</span><b>${money(account.currentBalance)}</b></div>
        <div><span>Deposits</span><b>+${money(h.plannedDeposits)}</b></div>
        <div><span>Withdrawals</span><b>−${money(h.plannedWithdrawals)}</b></div>
        <div><span>Weekly net</span><b>${money(account.weeklyNet)}</b></div>
      </div>
      <p class="disclaimer">${account.estimateDisclaimer}</p>
    </article>`;
  })
  .join("");

const css = `
  :root {
    --foreground: #f4f7fb; --text-muted: #8b97a8; --text-secondary: #a8b3c2;
    --surface: #121820; --surface-subtle: #1a222d; --surface-border: rgba(255,255,255,0.08);
    --accent: #3d8bfd; --bg: #0b1017;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
    background: radial-gradient(120% 80% at 50% -10%, #1a2740 0%, var(--bg) 55%);
    color: var(--foreground);
  }
  .frame { margin: 0 auto; padding: 16px 14px 48px; }
  .frame.narrow { max-width: 390px; }
  .frame.desktop { max-width: 980px; }
  h1 { font-size: 28px; margin: 8px 0 4px; letter-spacing: -0.03em; }
  .sub { color: var(--text-muted); font-size: 13px; margin: 0 0 16px; }
  .card {
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: 16px; padding: 14px; margin-bottom: 12px;
  }
  .card h2 { font-size: 15px; margin: 0 0 4px; }
  .card .desc { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; }
  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .desktop .metrics { grid-template-columns: repeat(4, 1fr); }
  .metric { background: var(--surface-subtle); border-radius: 12px; padding: 10px 12px; min-width: 0; }
  .metric span { display: block; font-size: 11px; color: var(--text-muted); }
  .metric b { display: block; margin-top: 4px; font-size: 14px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alloc, .forecast {
    background: var(--surface-subtle); border: 1px solid var(--surface-border);
    border-radius: 14px; padding: 12px; margin-bottom: 8px;
  }
  .alloc-top, .forecast-top { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; }
  .icon { font-size: 18px; }
  .alloc-main { min-width: 0; flex: 1; }
  .alloc-title { display: flex; justify-content: space-between; gap: 8px; }
  .alloc-title strong, .forecast-top strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  .amt { font-variant-numeric: tabular-nums; font-weight: 650; white-space: nowrap; }
  .meta { margin-top: 3px; font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alloc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
  .alloc-grid span { display: block; font-size: 10px; color: var(--text-muted); }
  .alloc-grid b { display: block; margin-top: 2px; font-size: 12px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .disclaimer { margin: 6px 0 0; font-size: 10px; color: var(--text-muted); line-height: 1.35; }
  .purposes { list-style: none; margin: 8px 0 0; padding: 0; }
  .purposes li { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text-secondary); padding: 2px 0; }
  .insights {
    margin-top: 8px; border-radius: 16px; border: 1px solid var(--surface-border);
    background: var(--surface-subtle); padding: 14px 16px; color: var(--text-secondary); font-size: 13px;
  }
  .pill { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 12px; background: var(--accent); color: white; font-size: 13px; font-weight: 600; margin-right: 8px; }
  .pill.ghost { background: var(--surface-subtle); color: var(--text-secondary); }
`;

function page(widthClass) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Budgets — Ongoing Plan</title><style>${css}</style></head>
<body><main class="frame ${widthClass}">
  <h1>Budgets</h1>
  <p class="sub">Ongoing paycheck plan first — then linked accounts, projections, spending, and suggestions last.</p>

  <section class="card">
    <h2>1. Ongoing Budget</h2>
    <p class="desc">Weekly paycheck · saved Income Plan</p>
    <div class="metrics">
      <div class="metric"><span>Income</span><b>${money(breakdown.paycheckAmount)}</b></div>
      <div class="metric"><span>Allocated</span><b>${money(breakdown.totalAllocated)}</b></div>
      <div class="metric"><span>Unallocated</span><b>${money(breakdown.unallocated)}</b></div>
      <div class="metric"><span>Schedule</span><b>Weekly</b></div>
    </div>
    <div style="margin-top:12px">${rowsHtml}</div>
  </section>

  <section class="card">
    <h2>2. Linked Accounts</h2>
    <p class="desc">Posted balances and assigned paycheck allocations</p>
    ${linkedHtml}
  </section>

  <section class="card">
    <h2>3. Projected Balances</h2>
    <p class="desc">Contribution totals and ending balances — estimates, not guarantees</p>
    <div class="pill ghost">4 weeks</div><div class="pill">13 weeks</div><div class="pill ghost">26 weeks</div><div class="pill ghost">52 weeks</div>
    <p class="desc" style="margin-top:12px">Planned contribution totals</p>
    ${contribHtml}
    <p class="desc">Account ending balances @ 13 weeks</p>
    ${endingHtml}
  </section>

  <section class="card">
    <h2>4. Spending Progress &amp; Upcoming Bills</h2>
    <p class="desc">Category limits and bills — after the ongoing budget</p>
    <div class="metrics">
      <div class="metric"><span>Safe to Spend</span><b>—</b></div>
      <div class="metric"><span>Until payday</span><b>—</b></div>
    </div>
  </section>

  <div class="insights">5. Suggestions &amp; Insights · collapsed by default · below the budget</div>
</main></body></html>`;
}

const narrowPath = `${OUT}/budgets_after_narrow.html`;
const desktopPath = `${OUT}/budgets_after_desktop.html`;
writeFileSync(narrowPath, page("narrow"));
writeFileSync(desktopPath, page("desktop"));

const browser = await chromium.launch({ headless: true });

const narrow = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await narrow.goto(`file://${narrowPath}`, { waitUntil: "networkidle" });
await narrow.screenshot({ path: `${OUT}/budgets_after_ongoing_narrow.png`, fullPage: true });
await narrow.close();

const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
await desktop.goto(`file://${desktopPath}`, { waitUntil: "networkidle" });
await desktop.screenshot({ path: `${OUT}/budgets_after_ongoing_desktop.png`, fullPage: true });
await desktop.close();

// Production before: capture login gate / old page if reachable without auth
const prod = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await prod.goto("https://buxme.co/budgets", { waitUntil: "networkidle", timeout: 45000 });
await prod.screenshot({ path: `${OUT}/budgets_production_before_gate.png`, fullPage: true });
const prodUrl = prod.url();
await prod.close();

await browser.close();

const house = forecasts.contributionRows.find((r) => /House/i.test(r.name));
const vacation = forecasts.contributionRows.find((r) => /Vacation/i.test(r.name));
const rent = forecasts.contributionRows.find((r) => /Rent/i.test(r.name));
console.log(JSON.stringify({
  prodUrl,
  house13: house?.contributionsByHorizon[13],
  house26: house?.contributionsByHorizon[26],
  vacation13: vacation?.contributionsByHorizon[13],
  vacation26: vacation?.contributionsByHorizon[26],
  rent13: rent?.contributionsByHorizon[13],
  rent26: rent?.contributionsByHorizon[26],
  accounts: forecasts.accounts.map((a) => ({
    name: a.accountName,
    current: a.currentBalance,
    at13: a.horizons.find((h) => h.weeks === 13)?.projectedBalance,
    deposits13: a.horizons.find((h) => h.weeks === 13)?.plannedDeposits,
    withdrawals13: a.horizons.find((h) => h.weeks === 13)?.plannedWithdrawals,
  })),
}, null, 2));
console.log("✅ Screenshots captured");
