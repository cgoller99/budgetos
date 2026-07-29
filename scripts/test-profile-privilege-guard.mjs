#!/usr/bin/env node
/**
 * Static checks for profile privilege guard migration.
 *
 * Usage: npm run test:profile-privilege-guard
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/20260730_profile_privilege_guard.sql",
);

const REQUIRED_PROTECTED_COLUMNS = [
  "subscription_plan",
  "subscription_status",
  "subscription_current_period_end",
  "stripe_customer_id",
  "stripe_subscription_id",
  "is_disabled",
  "admin_founder_granted",
  "beta_status",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  assert(fs.existsSync(MIGRATION_PATH), `Missing migration: ${MIGRATION_PATH}`);

  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  assert(
    sql.includes("guard_profile_privileged_columns"),
    "Migration must define guard_profile_privileged_columns trigger function",
  );

  assert(
    sql.includes("profile_privilege_escalation_blocked"),
    "Migration must block privileged profile column updates",
  );

  assert(
    sql.includes("profile_household_escalation_blocked"),
    "Migration must validate household_id changes",
  );

  assert(
    sql.includes("ALTER COLUMN beta_status SET DEFAULT 'pending'"),
    "Migration must default beta_status to pending",
  );

  for (const column of REQUIRED_PROTECTED_COLUMNS) {
    assert(
      sql.includes(column),
      `Migration must reference protected column: ${column}`,
    );
  }

  assert(
    sql.includes("auth.role()") && sql.includes("service_role"),
    "Migration must allow service_role bypass for trusted server updates",
  );

  console.log("✅ Profile privilege guard migration checks passed.");
}

main();
