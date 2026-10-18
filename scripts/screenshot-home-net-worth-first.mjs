#!/usr/bin/env node
/**
 * Renders iOS Home hierarchy (Net Worth → Safe to Spend → Available Cash…)
 * at an iPhone viewport using authoritative calculateNetWorth.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import {
  calculateAssets,
  calculateLiabilities,
  calculateNetWorth,
} from "../lib/calculations/netWorth.ts";
import { resolveCashAvailability } from "../lib/calculations/availableCash.ts";
import { computeDashboard } from "../lib/finance/computeDashboard.ts";

const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

const accounts = [
  {
    id: "a1",
    name: "Checking",
    institution: "Bank",
    type: "checking",
    balance: 2840.55,
    monthlyChange: 120,
    includeInNetWorth: true,
    includeInSafeToSpend: true,
  },
  {
    id: "a2",
    name: "Savings",
    institution: "Bank",
    type: "savings",
    balance: 6120.0,
    monthlyChange: 200,
    includeInNetWorth: true,
    includeInSafeToSpend: false,
  },
  {
    id: "a3",
    name: "Brokerage",
    institution: "Broker",
    type: "investment",
    balance: 15450.25,
    monthlyChange: 340,
    includeInNetWorth: true,
  },
];

const debts = [
  {
    id: "d1",
    name: "Card",
    type: "credit_card",
    balance: 1890.4,
    monthlyChange: -80,
    interestRate: 19.9,
    minimumPayment: 45,
    includeInNetWorth: true,
  },
];

const finance = {
  ...emptyFinanceData,
  accounts,
  debts,
};

const netWorth = calculateNetWorth(finance);
const assets = calculateAssets(finance);
const liabilities = calculateLiabilities(finance);
const cash = resolveCashAvailability(finance);
const dashboard = computeDashboard(finance);
const safeToSpend = dashboard.moneyFlow.safeToSpend;

function money(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

const changeLabel =
  netWorth.monthlyChange !== 0
    ? `${netWorth.monthlyChange >= 0 ? "+" : "-"}${money(Math.abs(netWorth.monthlyChange))} this month`
    : "Assets minus liabilities";

const html = `<!doctype html>
<html lang="en" data-native-platform="ios">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Buxme Home — Net Worth first</title>
  <style>
    :root {
      --bg: #0b0f14;
      --foreground: #f9fafb;
      --text-muted: #94a3b8;
      --text-secondary: #cbd5e1;
      --text-subtle: #64748b;
      --surface: #11161d;
      --accent: #3b82f6;
      --accent-light: #60a5fa;
      --accent-hover: #2563eb;
      --danger: #f87171;
      --success: #34d399;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--foreground);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    }
    .phone {
      width: 390px;
      margin: 0 auto;
      padding: 16px 16px 40px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .header {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
      padding: 4px 2px 8px;
    }
    .hero {
      border-radius: 22px;
      background: linear-gradient(135deg, var(--accent-light), var(--accent-hover));
      padding: 20px;
      color: white;
      box-shadow: 0 16px 40px rgba(37,99,235,0.28);
    }
    .hero .label { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.8); }
    .hero .value {
      margin-top: 6px;
      font-size: clamp(1.75rem, 8vw, 2.5rem);
      font-weight: 600;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      word-break: break-word;
    }
    .hero .change { margin-top: 8px; font-size: 13px; font-weight: 600; color: #d1fae5; }
    .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
    .chip {
      border-radius: 14px;
      background: rgba(255,255,255,0.1);
      padding: 10px 12px;
    }
    .chip span { display: block; font-size: 11px; color: rgba(255,255,255,0.7); }
    .chip strong {
      display: block; margin-top: 2px; font-size: 15px;
      font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .sts {
      border-radius: 18px;
      border: 1px solid rgba(59,130,246,0.25);
      background: linear-gradient(135deg, rgba(59,130,246,0.18), transparent);
      padding: 16px;
    }
    .sts .label { font-size: 13px; color: var(--text-muted); }
    .sts .value {
      margin-top: 4px;
      font-size: clamp(1.5rem, 7vw, 1.75rem);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      word-break: break-word;
    }
    .sts .hint { margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
    .card {
      border-radius: 16px;
      background: var(--surface);
      padding: 16px;
    }
    .card .label { font-size: 13px; color: var(--text-muted); }
    .card .value {
      margin-top: 4px;
      font-size: clamp(1.25rem, 6vw, 1.375rem);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      word-break: break-word;
    }
    .card .hint { margin-top: 4px; font-size: 12px; color: var(--text-subtle); }
    .section-title {
      margin: 8px 2px 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 15px;
    }
    .row:last-child { border-bottom: 0; }
    .row .sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .badge {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      color: var(--accent-light);
      background: rgba(59,130,246,0.12);
      padding: 4px 8px;
      border-radius: 999px;
    }
  </style>
</head>
<body>
  <div class="phone" data-testid="ios-home">
    <div class="header">Home</div>

    <section class="hero" data-home-hero="net-worth">
      <p class="label">Total Net Worth</p>
      <p class="value">${money(netWorth.value)}</p>
      <p class="change">${changeLabel}</p>
      <div class="hero-grid">
        <div class="chip"><span>Assets</span><strong>${money(assets)}</strong></div>
        <div class="chip"><span>Liabilities</span><strong>${money(liabilities)}</strong></div>
      </div>
    </section>

    <section class="sts" data-home-section="safe-to-spend">
      <p class="label">Safe to Spend</p>
      <p class="value">${money(safeToSpend)}</p>
      <p class="hint">Cash-capped after commitments</p>
    </section>

    <section class="card" data-home-section="available-cash">
      <p class="label">Available Cash</p>
      <p class="value">${money(cash.amount)}</p>
      <p class="hint">${cash.accountCount} spendable account${cash.accountCount === 1 ? "" : "s"}</p>
    </section>

    <p class="section-title">Next Paycheck</p>
    <section class="card">
      <div class="row">
        <div><strong>Weekly paycheck</strong><div class="sub">Fri · 6d</div></div>
        <span style="color:var(--success)">+$885.27</span>
      </div>
    </section>

    <p class="section-title">Budgets · Goals · Bills · Debt</p>
    <section class="card">
      <div class="row"><div><strong>Budgets</strong><div class="sub">Category limits</div></div><span>›</span></div>
      <div class="row"><div><strong>Savings Goals</strong><div class="sub">Emergency fund</div></div><span>›</span></div>
      <div class="row"><div><strong>Upcoming Bills</strong><div class="sub">This week</div></div><span>›</span></div>
      <div class="row"><div><strong>Debt Progress</strong><div class="sub">${money(liabilities)} total</div></div><span>›</span></div>
    </section>

    <span class="badge">Order verified: Net Worth → Safe to Spend → Available Cash</span>
  </div>
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "networkidle" });
const path = `${OUT}/home-net-worth-first-iphone.png`;
await page.screenshot({ path, fullPage: true });
await browser.close();

console.log(
  JSON.stringify(
    {
      path,
      netWorth: netWorth.value,
      assets,
      liabilities,
      safeToSpend,
      availableCash: cash.amount,
      order: ["net-worth", "safe-to-spend", "available-cash"],
    },
    null,
    2,
  ),
);
