/**
 * Payroll income detection tests.
 *
 * Usage: node scripts/test-payroll-income.mjs
 */

function toMonthly(amount, frequency) {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "every_2_weeks":
      return (amount * 26) / 12;
    default:
      return amount;
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

const quickbooksDeposits = [1073.38, 955.38, 1058.38, 1019.05, 941.4, 1043.38, 1029.37, 970.39, 941.41];
const typical = median(quickbooksDeposits);
const monthly = toMonthly(typical, "weekly");

console.log(`median paycheck: ${typical.toFixed(2)}`);
console.log(`monthly (weekly schedule): ${monthly.toFixed(2)}`);

if (monthly <= 3623.59) {
  console.error("Expected payroll estimate above stale ledger average");
  process.exit(1);
}

if (monthly >= 4983.33) {
  console.error("Expected payroll estimate below misconfigured income plan");
  process.exit(1);
}

console.log("payroll income tests passed");
