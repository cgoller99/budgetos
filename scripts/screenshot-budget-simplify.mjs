#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { buildPaycheckBreakdown } from "../lib/budgets/paycheckBreakdown.ts";
import { buildAccountForecasts } from "../lib/budgets/accountForecast.ts";
import { formatBankAccountShort } from "../lib/budgets/accountDisplay.ts";

const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

const accounts = [
  { id: "ec4d0815-61cd-4528-b857-d3b2e91c5f2b", name: "Savings", nickname: "House Savings", institution: "Bank", type: "savings", balance: 101.58, monthlyChange: 0, lastFour: "4821", lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "66a17840-052d-41d0-bc74-c2943bd08bd8", name: "Vacation", institution: "Bank", type: "checking", balance: 401.05, monthlyChange: 0, lastFour: "1092", lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "9c461135-c7d6-4f62-8147-a5d742a666de", name: "Investing", institution: "Bank", type: "checking", balance: 166.21, monthlyChange: 0, lastFour: "7730", lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "b261ddbd-caf4-4092-b759-01f199f1fad6", name: "Bills", institution: "Bank", type: "checking", balance: 603.9, monthlyChange: 0, lastFour: "5544", lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
  { id: "f9d68006-b50a-43a1-9601-d316616acbee", name: "Credit Cards", institution: "Bank", type: "checking", balance: 2931.91, monthlyChange: 0, lastFour: "2210", lastSyncedAt: "2026-10-18T10:46:59.960Z", isPlaidLinked: true },
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
    { id: "a1", name: "Emergency / House Savings", icon: "🏠", amount: 350.27, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: accounts[0].id, goalId: "g1", billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 0 },
    { id: "a2", name: "Vacation Savings", icon: "✈️", amount: 50, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: accounts[1].id, goalId: "g2", billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 1 },
    { id: "a3", name: "Investments", icon: "📈", amount: 0, percentage: null, allocationType: "fixed", isRemainingBalance: false, accountId: null, goalId: "g3", billId: null, debtId: null, investmentId: null, monthlyTarget: null, contributionFrequency: null, sortOrder: 2 },
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
    { id: "g1", name: "House", type: "emergency", icon: "🏠", current: 101.58, target: 20000, createdAt: "2026-01-01" },
    { id: "g2", name: "Vacation", type: "vacation", icon: "✈️", current: 401.05, target: 2000, createdAt: "2026-01-01" },
    { id: "g3", name: "Investments", type: "investment", icon: "📈", current: 0, target: 10000, createdAt: "2026-01-01" },
  ],
  incomePlan: plan,
};
const breakdown = buildPaycheckBreakdown(data);
const forecasts = buildAccountForecasts(data);
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const byId = new Map(accounts.map((a) => [a.id, a]));

const rows = breakdown.rows
  .map((row) => {
    const acct = row.accountId ? byId.get(row.accountId) : null;
    return `<article class="card-item">
      <div class="row"><span>${row.icon} <b>${row.name}</b></span><b class="amt">${money(row.amountPerPaycheck)}</b></div>
      <div class="meta">Bank account: ${acct ? formatBankAccountShort(acct) : "No bank account linked"}</div>
      <div class="actions"><span class="link">Edit</span><span class="muted">Details</span></div>
    </article>`;
  })
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
:root{--fg:#f4f7fb;--muted:#8b97a8;--surface:#121820;--subtle:#1a222d;--border:rgba(255,255,255,.08);--accent:#3d8bfd;--bg:#0b1017}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:radial-gradient(120% 80% at 50% -10%,#1a2740 0%,var(--bg) 55%);color:var(--fg)}
.phone{max-width:390px;margin:0 auto;padding:16px 14px 40px}
h1{font-size:28px;margin:8px 0 4px}.sub{color:var(--muted);font-size:13px;margin:0 0 14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:12px}
.card h2{font-size:15px;margin:0 0 4px}.desc{font-size:12px;color:var(--muted);margin:0 0 12px}
.metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.metric{background:var(--subtle);border-radius:12px;padding:10px}.metric span{display:block;font-size:11px;color:var(--muted)}.metric b{display:block;margin-top:4px;font-size:13px;font-variant-numeric:tabular-nums}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:12px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;border:0}
.card-item{background:var(--subtle);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:8px}
.row{display:flex;justify-content:space-between;gap:8px}.amt{font-variant-numeric:tabular-nums}
.meta{margin-top:6px;font-size:12px;color:var(--muted)}.actions{display:flex;gap:16px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:12px}
.link{color:#7eb6ff;font-weight:600}.muted{color:var(--muted)}
.pill{display:inline-flex;min-height:44px;align-items:center;padding:0 12px;border-radius:12px;background:var(--subtle);margin-right:6px;font-size:13px}
.pill.on{background:var(--accent)}
.insights{border-radius:16px;border:1px solid var(--border);background:var(--subtle);padding:14px;color:var(--muted);font-size:13px}
</style></head><body><main class="phone">
<h1>Budgets</h1>
<p class="sub">See where your paycheck goes, pick the right bank account, and peek at future balances.</p>
<section class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><h2>1. My Budget</h2><p class="desc">Weekly income</p></div><button class="btn">Edit Budget</button></div>
<div class="metrics"><div class="metric"><span>Income</span><b>${money(breakdown.paycheckAmount)}</b></div><div class="metric"><span>Allocated</span><b>${money(breakdown.totalAllocated)}</b></div><div class="metric"><span>Money Left</span><b>${money(breakdown.unallocated)}</b></div></div></section>
<section class="card"><h2>2. Where My Money Goes</h2><p class="desc">Each slice of your paycheck</p>${rows}</section>
<section class="card"><h2>3. My Accounts</h2><p class="desc">Where paycheck pieces are parked</p>
${forecasts.accounts.map((a)=>{const live=byId.get(a.accountId);return `<div class="card-item"><div class="row"><b>${live?formatBankAccountShort(live):a.accountName}</b><b class="amt">${money(a.currentBalance)}</b></div><div class="meta">Actual money · ${a.purposes.map(p=>p.name).join(", ")}</div></div>`;}).join("")}
</section>
<section class="card"><h2>4. Future Balances</h2><p class="desc">Estimates from actual + planned money</p>
<span class="pill">1 mo</span><span class="pill on">3 mo</span><span class="pill">6 mo</span><span class="pill">12 mo</span>
${forecasts.accounts.map((a)=>{const h=a.horizons.find(x=>x.id==="3m");return `<div class="card-item" style="margin-top:10px"><div class="row"><b>${a.accountName}</b><b class="amt">${money(h.projectedBalance)}</b></div><div class="meta">Actual ${money(a.currentBalance)} · Planned in +${money(h.plannedDeposits)} · Planned out −${money(h.plannedWithdrawals)}</div></div>`;}).join("")}
</section>
<div class="insights">5. Suggestions · collapsed</div>
</main></body></html>`;

writeFileSync(`${OUT}/budget_simplify_preview.html`, html);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(`file://${OUT}/budget_simplify_preview.html`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/budgets_simplify_after_narrow.png`, fullPage: true });
await page.close();

// Editor sheet mock
const editor = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{margin:0;background:#0008;font-family:-apple-system,sans-serif;color:#f4f7fb}
.sheet{position:fixed;left:0;right:0;bottom:0;max-width:390px;margin:0 auto;background:#0b0f14;border-radius:22px 22px 0 0;padding:12px 16px 28px;border:1px solid rgba(255,255,255,.08)}
.handle{width:40px;height:4px;border-radius:999px;background:#fff4;margin:4px auto 12px}
h2{text-align:center;font-size:17px;margin:0 0 14px}
label{display:block;font-size:12px;color:#8b97a8;margin-bottom:12px}
input,select{width:100%;min-height:44px;margin-top:6px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#121820;color:#fff;padding:0 12px}
.opt{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:10px;border-radius:12px;margin-top:6px;background:#121820}
.opt.on{outline:1px solid #3d8bfd;background:#3d8bfd22}
.footer{display:flex;gap:8px;margin-top:16px}
.btn{flex:1;min-height:44px;border:0;border-radius:12px;font-weight:600}
.primary{background:#3d8bfd;color:#fff}.secondary{background:#1a222d;color:#a8b3c2}
</style></head><body><div class="sheet"><div class="handle"></div><h2>Edit allocation</h2>
<label>Name<input value="Personal Spending"/></label>
<label>Amount per paycheck<input value="200"/></label>
<label>Bank account
<div class="opt"><input type="radio"/><div>No bank account</div></div>
<div class="opt"><input type="radio"/><div>House Savings · Bank ···4821<br/><span style="color:#8b97a8;font-size:12px">$101.58 actual</span></div></div>
<div class="opt on"><input type="radio" checked/><div>Credit Cards · Bank ···2210 · Current<br/><span style="color:#8b97a8;font-size:12px">$2,931.91 actual</span></div></div>
<div class="opt"><input type="radio"/><div>Investing · Bank ···7730<br/><span style="color:#8b97a8;font-size:12px">$166.21 actual</span></div></div>
</label>
<div class="footer"><button class="btn secondary">Cancel</button><button class="btn primary">Save</button></div>
</div></body></html>`;
writeFileSync(`${OUT}/budget_edit_sheet.html`, editor);
const sheet = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await sheet.goto(`file://${OUT}/budget_edit_sheet.html`, { waitUntil: "networkidle" });
await sheet.screenshot({ path: `${OUT}/budgets_edit_sheet_account_picker.png`, fullPage: true });
await sheet.close();
await browser.close();
console.log("✅ simplify screenshots written");
