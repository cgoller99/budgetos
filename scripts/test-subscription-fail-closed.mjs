#!/usr/bin/env node
/**
 * Stage 2: useSubscription must fail closed outside SubscriptionProvider.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(
  path.join(root, "context/SubscriptionContext.tsx"),
  "utf8",
);

assert.match(source, /Fail closed outside SubscriptionProvider/);
assert.match(source, /hasProAccess: false/);
assert.match(source, /hasProPlusAccess: false/);
assert.match(source, /hasMinimumPlan: \(plan\) => plan === "free"/);
assert.doesNotMatch(
  source,
  /if \(!context\) \{[\s\S]*hasProAccess: true/,
);

console.log("✅ Subscription fail-closed checks passed.");
