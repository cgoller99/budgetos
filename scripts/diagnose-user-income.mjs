#!/usr/bin/env node
/**
 * Diagnose personal annual income for a user (service role required).
 *
 * Usage:
 *   npm run diagnose:income -- --email brother@example.com
 *   npm run diagnose:income -- --user-id <uuid>
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalizeFrequency(frequency) {
  if (frequency === "biweekly") return "every_2_weeks";
  return frequency ?? "monthly";
}

function toMonthlyAmount(amount, frequency) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (normalizeFrequency(frequency)) {
    case "weekly":
      return (amount * 52) / 12;
    case "every_2_weeks":
      return (amount * 26) / 12;
    case "twice_monthly":
      return amount * 2;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

function isActive(row) {
  return row.schedule_status !== "paused";
}

function dedupeKey(source) {
  return [
    source.user_id,
    source.name.trim().toLowerCase(),
    normalizeFrequency(source.frequency),
    Math.round(Number(source.amount) * 100),
  ].join("|");
}

async function resolveHouseholdId(supabase, userId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.household_id) return profile.household_id;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return membership?.household_id ?? null;
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const email = getArg("email");
  const userIdArg = getArg("user-id");

  if (!email && !userIdArg) {
    console.error("Provide --email or --user-id.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = userIdArg;
  let userEmail = email;

  if (!userId && email) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!match) {
      console.error(`No auth user found for email: ${email}`);
      process.exit(1);
    }
    userId = match.id;
    userEmail = match.email ?? email;
  } else if (userId) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;
    userEmail = data.user?.email ?? null;
  }

  const householdId = await resolveHouseholdId(supabase, userId);
  const scopeFilter = householdId
    ? `user_id.eq.${userId},household_id.eq.${householdId}`
    : null;

  let incomeQuery = supabase
    .from("transactions")
    .select(
      "id, user_id, name, amount, frequency, schedule_status, transaction_type, household_id",
    )
    .eq("transaction_type", "income")
    .not("frequency", "is", null);

  if (scopeFilter) {
    incomeQuery = incomeQuery.or(scopeFilter);
  } else {
    incomeQuery = incomeQuery.eq("user_id", userId);
  }

  const [{ data: profile }, { data: recurringIncome }, { data: incomePlan }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, household_id")
        .eq("id", userId)
        .maybeSingle(),
      incomeQuery,
      supabase
        .from("income_plans")
        .select(
          "id, user_id, pay_schedule, paycheck_amount, is_active, household_id",
        )
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

  const rawSources = recurringIncome ?? [];
  const personalSources = rawSources.filter((row) => row.user_id === userId);
  const householdExcluded = rawSources.filter((row) => row.user_id !== userId);

  const kept = new Map();
  const duplicateExcluded = [];

  for (const row of personalSources) {
    const key = dedupeKey(row);
    if (!kept.has(key)) {
      kept.set(key, row);
      continue;
    }
    duplicateExcluded.push(row);
  }

  const includedSources = [...kept.values()];
  let monthlyIncome = 0;
  const streams = [];

  for (const row of includedSources) {
    const active = isActive(row);
    const monthly = active ? toMonthlyAmount(Number(row.amount), row.frequency) : 0;
    if (active) monthlyIncome += monthly;
    streams.push({
      id: row.id,
      name: row.name,
      source: "manual_recurring",
      frequency: row.frequency,
      perPeriodAmount: round(Number(row.amount)),
      monthlyAmount: round(monthly),
      annualAmount: round(monthly * 12),
      included: active,
      exclusionReason: active ? null : "Paused income source",
      ownerUserId: row.user_id,
    });
  }

  for (const row of householdExcluded) {
    streams.push({
      id: row.id,
      name: row.name,
      source: "manual_recurring",
      frequency: row.frequency,
      perPeriodAmount: round(Number(row.amount)),
      monthlyAmount: 0,
      annualAmount: 0,
      included: false,
      exclusionReason: "Household member income excluded from personal total",
      ownerUserId: row.user_id,
    });
  }

  for (const row of duplicateExcluded) {
    streams.push({
      id: row.id,
      name: row.name,
      source: "manual_recurring",
      frequency: row.frequency,
      perPeriodAmount: round(Number(row.amount)),
      monthlyAmount: 0,
      annualAmount: 0,
      included: false,
      exclusionReason: "Duplicate income stream removed",
      ownerUserId: row.user_id,
    });
  }

  if (incomePlan && incomePlan.user_id === userId && incomePlan.is_active) {
    const monthly = toMonthlyAmount(
      Number(incomePlan.paycheck_amount),
      incomePlan.pay_schedule,
    );
    monthlyIncome += monthly;
    streams.push({
      id: incomePlan.id,
      name: "Paycheck (Income Plan)",
      source: "income_plan",
      frequency: incomePlan.pay_schedule,
      perPeriodAmount: round(Number(incomePlan.paycheck_amount)),
      monthlyAmount: round(monthly),
      annualAmount: round(monthly * 12),
      included: true,
      exclusionReason: null,
      ownerUserId: incomePlan.user_id,
    });
  }

  let householdPlanExcluded = null;
  if (householdId) {
    const { data: householdPlans } = await supabase
      .from("income_plans")
      .select("id, user_id, pay_schedule, paycheck_amount, is_active")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .neq("user_id", userId);

    for (const plan of householdPlans ?? []) {
      householdPlanExcluded = plan;
      streams.push({
        id: plan.id,
        name: "Paycheck (Income Plan)",
        source: "income_plan",
        frequency: plan.pay_schedule,
        perPeriodAmount: round(Number(plan.paycheck_amount)),
        monthlyAmount: 0,
        annualAmount: 0,
        included: false,
        exclusionReason: "Another household member's income plan excluded",
        ownerUserId: plan.user_id,
      });
    }
  }

  const monthlyBeforeFix = rawSources
    .filter((row) => isActive(row))
    .reduce(
      (total, row) => total + toMonthlyAmount(Number(row.amount), row.frequency),
      0,
    );

  console.log(
    JSON.stringify(
      {
        userId,
        email: userEmail,
        fullName: profile?.full_name ?? null,
        householdId,
        householdMemberIncomeRowsExcluded: householdExcluded.length,
        householdPlanExcluded: householdPlanExcluded
          ? {
              ownerUserId: householdPlanExcluded.user_id,
              paySchedule: householdPlanExcluded.pay_schedule,
              paycheckAmount: round(Number(householdPlanExcluded.paycheck_amount)),
            }
          : null,
        monthlyIncomeBeforePersonalScopeFix: round(monthlyBeforeFix),
        monthlyIncomeAfterPersonalScopeFix: round(monthlyIncome),
        annualIncomeAfterFix: round(monthlyIncome * 12),
        activeStreamCount: streams.filter((stream) => stream.included).length,
        streams,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
