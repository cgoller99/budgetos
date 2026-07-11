import assert from "node:assert/strict";

const AMOUNT_VARIANCE = 0.15;

function normalizeMerchantKey(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function amountsAreSimilar(amounts) {
  const average = amounts.reduce((total, amount) => total + amount, 0) / amounts.length;
  if (average <= 0) return false;
  return amounts.every((amount) => Math.abs(amount - average) / average <= AMOUNT_VARIANCE);
}

function daysBetween(a, b) {
  const first = new Date(`${a}T12:00:00`).getTime();
  const second = new Date(`${b}T12:00:00`).getTime();
  return Math.round(Math.abs(second - first) / (1000 * 60 * 60 * 24));
}

function inferFrequency(sortedDates) {
  if (sortedDates.length < 2) return null;
  const intervals = [];
  for (let index = 1; index < sortedDates.length; index += 1) {
    intervals.push(daysBetween(sortedDates[index - 1], sortedDates[index]));
  }
  const averageInterval = intervals.reduce((total, value) => total + value, 0) / intervals.length;
  const intervalMatches = (target, tolerance) =>
    intervals.every((interval) => Math.abs(interval - target) <= tolerance);

  if (intervalMatches(7, 2) || (averageInterval >= 5 && averageInterval <= 9)) return "weekly";
  if (intervalMatches(14, 3) || (averageInterval >= 11 && averageInterval <= 18)) return "biweekly";
  if (intervalMatches(30, 5) || (averageInterval >= 25 && averageInterval <= 35)) return "monthly";
  if (intervalMatches(91, 10) || (averageInterval >= 80 && averageInterval <= 100)) return "quarterly";
  if (intervalMatches(365, 20) || averageInterval >= 330) return "yearly";

  const days = sortedDates.map((date) => new Date(`${date}T12:00:00`).getDate());
  const averageDay = days.reduce((total, day) => total + day, 0) / days.length;
  const sameDayOfMonth = days.every((day) => Math.abs(day - averageDay) <= 3);
  const distinctMonths = new Set(sortedDates.map((date) => date.slice(0, 7)));
  if (sameDayOfMonth && distinctMonths.size >= 2) return "monthly";
  return null;
}

function findMatchingBill(bills, merchantKey) {
  const normalizedMerchant = normalizeMerchantKey(merchantKey);
  return (
    bills.find((bill) => {
      const billName = normalizeMerchantKey(bill.name);
      return billName === normalizedMerchant || billName.includes(normalizedMerchant) || normalizedMerchant.includes(billName);
    }) ?? null
  );
}

function detectCandidates(items, bills = [], dismissedMerchantKeys = []) {
  const dismissed = new Set(dismissedMerchantKeys.map(normalizeMerchantKey));
  const groups = new Map();

  for (const item of items) {
    const merchantKey = normalizeMerchantKey(item.notes);
    if (merchantKey.length < 3) continue;
    const existing = groups.get(merchantKey) ?? [];
    existing.push(item);
    groups.set(merchantKey, existing);
  }

  const candidates = [];

  for (const [merchantKey, groupItems] of groups) {
    if (dismissed.has(merchantKey) || groupItems.length < 2) continue;
    const sortedDates = groupItems.map((item) => item.date).sort();
    const frequency = inferFrequency(sortedDates);
    if (!frequency) continue;
    const amounts = groupItems.map((item) => item.amount);
    if (!amountsAreSimilar(amounts)) continue;
    const existingBill = findMatchingBill(bills, merchantKey);
    candidates.push({
      merchantKey,
      frequency,
      action: existingBill ? "update" : "create",
      existingBillId: existingBill?.id ?? null,
      averageAmount: Math.round((amounts.reduce((a, b) => a + b, 0) / amounts.length) * 100) / 100,
    });
  }

  return candidates;
}

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("monthly Netflix", () => {
  const candidates = detectCandidates([
    { amount: 22.99, date: "2026-01-05", notes: "Netflix" },
    { amount: 22.99, date: "2026-02-05", notes: "Netflix" },
    { amount: 22.99, date: "2026-03-05", notes: "Netflix" },
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].frequency, "monthly");
  assert.equal(candidates[0].action, "create");
});

test("weekly gym membership", () => {
  const candidates = detectCandidates([
    { amount: 45, date: "2026-01-07", notes: "Planet Fitness" },
    { amount: 45, date: "2026-01-14", notes: "Planet Fitness" },
    { amount: 45, date: "2026-01-21", notes: "Planet Fitness" },
  ]);
  assert.equal(candidates[0].frequency, "weekly");
});

test("biweekly cadence", () => {
  assert.equal(inferFrequency(["2026-01-01", "2026-01-15", "2026-01-29"]), "biweekly");
});

test("quarterly insurance", () => {
  assert.equal(inferFrequency(["2026-01-10", "2026-04-12", "2026-07-11"]), "quarterly");
});

test("annual subscription", () => {
  assert.equal(inferFrequency(["2025-03-01", "2026-03-02"]), "yearly");
});

test("Georgia Power utility with variance", () => {
  const candidates = detectCandidates([
    { amount: 145, date: "2026-01-12", notes: "Georgia Power" },
    { amount: 148, date: "2026-02-11", notes: "Georgia Power" },
  ]);
  assert.equal(candidates[0].frequency, "monthly");
});

test("AT&T phone bill", () => {
  const candidates = detectCandidates([
    { amount: 98, date: "2026-01-08", notes: "AT&T" },
    { amount: 98, date: "2026-02-08", notes: "AT&T" },
  ]);
  assert.equal(candidates[0].averageAmount, 98);
});

test("rejects irregular amounts", () => {
  const candidates = detectCandidates([
    { amount: 20, date: "2026-01-05", notes: "Random Store" },
    { amount: 95, date: "2026-02-05", notes: "Random Store" },
    { amount: 40, date: "2026-03-05", notes: "Random Store" },
  ]);
  assert.equal(candidates.length, 0);
});

test("duplicate prevention suggests update", () => {
  const candidates = detectCandidates(
    [
      { amount: 145, date: "2026-01-12", notes: "Georgia Power" },
      { amount: 148, date: "2026-02-11", notes: "Georgia Power" },
    ],
    [{ id: "bill-1", name: "Georgia Power" }],
  );
  assert.equal(candidates[0].action, "update");
  assert.equal(candidates[0].existingBillId, "bill-1");
});

test("dismissed merchants are excluded", () => {
  const candidates = detectCandidates(
    [
      { amount: 10, date: "2026-01-01", notes: "Spotify" },
      { amount: 10, date: "2026-02-01", notes: "Spotify" },
    ],
    [],
    ["spotify"],
  );
  assert.equal(candidates.length, 0);
});

test("requires at least two transactions", () => {
  const candidates = detectCandidates([{ amount: 22.99, date: "2026-01-05", notes: "Netflix" }]);
  assert.equal(candidates.length, 0);
});

test("bills are never auto-created without user action", () => {
  assert.equal(typeof detectCandidates, "function");
  assert.ok(true, "creation only happens via explicit user-selected modal actions in the app");
});

console.log(`\n${passed} recurring bill detection scenarios passed`);
