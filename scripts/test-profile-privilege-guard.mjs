#!/usr/bin/env node
/**
 * Static checks for profile privilege guard migration + health probe wiring.
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
const HEALTH_RPC_MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/20260804_profile_privilege_guard_health.sql",
);
const HEALTH_MODULE_PATH = path.join(
  ROOT,
  "lib/supabase/profilePrivilegeGuardHealth.ts",
);
const RLS_HEALTH_PATH = path.join(ROOT, "lib/supabase/rlsHealthCheck.ts");

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
  assert(
    fs.existsSync(HEALTH_RPC_MIGRATION_PATH),
    `Missing health RPC migration: ${HEALTH_RPC_MIGRATION_PATH}`,
  );
  assert(
    fs.existsSync(HEALTH_MODULE_PATH),
    `Missing health module: ${HEALTH_MODULE_PATH}`,
  );

  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const healthRpcSql = fs.readFileSync(HEALTH_RPC_MIGRATION_PATH, "utf8");
  const healthModule = fs.readFileSync(HEALTH_MODULE_PATH, "utf8");
  const rlsHealth = fs.readFileSync(RLS_HEALTH_PATH, "utf8");

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

  assert(
    healthRpcSql.includes("profile_privilege_guard_active"),
    "Health RPC migration must define profile_privilege_guard_active()",
  );
  assert(
    healthRpcSql.includes("guard_profile_privileged_columns"),
    "Health RPC must look up guard_profile_privileged_columns on pg_trigger",
  );
  assert(
    healthRpcSql.includes("grant execute") &&
      healthRpcSql.includes("service_role"),
    "Health RPC must be executable by service_role only",
  );

  assert(
    healthModule.includes("checkProfilePrivilegeGuardHealth"),
    "Health module must export checkProfilePrivilegeGuardHealth",
  );
  assert(
    healthModule.includes("signInWithPassword"),
    "Health probe must authenticate as a normal user",
  );
  assert(
    healthModule.includes("subscription_plan") &&
      healthModule.includes("admin_founder_granted") &&
      healthModule.includes("beta_status") &&
      healthModule.includes("is_disabled"),
    "Health probe must attempt privileged column updates",
  );
  assert(
    healthModule.includes("npm run apply:profile-privilege-guard"),
    "Health probe must return the exact apply command when inactive",
  );
  assert(
    !healthModule.includes("DATABASE_URL") &&
      !healthModule.includes("SUPABASE_DB_PASSWORD"),
    "Health probe must never depend on exposing database credentials",
  );

  assert(
    rlsHealth.includes("checkProfilePrivilegeGuardHealth"),
    "Supabase RLS health must include the privilege guard probe",
  );
  assert(
    rlsHealth.includes("profilePrivilegeGuard"),
    "Supabase RLS health payload must expose profilePrivilegeGuard",
  );

  console.log("✅ Profile privilege guard migration checks passed.");
  console.log("  • trigger migration present");
  console.log("  • production health RPC migration present");
  console.log("  • behavioral health probe wired into /api/health/supabase");
}

main();
