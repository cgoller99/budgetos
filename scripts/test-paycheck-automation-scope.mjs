#!/usr/bin/env node
/**
 * Paycheck automation is not a stored customer setting.
 * Active income plans used to allocate on the due date. That was implicit.
 * There is no column or setup control that records an opt-in, so stopping
 * the scheduled apply does not overwrite a saved preference.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const schema = read("supabase/migrations/20260703_income_plans.sql");
assert.match(schema, /is_active boolean not null default true/);
assert.doesNotMatch(schema, /auto_apply|apply_automatically|automatic_payday/i);

const laterMigrations = fs
  .readdirSync(path.join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"));
for (const name of laterMigrations) {
  const sql = read(path.join("supabase/migrations", name));
  assert.doesNotMatch(
    sql,
    /alter table public\.income_plans[\s\S]{0,200}auto_apply/i,
    `${name} must not add a hidden payday opt-in`,
  );
}

const cron = read("lib/cron/paycheckCronService.ts");
assert.doesNotMatch(cron, /markIncomePlanPaycheckReceived/);
assert.match(cron, /is_active/);

const context = read("context/FinanceContext.tsx");
assert.doesNotMatch(context, /Paycheck plan applied/);
assert.doesNotMatch(context, /markIncomePlanAutoRun/);
assert.doesNotMatch(context, /isIncomePlanPaycheckDue/);

const scheduler = read("lib/finance/autoScheduler.ts");
assert.match(scheduler, /buxme-last-auto-paycheck/);
assert.doesNotMatch(scheduler, /autoApply|automaticPayday/);

const setup = read("components/incomePlan/IncomePlanContent.tsx");
assert.doesNotMatch(setup, /automatic payday|apply automatically|auto-apply/i);

console.log("paycheck automation scope ok");
