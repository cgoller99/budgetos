#!/usr/bin/env node
/**
 * Coordinated native iPhone UI overhaul — structural checks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const gate = read("components/onboarding/OnboardingGate.tsx");
assert.match(gate, /onboardingHydrated/);
assert.match(gate, /!isLoading && onboardingHydrated && !onboardingComplete/);

const finance = read("context/FinanceContext.tsx");
assert.match(finance, /onboardingHydrated/);
assert.match(finance, /setOnboardingHydrated\(true\)/);
assert.match(finance, /setOnboardingHydrated\(false\)/);

const layout = read("components/AppLayout.tsx");
assert.match(layout, /!nativeIos/);
assert.match(layout, /Sidebar/);

const bills = read("components/native/ios/IosBillsScreen.tsx");
assert.match(bills, /data-bill-detail-footer/);
assert.match(bills, /footer=\{/);
assert.doesNotMatch(bills, /min-h-8/);

const debt = read("components/debt/DebtPayoffPlanner.tsx");
assert.match(debt, /data-debt-payoff-footer/);
assert.doesNotMatch(debt, /sticky bottom-0/);

const reports = read("components/native/ios/IosReportsScreen.tsx");
assert.doesNotMatch(reports, /IosBudgetsSection/);

const editors = [
  "components/bills/AddBillModal.tsx",
  "components/accounts/AddAccountModal.tsx",
  "components/accounts/EditAccountModal.tsx",
  "components/transactions/AddTransactionModal.tsx",
  "components/transactions/EditTransactionModal.tsx",
  "components/debt/AddDebtModal.tsx",
  "components/debt/EditDebtModal.tsx",
  "components/debt/MakePaymentModal.tsx",
  "components/goals/CreateGoalModal.tsx",
  "components/goals/EditGoalModal.tsx",
  "components/goals/AddMoneyModal.tsx",
  "components/bills/PayBillSplitModal.tsx",
];

for (const file of editors) {
  const source = read(file);
  assert.match(source, /footer=\{/, `${file} missing Modal footer`);
  assert.doesNotMatch(source, /flex gap-3 pt-2/, `${file} still has in-scroll actions`);
  assert.doesNotMatch(source, /sticky bottom-0/, `${file} sticky footer`);
}

const insights = read("components/insights/InsightsContent.tsx");
assert.match(insights, /IosEmptyState/);
assert.match(insights, /IosList/);

const accounts = read("components/native/ios/IosAccountsScreen.tsx");
assert.match(accounts, /data-accounts-summary-strip/);
assert.match(accounts, /IosEmptyState/);

console.log("✅ Native UI complete overhaul checks passed.");
