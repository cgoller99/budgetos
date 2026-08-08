#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const seedPath = path.join(ROOT, "lib/admin/seedAppReviewAccount.ts");
const routePath = path.join(ROOT, "app/api/admin/seed-app-review/route.ts");
const cliPath = path.join(ROOT, "scripts/seed-app-review-account.mjs");

const seed = fs.readFileSync(seedPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const cli = fs.readFileSync(cliPath, "utf8");

assert.match(seed, /APP_REVIEW_TARGET_EMAIL = "christiangoller11@gmail\.com"/);
assert.match(seed, /Refusing to seed/);
assert.match(seed, /Emergency Fund/);
assert.match(seed, /Vacation/);
assert.match(seed, /New Vehicle/);
assert.match(seed, /Phone/);
assert.match(seed, /Internet/);
assert.match(seed, /Car Insurance/);
assert.match(seed, /Streaming/);
assert.match(seed, /Utilities/);
assert.match(seed, /income_plan_allocations/);
assert.match(seed, /Visa Credit Card|Auto Loan/);
assert.match(seed, /buxme-app-review-seed/);
assert.match(seed, /subscriptionUnchanged/);
assert.match(seed, /Preserved .* investment/);
assert.doesNotMatch(seed, /subscription_plan:\s*["']/); // never assigns plan
assert.doesNotMatch(seed, /\.update\(\s*\{[^}]*subscription_/);

assert.match(route, /requireAdminApiUser/);
assert.match(route, /seedAppReviewAccount/);
assert.match(cli, /LOCKED_EMAIL = "christiangoller11@gmail\.com"/);
assert.match(cli, /SUPABASE_SERVICE_ROLE_KEY/);

console.log("✅ App Review seed safety checks passed.");
