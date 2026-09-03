#!/usr/bin/env node
/**
 * Static checks for admin account-reset wiring.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const factory = read("lib/admin/factoryResetService.ts");
const dashboard = read("components/admin/AdminDashboard.tsx");
const userService = read("lib/admin/userService.ts");
const script = read("scripts/reset-user-account.mjs");
const pkg = read("package.json");

assert.match(factory, /factoryResetUserFinance/);
assert.match(factory, /household_members/);
assert.match(factory, /user_release_views/);
assert.match(factory, /onboarding_complete:\s*false/);
assert.match(factory, /household_id:\s*null/);

assert.match(userService, /case "reset_finance"/);
assert.match(dashboard, /\["reset_finance", "Reset account"\]/);
assert.match(dashboard, /Email and password are kept/);

assert.match(script, /--email/);
assert.match(script, /dry-run/);
assert.match(pkg, /"reset:user-account"/);

console.log("✅ Admin account reset checks passed.");
