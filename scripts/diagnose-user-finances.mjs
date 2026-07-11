#!/usr/bin/env node
/**
 * End-to-end finance pipeline audit for a user (service role + Plaid required).
 *
 * Usage:
 *   node --env-file=.env.local scripts/diagnose-user-finances.mjs --email user@example.com
 *   node --env-file=.env.local scripts/diagnose-user-finances.mjs --email user@example.com --sync
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import crypto from "node:crypto";

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

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

const CASH_TYPES = new Set(["checking", "savings", "cash"]);
const INVESTMENT_TYPES = new Set(["investment", "crypto"]);

function decryptToken(connection, encryptionKey) {
  const iv = Buffer.from(connection.access_token_iv, "base64");
  const tag = Buffer.from(connection.access_token_tag, "base64");
  const ciphertext = Buffer.from(connection.access_token_encrypted, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "base64"),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function toMonthlyAmount(amount, frequency) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "every_2_weeks":
    case "biweekly":
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

function findDuplicates(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, count: group.length, items: group }));
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
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || fileEnv.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const plaidClientId = process.env.PLAID_CLIENT_ID ?? fileEnv.PLAID_CLIENT_ID;
  const plaidSecret = process.env.PLAID_SECRET ?? fileEnv.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV ?? fileEnv.PLAID_ENV ?? "production";
  const encryptionKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY ?? fileEnv.PLAID_TOKEN_ENCRYPTION_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Missing Supabase credentials.");
    process.exit(1);
  }

  const email = getArg("email");
  const shouldSync = process.argv.includes("--sync");
  if (!email) {
    console.error("Provide --email.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;
  const user = usersData.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No user for ${email}`);
    process.exit(1);
  }
  const userId = user.id;

  const householdId = await resolveHouseholdId(supabase, userId);
  const scopeFilter = householdId ? `user_id.eq.${userId},household_id.eq.${householdId}` : null;

  const loadScoped = async (table, select) => {
    let query = supabase.from(table).select(select);
    if (scopeFilter) query = query.or(scopeFilter);
    else query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  };

  const [accounts, investments, transactions, bills, connections, incomePlan] =
    await Promise.all([
      loadScoped("accounts", "*"),
      loadScoped("investments", "*"),
      loadScoped(
        "transactions",
        "id, user_id, name, amount, frequency, transaction_type, transaction_date, account_id, external_transaction_id, category, notes, schedule_status, household_id",
      ),
      loadScoped("bills", "id, name, amount, bill_frequency, recurring, user_id, household_id"),
      supabase.from("bank_connections").select("*").eq("user_id", userId),
      supabase
        .from("income_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  const recurringIncome = transactions.filter(
    (row) => row.transaction_type === "income" && row.frequency != null,
  );
  const ledgerTransactions = transactions.filter(
    (row) =>
      row.transaction_type === "income" ||
      row.transaction_type === "expense" ||
      row.transaction_type === "transfer",
  );

  const visibleAccounts = accounts.filter((row) => !row.is_hidden && !row.archived_at);
  const cashAccounts = visibleAccounts.filter(
    (row) => row.record_kind === "account" && CASH_TYPES.has(row.type) && row.include_in_net_worth !== false,
  );
  const creditInAccounts = visibleAccounts.filter(
    (row) => row.record_kind === "account" && row.type === "credit_card",
  );
  const debts = visibleAccounts.filter((row) => row.record_kind === "debt");
  const legacyInvestmentAccounts = visibleAccounts.filter((row) => row.record_kind === "investment");
  const investmentPortfolioAccounts = visibleAccounts.filter(
    (row) => row.record_kind === "account" && INVESTMENT_TYPES.has(row.type),
  );

  const dbCash = sum(cashAccounts.map((row) => Number(row.balance)));
  const dbDebtFromDebts = sum(debts.map((row) => Number(row.balance)));
  const dbDebtFromCreditAccounts = sum(creditInAccounts.map((row) => Number(row.balance)));
  const dbInvestmentsTable = sum(investments.map((row) => Number(row.value)));
  const dbLegacyInvestments = sum(legacyInvestmentAccounts.map((row) => Number(row.balance)));
  const dbInvestmentAccounts = sum(investmentPortfolioAccounts.map((row) => Number(row.balance)));

  const engineInvestments =
    investments.length > 0 ? dbInvestmentsTable : dbLegacyInvestments;
  const engineInvestmentAccounts = dbInvestmentAccounts;
  const totalInvestmentsDisplayed = engineInvestments + engineInvestmentAccounts;

  const totalDebtDisplayed = dbDebtFromDebts + dbDebtFromCreditAccounts;
  const netWorthDisplayed = dbCash + totalInvestmentsDisplayed - totalDebtDisplayed;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLedger = ledgerTransactions.filter((row) =>
    (row.transaction_date ?? "").startsWith(monthKey),
  );
  const monthExpenses = sum(
    monthLedger.filter((row) => row.transaction_type === "expense").map((row) => Number(row.amount)),
  );
  const monthIncomeLedger = sum(
    monthLedger.filter((row) => row.transaction_type === "income").map((row) => Number(row.amount)),
  );
  const monthTransfers = sum(
    monthLedger.filter((row) => row.transaction_type === "transfer").map((row) => Number(row.amount)),
  );

  const personalRecurring = recurringIncome.filter((row) => row.user_id === userId);
  const recurringMonthly = sum(
    personalRecurring
      .filter((row) => row.schedule_status !== "paused")
      .map((row) => toMonthlyAmount(Number(row.amount), row.frequency)),
  );
  const planMonthly =
    incomePlan.data && incomePlan.data.is_active
      ? toMonthlyAmount(Number(incomePlan.data.paycheck_amount), incomePlan.data.pay_schedule)
      : 0;
  const dashboardIncome =
    personalRecurring.filter((row) => row.schedule_status !== "paused").length > 0
      ? recurringMonthly
      : monthIncomeLedger;
  const dashboardIncomeWithPlan = dashboardIncome + (personalRecurring.length === 0 ? planMonthly : 0);

  const recurringBillsMonthly = sum(
    bills
      .filter((row) => row.recurring)
      .map((row) => toMonthlyAmount(Number(row.amount), row.bill_frequency ?? "monthly")),
  );
  const dashboardSpending = recurringBillsMonthly + monthExpenses;
  const reportsSpending = monthExpenses;

  let plaidSnapshot = null;
  if (plaidClientId && plaidSecret && encryptionKey && connections.data?.length) {
    const plaid = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[plaidEnv] ?? PlaidEnvironments.production,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": plaidClientId,
            "PLAID-SECRET": plaidSecret,
          },
        },
      }),
    );

    plaidSnapshot = [];
    for (const connection of connections.data) {
      if (!connection.access_token_encrypted) continue;
      try {
        const accessToken = decryptToken(connection, encryptionKey);
        const response = await plaid.accountsGet({ access_token: accessToken });
        plaidSnapshot.push({
          connectionId: connection.id,
          institution: connection.institution_name,
          accounts: response.data.accounts.map((account) => ({
            id: account.account_id,
            name: account.name,
            type: account.type,
            subtype: account.subtype,
            current: account.balances.current,
            available: account.balances.available,
          })),
        });
      } catch (error) {
        plaidSnapshot.push({
          connectionId: connection.id,
          error: error.message,
        });
      }
    }
  }

  const plaidByExternalId = new Map();
  for (const connection of plaidSnapshot ?? []) {
    for (const account of connection.accounts ?? []) {
      plaidByExternalId.set(account.id, account);
    }
  }

  const balanceMismatches = [];
  for (const row of accounts) {
    if (!row.external_account_id) continue;
    const plaidAccount = plaidByExternalId.get(row.external_account_id);
    if (!plaidAccount) {
      balanceMismatches.push({
        name: row.name,
        externalAccountId: row.external_account_id,
        recordKind: row.record_kind,
        issue: "missing_in_plaid",
        dbBalance: Number(row.balance),
      });
      continue;
    }
    const isDebt = row.record_kind === "debt" || plaidAccount.type === "credit" || plaidAccount.type === "loan";
    const expected = isDebt ? Math.abs(Number(plaidAccount.current ?? 0)) : Number(plaidAccount.current ?? 0);
    const dbBalance = Number(row.balance);
    if (Math.abs(expected - dbBalance) > 0.02) {
      balanceMismatches.push({
        name: row.name,
        externalAccountId: row.external_account_id,
        recordKind: row.record_kind,
        issue: "balance_mismatch",
        dbBalance,
        plaidCurrent: plaidAccount.current,
        expected,
        delta: round(dbBalance - expected),
      });
    }
  }

  for (const investment of investments) {
    if (!investment.external_account_id) continue;
    const plaidAccount = plaidByExternalId.get(investment.external_account_id);
    if (!plaidAccount) continue;
    const expected = Number(plaidAccount.current ?? 0);
    const dbValue = Number(investment.value);
    if (Math.abs(expected - dbValue) > 1) {
      balanceMismatches.push({
        name: investment.name,
        externalAccountId: investment.external_account_id,
        recordKind: "investment_row",
        issue: "investment_value_mismatch",
        dbBalance: dbValue,
        plaidCurrent: plaidAccount.current,
        expected,
        delta: round(dbValue - expected),
      });
    }
  }

  const duplicateAccounts = findDuplicates(
    accounts.filter((row) => row.external_account_id),
    (row) => row.external_account_id,
  );
  const duplicateTransactions = findDuplicates(
    transactions.filter((row) => row.external_transaction_id),
    (row) => row.external_transaction_id,
  );
  const duplicateIncome = findDuplicates(recurringIncome, (row) =>
    [
      row.user_id,
      (row.name ?? "").trim().toLowerCase(),
      row.frequency,
      Math.round(Number(row.amount) * 100),
    ].join("|"),
  );
  const duplicateBills = findDuplicates(bills, (row) =>
    [(row.name ?? "").trim().toLowerCase(), Math.round(Number(row.amount) * 100), row.bill_frequency].join("|"),
  );
  const duplicateInvestments = findDuplicates(
    investments.filter((row) => row.external_account_id),
    (row) => row.external_account_id,
  );

  const orphanedLegacyInvestments =
    investments.length > 0
      ? legacyInvestmentAccounts.map((row) => ({
          id: row.id,
          name: row.name,
          balance: Number(row.balance),
          externalAccountId: row.external_account_id,
          issue: "orphaned_legacy_investment_account_not_in_engine",
        }))
      : [];

  console.log(
    JSON.stringify(
      {
        userId,
        email: user.email,
        householdId,
        counts: {
          accounts: accounts.length,
          visibleAccounts: visibleAccounts.length,
          cashAccounts: cashAccounts.length,
          debts: debts.length,
          creditInAccounts: creditInAccounts.length,
          investmentsTable: investments.length,
          legacyInvestmentAccounts: legacyInvestmentAccounts.length,
          transactions: transactions.length,
          ledgerTransactions: ledgerTransactions.length,
          recurringIncome: recurringIncome.length,
          bills: bills.length,
          bankConnections: connections.data?.length ?? 0,
        },
        duplicates: {
          accounts: duplicateAccounts,
          transactions: duplicateTransactions,
          income: duplicateIncome,
          bills: duplicateBills,
          investments: duplicateInvestments,
        },
        orphanedLegacyInvestments,
        balanceMismatches,
        metrics: {
          cash: {
            rawSources: cashAccounts.map((row) => ({
              name: row.name,
              type: row.type,
              balance: Number(row.balance),
              available: row.available_balance,
              includeInNetWorth: row.include_in_net_worth !== false,
              includeInSafeToSpend: row.include_in_safe_to_spend !== false,
            })),
            formula: "sum(cash account balances where visible + includeInNetWorth)",
            displayed: round(dbCash),
          },
          investments: {
            rawSources: {
              investmentsTable: investments.map((row) => ({
                name: row.name,
                value: Number(row.value),
                externalAccountId: row.external_account_id,
              })),
              legacyAccounts: legacyInvestmentAccounts.map((row) => ({
                name: row.name,
                balance: Number(row.balance),
              })),
              portfolioAccounts: investmentPortfolioAccounts.map((row) => ({
                name: row.name,
                balance: Number(row.balance),
              })),
            },
            formula:
              investments.length > 0
                ? "sum(investments.value) + sum(accounts with investment/crypto type)"
                : "sum(legacy investment account balances) + sum(accounts with investment/crypto type)",
            displayed: round(totalInvestmentsDisplayed),
          },
          debt: {
            rawSources: {
              debts: debts.map((row) => ({
                name: row.name,
                type: row.type,
                balance: Number(row.balance),
              })),
              creditInAccounts: creditInAccounts.map((row) => ({
                name: row.name,
                balance: Number(row.balance),
              })),
            },
            formula: "sum(debt record_kind) + sum(credit_card in account record_kind)",
            displayed: round(totalDebtDisplayed),
          },
          netWorth: {
            formula: "cash + investments - debt",
            displayed: round(netWorthDisplayed),
          },
          income: {
            recurringMonthly: round(recurringMonthly),
            incomePlanMonthly: round(planMonthly),
            ledgerMonthIncome: round(monthIncomeLedger),
            dashboardFormula:
              personalRecurring.filter((row) => row.schedule_status !== "paused").length > 0
                ? "recurring income only (ignores ledger)"
                : "ledger income for month",
            dashboardDisplayed: round(dashboardIncomeWithPlan),
            annualDisplayed: round(dashboardIncomeWithPlan * 12),
          },
          spending: {
            recurringBillsMonthly: round(recurringBillsMonthly),
            ledgerMonthExpenses: round(monthExpenses),
            dashboardFormula: "recurring bills + current month expenses",
            dashboardDisplayed: round(dashboardSpending),
            reportsFormula: "current month expenses only",
            reportsDisplayed: round(reportsSpending),
            doubleCountRisk: round(recurringBillsMonthly + monthExpenses - reportsSpending),
          },
          transfersThisMonth: round(monthTransfers),
          safeToSpend: {
            formula: "income - bills - min(debts) - min(goals) - min(investments) [waterfall]",
            note: "Does NOT use account cash balances",
          },
        },
        plaidSnapshot,
        shouldSync,
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
