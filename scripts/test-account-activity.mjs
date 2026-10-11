#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { monthlyAccountActivity } from "../lib/finance/accountActivity.ts";

const today = new Date(2026, 9, 11);
const points = monthlyAccountActivity(
  [
    { date: "2026-10-02", amount: 100, type: "income", accountId: "checking" },
    { date: "2026-10-03", amount: 40, type: "expense", accountId: "checking" },
    {
      date: "2026-09-15",
      amount: 25,
      type: "transfer",
      accountId: "checking",
      transferAccountId: "savings",
    },
    {
      date: "2026-08-01",
      amount: 10,
      type: "transfer",
      accountId: "savings",
      transferAccountId: "checking",
    },
    { date: "2026-01-01", amount: 999, type: "income", accountId: "checking" },
  ],
  "checking",
  6,
  today,
);

assert.equal(points.length, 6);
assert.equal(points.at(-1), 60);
assert.equal(points.at(-2), -25);
assert.equal(points.at(-3), 10);
assert.equal(points[0], 0);

const screen = fs.readFileSync(
  path.join(import.meta.dirname, "../components/native/ios/IosAccountsScreen.tsx"),
  "utf8",
);
assert.match(screen, /IosAccountDetailSheet/);
assert.match(screen, /Net Worth/);
assert.match(screen, /Credit \/ Debt/);
assert.match(screen, /monthlyAccountActivity/);

console.log("✅ Account activity checks passed.");
