#!/usr/bin/env node
/**
 * Stage 2: allocation summary must match per-line resolve rounding (no 1¢ drift).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = "/tmp/allocation-summary-precision-test.mjs";

execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "--yes",
    "esbuild",
    path.join(ROOT, "lib/allocation/allocationEngine.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${OUT}`,
    `--alias:@=${ROOT}`,
  ],
  { stdio: "inherit", cwd: ROOT },
);

const {
  resolveAllocations,
  getAllocationSummaryFromPlan,
} = await import(pathToFileURL(OUT).href);

const allocations = [
  {
    id: "a",
    name: "A",
    icon: "A",
    amount: null,
    percentage: 33.33,
    allocationType: "percentage",
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
    id: "b",
    name: "B",
    icon: "B",
    amount: null,
    percentage: 33.33,
    allocationType: "percentage",
    isRemainingBalance: false,
    accountId: null,
    goalId: null,
    billId: null,
    debtId: null,
    investmentId: null,
    monthlyTarget: null,
    contributionFrequency: null,
    sortOrder: 1,
  },
  {
    id: "rest",
    name: "Rest",
    icon: "R",
    amount: null,
    percentage: null,
    allocationType: "remaining",
    isRemainingBalance: true,
    accountId: null,
    goalId: null,
    billId: null,
    debtId: null,
    investmentId: null,
    monthlyTarget: null,
    contributionFrequency: null,
    sortOrder: 2,
  },
];

const plan = { paycheckAmount: 10, allocations };
const resolved = resolveAllocations(plan);
const percentageSum = resolved
  .filter((item) => item.allocation.id === "a" || item.allocation.id === "b")
  .reduce((total, item) => total + item.amount, 0);
const summary = getAllocationSummaryFromPlan(10, allocations);

assert.equal(percentageSum, 6.66);
assert.equal(
  summary.percentageAllocated,
  percentageSum,
  "summary percentage total must match per-line resolve rounding",
);
assert.equal(summary.allocated, 6.66);
assert.equal(summary.remaining, 3.34);

console.log("✅ Allocation summary precision checks passed.");
