#!/usr/bin/env node
/**
 * Stage 2: Income Plan Apply must not double-count an existing Plaid deposit.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = "/tmp/paycheck-source-link-test.mjs";

execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "--yes",
    "esbuild",
    path.join(ROOT, "lib/allocation/paycheckEngine.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${OUT}`,
    `--alias:@=${ROOT}`,
  ],
  { stdio: "inherit", cwd: ROOT },
);

const { executePaycheckAllocations } = await import(pathToFileURL(OUT).href);

function baseData(overrides = {}) {
  return {
    accounts: [
      {
        id: "acct-checking",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 2000,
        monthlyChange: 0,
        includeInNetWorth: true,
        includeInSafeToSpend: true,
        isHidden: false,
      },
    ],
    debts: [],
    bills: [],
    income: [],
    savingsGoals: [],
    investments: [],
    transactions: [
      {
        id: "txn-plaid-pay",
        amount: 1600,
        type: "income",
        category: "Payroll",
        accountId: "acct-checking",
        transferAccountId: null,
        date: "2026-10-01",
        notes: "ACME PAYROLL",
        goalId: null,
        billId: null,
        debtId: null,
      },
    ],
    events: [],
    incomePlan: {
      id: "plan-1",
      paySchedule: "biweekly",
      paycheckAmount: 1600,
      anchorDate: "2026-10-01",
      weeklyDayOfWeek: null,
      monthlyDays: [],
      customIntervalDays: null,
      depositAccountId: "acct-checking",
      nextPayDate: "2026-10-01",
      lastProcessedDate: null,
      isActive: true,
      allocations: [
        {
          id: "alloc-bills",
          name: "Bills",
          icon: "💳",
          amount: 400,
          percentage: null,
          allocationType: null,
          isRemainingBalance: false,
          accountId: null,
          goalId: null,
          billId: null,
          debtId: null,
          investmentId: null,
          monthlyTarget: null,
          contributionFrequency: null,
          sortOrder: 0,
        },
        {
          id: "alloc-rest",
          name: "Available",
          icon: "✨",
          amount: null,
          percentage: null,
          allocationType: null,
          isRemainingBalance: true,
          accountId: null,
          goalId: null,
          billId: null,
          debtId: null,
          investmentId: null,
          monthlyTarget: null,
          contributionFrequency: null,
          sortOrder: 1,
        },
      ],
    },
    incomePlanPaychecks: [],
    envelopeBalances: [],
    allocationLedger: [],
    bankConnections: [],
    plaidRecurringDismissals: [],
    viewerUserId: "user-1",
    householdId: null,
    ...overrides,
  };
}

const plan = baseData().incomePlan;

// Manual / cron path still creates a synthetic income transaction.
const manual = executePaycheckAllocations(baseData({ transactions: [] }), plan, {});
assert.equal(
  manual.data.transactions.filter((t) => t.type === "income").length,
  1,
  "manual apply creates one income transaction",
);
assert.match(
  manual.data.transactions[0].notes ?? "",
  /Income Plan paycheck received/,
);

// Automation path with sourceTransactionId must reuse the Plaid deposit.
const linked = executePaycheckAllocations(baseData(), plan, {
  sourceTransactionId: "txn-plaid-pay",
});
const incomeRows = linked.data.transactions.filter((t) => t.type === "income");
assert.equal(incomeRows.length, 1, "linked apply must not add a second income row");
assert.equal(incomeRows[0].id, "txn-plaid-pay");
assert.equal(
  linked.paycheckEvent.incomeTransactionId,
  "txn-plaid-pay",
  "paycheck event must point at the source deposit",
);
assert.equal(
  linked.data.accounts[0].balance,
  2000,
  "linked apply must not re-credit the checking balance",
);

console.log("✅ Paycheck source-link checks passed.");
