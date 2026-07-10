#!/usr/bin/env node
/**
 * Verifies income annualization formulas used in production calculations.
 * Usage: node scripts/test-income-annualization.mjs
 */

function toMonthly(amount, frequency) {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
    case "every_2_weeks":
      return (amount * 26) / 12;
    case "twice_monthly":
      return amount * 2;
    case "quarterly":
      return amount / 3;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

const cases = [
  { amount: 1000, frequency: "weekly", expectedAnnual: 52000 },
  { amount: 2000, frequency: "every_2_weeks", expectedAnnual: 52000 },
  { amount: 2500, frequency: "twice_monthly", expectedAnnual: 60000 },
  { amount: 5000, frequency: "monthly", expectedAnnual: 60000 },
  { amount: 12000, frequency: "quarterly", expectedAnnual: 48000 },
  { amount: 60000, frequency: "yearly", expectedAnnual: 60000 },
];

let failed = 0;

for (const testCase of cases) {
  const annual = toMonthly(testCase.amount, testCase.frequency) * 12;
  const ok = Math.abs(annual - testCase.expectedAnnual) < 0.01;
  console.log(
    `${ok ? "✓" : "✗"} ${testCase.frequency} $${testCase.amount} → annual $${Math.round(annual)} (expected $${testCase.expectedAnnual})`,
  );
  if (!ok) failed += 1;
}

if (failed > 0) {
  process.exit(1);
}

console.log("\n✅ Income annualization checks passed.");
