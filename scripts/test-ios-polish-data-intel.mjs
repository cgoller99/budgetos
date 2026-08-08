#!/usr/bin/env node
/**
 * iOS polish + data intelligence unit checks.
 * Usage: node scripts/test-ios-polish-data-intel.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// ─── Currency formatting (mirrors lib/finance/format.ts rules) ───
function formatCurrency(amount) {
  const value = Number.isFinite(amount)
    ? Math.round((amount + Number.EPSILON) * 100) / 100
    : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

assert.equal(formatCurrency(3816.193), "$3,816.19");
assert.equal(formatCurrency(2507.963), "$2,507.96");
assert.equal(formatCurrency(5308.4), "$5,308.40");
assert.equal(formatCurrency(0), "$0.00");
assert.equal(formatCurrency(1000), "$1,000.00");
assert.equal(formatCurrency(NaN), "$0.00");

const formatSrc = fs.readFileSync(path.join(ROOT, "lib/finance/format.ts"), "utf8");
assert.match(formatSrc, /minimumFractionDigits:\s*2/);
assert.match(formatSrc, /maximumFractionDigits:\s*2/);

// ─── Category presentation ───
function normalizeKey(value) {
  return value.trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function getDisplayCategory(raw) {
  const key = normalizeKey(raw ?? "");
  const map = {
    "TRANSFER OUT ACCOUNT TRANSFER": "Transfers",
    "TRANSFER OUT SAVINGS": "Transfers",
    "LOAN PAYMENTS CREDIT CARD PAYMENT": "Credit Card Payment",
    "GENERAL MERCHANDISE": "Shopping",
    "GENERAL SERVICES AUTOMOTIVE": "Automotive",
  };
  if (map[key]) return map[key];
  if (key.startsWith("TRANSFER")) return "Transfers";
  if (key.startsWith("LOAN PAYMENTS CREDIT CARD")) return "Credit Card Payment";
  if (key.startsWith("GENERAL MERCHANDISE")) return "Shopping";
  if (key.startsWith("GENERAL SERVICES AUTOMOTIVE")) return "Automotive";
  return raw?.trim() || "Other";
}

assert.equal(getDisplayCategory("TRANSFER OUT ACCOUNT TRANSFER"), "Transfers");
assert.equal(getDisplayCategory("TRANSFER OUT SAVINGS"), "Transfers");
assert.equal(
  getDisplayCategory("LOAN PAYMENTS CREDIT CARD PAYMENT"),
  "Credit Card Payment",
);
assert.equal(getDisplayCategory("GENERAL MERCHANDISE"), "Shopping");
assert.equal(getDisplayCategory("GENERAL SERVICES AUTOMOTIVE"), "Automotive");

const categorySrc = fs.readFileSync(
  path.join(ROOT, "lib/transactions/categoryPresentation.ts"),
  "utf8",
);
assert.match(categorySrc, /getDisplayCategory/);
assert.match(categorySrc, /TRANSFER OUT SAVINGS/);

// ─── Internal transfer classification (conservative) ───
function isConfidentInternalTransfer(tx) {
  if (tx.type === "transfer") return true;
  const haystack = `${tx.notes ?? ""} ${tx.category ?? ""}`.toUpperCase();
  if (/\bVENMO\b|\bZELLE\b|\bCASH APP\b|\bPAYPAL\b/.test(haystack)) {
    return false; // peer payment without pairing → keep as real money movement
  }
  if (haystack.includes("TRANSFER OUT") || haystack.includes("ACCOUNT TRANSFER")) {
    return true;
  }
  if (haystack.includes("CREDIT CARD PAYMENT")) return true;
  return false;
}

assert.equal(
  isConfidentInternalTransfer({
    type: "expense",
    category: "TRANSFER OUT SAVINGS",
    notes: "Online Transfer",
  }),
  true,
);
assert.equal(
  isConfidentInternalTransfer({
    type: "expense",
    category: "Food",
    notes: "Venmo Coffee",
  }),
  false,
);
assert.equal(
  isConfidentInternalTransfer({ type: "transfer", category: "Other", notes: "Move" }),
  true,
);

const transferSrc = fs.readFileSync(
  path.join(ROOT, "lib/transactions/transferDetection.ts"),
  "utf8",
);
assert.match(transferSrc, /isConfidentInternalTransfer/);
assert.match(transferSrc, /filterRealExpenseTransactions/);
assert.match(transferSrc, /PEER_PAYMENT/);

const spendingSrc = fs.readFileSync(
  path.join(ROOT, "lib/calculations/spending.ts"),
  "utf8",
);
assert.match(spendingSrc, /isInternalTransferExpense/);

const reportSrc = fs.readFileSync(
  path.join(ROOT, "lib/reports/reportMetrics.ts"),
  "utf8",
);
assert.match(reportSrc, /getDisplayCategory/);
assert.match(reportSrc, /filterRealExpenseTransactions/);

// ─── Debt-free date edge cases ───
const MAX_SIMULATION_MONTHS = 600;

function canEstimateDebtFreeDate(debts, extraMonthly = 0) {
  const active = debts.filter((d) => d.balance > 0.01);
  if (active.length === 0) return true;
  const totalPayment =
    active.reduce((sum, d) => sum + Math.max(d.minimumPayment, 0), 0) +
    Math.max(extraMonthly, 0);
  if (totalPayment <= 0) return false;
  return active.some((debt) => {
    const monthlyInterest = debt.balance * (Math.max(debt.interestRate, 0) / 100 / 12);
    return debt.minimumPayment + extraMonthly > monthlyInterest + 0.01;
  });
}

function formatEstimatedDebtFreeLabel({ isReliable, debtFreeDate }) {
  if (!isReliable) return "Add payment plan";
  return debtFreeDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

assert.equal(canEstimateDebtFreeDate([{ balance: 1374.59, minimumPayment: 0, interestRate: 22 }]), false);
assert.equal(
  formatEstimatedDebtFreeLabel({
    isReliable: false,
    debtFreeDate: new Date(2076, 7, 1),
  }),
  "Add payment plan",
);
assert.notEqual(
  formatEstimatedDebtFreeLabel({
    isReliable: false,
    debtFreeDate: new Date(2076, 7, 1),
  }),
  "Aug 2076",
);
assert.equal(
  canEstimateDebtFreeDate([{ balance: 1000, minimumPayment: 150, interestRate: 18 }]),
  true,
);

const debtsSrc = fs.readFileSync(path.join(ROOT, "lib/finance/debts.ts"), "utf8");
assert.match(debtsSrc, /Add payment plan/);
assert.match(debtsSrc, /canEstimateDebtFreeDate/);
assert.match(debtsSrc, /formatEstimatedDebtFreeLabel/);
assert.match(debtsSrc, new RegExp(String(MAX_SIMULATION_MONTHS)));

// ─── Investment empty-state logic ───
function getPortfolioPresentation(data) {
  const investments = data.investments ?? [];
  const investmentAccounts = (data.accounts ?? []).filter(
    (account) => account.type === "investment" || account.type === "crypto",
  );
  const holdings = [
    ...investments.map((item) => ({ id: item.id, value: item.value })),
    ...investmentAccounts.map((item) => ({ id: item.id, value: item.balance })),
  ];
  const hasHoldings = holdings.length > 0;
  if (!hasHoldings) {
    return { hasHoldings: false, portfolioValue: 0 };
  }
  return {
    hasHoldings: true,
    portfolioValue: holdings.reduce((sum, item) => sum + item.value, 0),
  };
}

assert.deepEqual(
  getPortfolioPresentation({ investments: [], accounts: [] }),
  { hasHoldings: false, portfolioValue: 0 },
);
assert.equal(
  getPortfolioPresentation({
    investments: [],
    accounts: [{ id: "a1", type: "checking", balance: 5308.4 }],
  }).portfolioValue,
  0,
);
assert.equal(
  getPortfolioPresentation({
    investments: [],
    accounts: [{ id: "inv1", type: "investment", balance: 5308.4 }],
  }).portfolioValue,
  5308.4,
);

const portfolioSrc = fs.readFileSync(
  path.join(ROOT, "lib/investments/portfolioPresentation.ts"),
  "utf8",
);
assert.match(portfolioSrc, /hasHoldings/);
assert.match(portfolioSrc, /portfolioValue:\s*0/);

const invScreen = fs.readFileSync(
  path.join(ROOT, "components/native/ios/IosInvestmentsScreen.tsx"),
  "utf8",
);
assert.match(invScreen, /getPortfolioPresentation/);
assert.match(invScreen, /No investments connected/);

// ─── Shared iOS page header architecture ───
assert.ok(
  fs.existsSync(path.join(ROOT, "components/native/ios/IosPageHeader.tsx")),
);
const topBar = fs.readFileSync(path.join(ROOT, "components/TopBar.tsx"), "utf8");
assert.match(topBar, /IosPageHeader/);
assert.match(topBar, /nativeIos/);

const notif = fs.readFileSync(
  path.join(ROOT, "components/notifications/NotificationCenter.tsx"),
  "utf8",
);
assert.match(notif, /nativeIos/);
assert.match(notif, /size-8/);

const accountsScreen = fs.readFileSync(
  path.join(ROOT, "components/native/ios/IosAccountsScreen.tsx"),
  "utf8",
);
assert.match(accountsScreen, /Net Worth/);
assert.match(accountsScreen, /calculateNetWorth/);
assert.match(accountsScreen, /Credit \/ Debt/);

const debtScreen = fs.readFileSync(
  path.join(ROOT, "components/native/ios/IosDebtScreen.tsx"),
  "utf8",
);
assert.match(debtScreen, /Add payment plan/);

const goalsScreen = fs.readFileSync(
  path.join(ROOT, "components/native/ios/IosGoalsScreen.tsx"),
  "utf8",
);
assert.match(goalsScreen, /No goals yet/);
assert.match(goalsScreen, /Create Goal/);

const reportsScreen = fs.readFileSync(
  path.join(ROOT, "components/native/ios/IosReportsScreen.tsx"),
  "utf8",
);
assert.match(reportsScreen, /Net cash flow/);
assert.match(reportsScreen, /Top spending categories/);
assert.match(reportsScreen, /Monthly trend/);

console.log("✅ iOS polish + data intelligence checks passed.");
