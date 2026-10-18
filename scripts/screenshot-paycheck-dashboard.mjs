#!/usr/bin/env node
/**
 * Renders Budgets paycheck dashboard UI from the live $885.27 plan shape
 * (read-only fixture — does not write financial records) and captures
 * narrow + standard iPhone viewports.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { buildPaycheckBreakdown } from "../lib/budgets/paycheckBreakdown.ts";
import { buildAccountForecasts } from "../lib/budgets/accountForecast.ts";

const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

const accounts = [
  { id: "ec4d0815-61cd-4528-b857-d3b2e91c5f2b", name: "House Savings", institution: "Bank", type: "savings", balance: 1840.5, monthlyChange: 0, lastSyncedAt: "2026-10-17T16:00:00.000Z" },
  { id: "66a17840-052d-41d0-bc74-c2943bd08bd8", name: "Vacation", institution: "Bank", type: "savings", balance: 412.0, monthlyChange: 0, lastSyncedAt: "2026-10-17T16:00:00.000Z" },
  { id: "9c461135-c7d6-4f62-8147-a5d742a666de", name: "Investing checking", institution: "Bank", type: "checking", balance: 980.0, monthlyChange: 0, lastSyncedAt: "2026-10-17T16:00:00.000Z" },
  { id: "b261ddbd-caf4-4092-b759-01f199f1fad6", name: "Bills", institution: "Bank", type: "checking", balance: 265.0, monthlyChange: 0, lastSyncedAt: null },
  { id: "f9d68006-b50a-43a1-9601-d316616acbee", name: "Spending", institution: "Bank", type: "checking", balance: 540.0, monthlyChange: 0, lastSyncedAt: "2026-10-18T12:00:00.000Z" },
];

const plan = {
  id: "96ef4833-a133-45bc-929b-a53c7c4c91a8",
  paySchedule: "weekly",
  paycheckAmount: 885.27,
  anchorDate: "2026-10-03",
  weeklyDayOfWeek: 5,
  monthlyDays: [1, 15],
  customIntervalDays: null,
  depositAccountId: "f9d68006-b50a-43a1-9601-d316616acbee",
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
    { id: "76eecfec-12c4-434d-a9ae-927eb5333ae7", name: "Emergency / House Savings", type: "emergency", icon: "🏠", current: 1840.5, target: 20000, createdAt: "2026-01-01" },
    { id: "aa14f12b-3115-4bca-ae7e-ac8471214829", name: "Vacation", type: "vacation", icon: "✈️", current: 412, target: 2000, createdAt: "2026-01-01" },
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
  .map(
    (row) => `
    <article class="alloc">
      <div class="alloc-top">
        <span class="icon">${row.icon}</span>
        <div class="alloc-main">
          <div class="alloc-title">
            <strong>${row.name}</strong>
            <span class="amt">${money(row.amountPerPaycheck)}</span>
          </div>
          <div class="meta">${row.percentOfPaycheck}% · ${row.accountName ? `→ ${row.accountName}` : "No account linked"} · ${row.goalName ?? "Flexible"}</div>
        </div>
      </div>
      <div class="alloc-grid">
        <div><span>Weekly</span><b>${money(row.amountWeekly)}</b></div>
        <div><span>Confirmed</span><b>${money(row.contributedThisMonth)}</b></div>
        <div><span>Remaining</span><b>${money(row.remainingMonthlyAllowance)}</b></div>
      </div>
    </article>`,
  )
  .join("");

const forecastHtml = forecasts.accounts
  .map((account) => {
    const h = account.horizons.find((item) => item.weeks === 13);
    return `
    <article class="forecast">
      <div class="forecast-top">
        <strong>${account.accountName}</strong>
        <span>${money(account.currentBalance)} now</span>
      </div>
      <div class="alloc-grid">
        <div><span>13 weeks</span><b>${money(h.projectedBalance)}</b></div>
        <div><span>Weekly adds</span><b>${money(account.weeklyPlannedDeposits)}</b></div>
      </div>
      <p class="disclaimer">${account.estimateDisclaimer}</p>
    </article>`;
  })
  .join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Budgets — Paycheck Plan</title>
<style>
  :root {
    --foreground: #f4f7fb;
    --text-muted: #8b97a8;
    --text-secondary: #a8b3c2;
    --surface: #121820;
    --surface-subtle: #1a222d;
    --surface-border: rgba(255,255,255,0.08);
    --accent: #3d8bfd;
    --bg: #0b1017;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
    background: radial-gradient(120% 80% at 50% -10%, #1a2740 0%, var(--bg) 55%);
    color: var(--foreground);
  }
  .phone {
    max-width: 430px;
    margin: 0 auto;
    padding: 16px 14px 40px;
  }
  h1 { font-size: 28px; margin: 8px 0 4px; letter-spacing: -0.03em; }
  .sub { color: var(--text-muted); font-size: 13px; margin: 0 0 16px; }
  .card {
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    padding: 14px;
    margin-bottom: 12px;
  }
  .card h2 { font-size: 15px; margin: 0 0 4px; }
  .card .desc { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; }
  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .metric {
    background: var(--surface-subtle);
    border-radius: 12px;
    padding: 10px 12px;
    min-width: 0;
  }
  .metric span { display: block; font-size: 11px; color: var(--text-muted); }
  .metric b { display: block; margin-top: 4px; font-size: 14px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alloc, .forecast {
    background: var(--surface-subtle);
    border: 1px solid var(--surface-border);
    border-radius: 14px;
    padding: 12px;
    margin-bottom: 8px;
  }
  .alloc-top { display: flex; gap: 10px; align-items: flex-start; }
  .icon { font-size: 18px; }
  .alloc-main { min-width: 0; flex: 1; }
  .alloc-title { display: flex; justify-content: space-between; gap: 8px; }
  .alloc-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  .amt { font-variant-numeric: tabular-nums; font-weight: 650; white-space: nowrap; }
  .meta { margin-top: 3px; font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alloc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
  .alloc-grid span { display: block; font-size: 10px; color: var(--text-muted); }
  .alloc-grid b { display: block; margin-top: 2px; font-size: 12px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .forecast-top { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
  .disclaimer { margin: 8px 0 0; font-size: 10px; color: var(--text-muted); line-height: 1.35; }
  .pill {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px;
    border-radius: 12px; background: var(--accent); color: white; font-size: 13px; font-weight: 600;
    margin-right: 8px; margin-top: 8px;
  }
  .pill.ghost { background: var(--surface-subtle); color: var(--text-secondary); }
  .insights {
    margin-top: 8px; border-radius: 16px; border: 1px solid var(--surface-border);
    background: var(--surface-subtle); padding: 14px 16px; color: var(--text-secondary); font-size: 13px;
  }
  .empty-note { color: var(--text-muted); font-size: 13px; }
</style>
</head>
<body>
  <main class="phone" id="app">
    <h1>Budgets</h1>
    <p class="sub">Paycheck plan, linked accounts, and category limits — cash stays separate from allowances.</p>

    <section class="card">
      <h2>Weekly paycheck overview</h2>
      <p class="desc">Weekly · from your saved Income Plan</p>
      <div class="metrics">
        <div class="metric"><span>Income</span><b>${money(breakdown.paycheckAmount)}</b></div>
        <div class="metric"><span>Allocated</span><b>${money(breakdown.totalAllocated)}</b></div>
        <div class="metric"><span>Unallocated</span><b>${money(breakdown.unallocated)}</b></div>
        <div class="metric"><span>Schedule</span><b>Weekly</b></div>
      </div>
      <div class="pill ghost">What-If mode</div>
      <div class="pill ghost">4w</div>
      <div class="pill">13w</div>
      <div class="pill ghost">26w</div>
      <div class="pill ghost">52w</div>
    </section>

    <section class="card">
      <h2>Allocation breakdown</h2>
      <p class="desc">Per paycheck · % · destination · goal/category · confirmed vs remaining</p>
      ${rowsHtml}
    </section>

    <section class="card">
      <h2>Savings projections</h2>
      <p class="desc">Estimates from posted balances + planned weekly activity</p>
      ${forecastHtml || '<p class="empty-note">Link allocations to see projections.</p>'}
    </section>

    <section class="card">
      <h2>Category budgets</h2>
      <p class="empty-note">No category budgets yet. Your Income Plan above is the paycheck source of truth.</p>
    </section>

    <div class="insights">Insights &amp; recommendations · collapsed by default · bill shortfalls still surface when needed</div>
  </main>
</body>
</html>`;

const htmlPath = `${OUT}/paycheck-dashboard-preview.html`;
writeFileSync(htmlPath, html);

const browser = await chromium.launch({ headless: true });
for (const [name, width] of [
  ["budgets_paycheck_narrow_iphone", 390],
  ["budgets_paycheck_standard_iphone", 430],
]) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: true,
  });
  await page.close();
  console.log(`Wrote ${OUT}/${name}.png`);
}

// Empty-state screenshot
const emptyHtml = html
  .replace(rowsHtml, '<p class="empty-note">No active Income Plan. Category budgets and Safe to Spend still work from cash and bills.</p>')
  .replace(forecastHtml, '<p class="empty-note">Link allocations to accounts to see balance projections.</p>')
  .replace(money(breakdown.paycheckAmount), "$0.00")
  .replace(money(breakdown.totalAllocated), "$0.00");
const emptyPath = `${OUT}/paycheck-dashboard-empty.html`;
writeFileSync(emptyPath, emptyHtml);
const emptyPage = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await emptyPage.goto(`file://${emptyPath}`, { waitUntil: "networkidle" });
await emptyPage.screenshot({
  path: `${OUT}/budgets_paycheck_empty_state.png`,
  fullPage: true,
});
await emptyPage.close();
console.log(`Wrote ${OUT}/budgets_paycheck_empty_state.png`);

await browser.close();
console.log("✅ Screenshots captured");
