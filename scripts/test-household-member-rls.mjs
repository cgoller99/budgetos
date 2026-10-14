#!/usr/bin/env node
/**
 * A signed-in user must not be able to insert a household_members row for
 * a household they do not own. Invite acceptance stays on the security
 * definer function.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const fix = read("supabase/migrations/20261014_household_member_insert.sql");
assert.match(fix, /drop policy if exists "Household members insertable by owner"/);
assert.match(fix, /auth\.uid\(\) = user_id/);
assert.match(fix, /owner_id = auth\.uid\(\)/);
assert.doesNotMatch(
  fix,
  /or user_id = auth\.uid\(\)/,
  "self-insert into any household must not be reintroduced",
);

const rebuild = read("app/api/cron/finance-rebuild/route.ts");
assert.doesNotMatch(rebuild, /x-vercel-cron/);
assert.match(rebuild, /Bearer \$\{cronSecret\}/);

const reset = read("lib/admin/factoryResetService.ts");
assert.match(reset, /"category_budgets"/);

console.log("household member insert policy checks passed");
