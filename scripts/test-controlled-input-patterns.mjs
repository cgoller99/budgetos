#!/usr/bin/env node
/**
 * Stage 2: Controlled-input / focus architectural patterns.
 * Ensures Modal keeps onClose in a ref, and finance form modals keep local draft state.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const modal = read("components/ui/Modal.tsx");
assert.match(modal, /onCloseRef/);
assert.match(modal, /onCloseRef\.current = onClose/);
assert.doesNotMatch(
  modal,
  /useEffect\(\(\) => \{[\s\S]*previouslyFocused[\s\S]*\}, \[isOpen, isMounted, onClose\]\)/,
);

const formModals = [
  "components/bills/AddBillModal.tsx",
  "components/bills/EditBillModal.tsx",
  "components/transactions/AddTransactionModal.tsx",
  "components/transactions/EditTransactionModal.tsx",
  "components/income/AddIncomeModal.tsx",
  "components/income/EditIncomeModal.tsx",
  "components/debt/AddDebtModal.tsx",
  "components/debt/EditDebtModal.tsx",
  "components/goals/CreateGoalModal.tsx",
  "components/goals/EditGoalModal.tsx",
  "components/goals/AddMoneyModal.tsx",
  "components/accounts/AddAccountModal.tsx",
  "components/accounts/EditAccountModal.tsx",
];

for (const file of formModals) {
  const source = read(file);
  assert.match(source, /useState/, `${file} should keep local form state`);
  assert.match(source, /<Modal/, `${file} should use shared Modal`);
  // Editing should not key the whole modal on every keystroke value.
  assert.doesNotMatch(
    source,
    /key=\{form\./,
    `${file} must not remount Modal from form field values`,
  );
}

// Income Plan keeps draft state locally rather than writing FinanceContext on each keystroke.
const incomePlan = read("components/incomePlan/IncomePlanContent.tsx");
assert.match(incomePlan, /useState/);
assert.match(incomePlan, /allocations/);

// Search keeps local query string.
const search = read("components/search/GlobalSearch.tsx");
assert.match(search, /useState/);
assert.match(search, /query/);

console.log("✅ Controlled-input pattern checks passed.");
