#!/usr/bin/env node
/**
 * One-time import from Finance_Tracker.xlsx into a Buxme user account.
 *
 * Usage:
 *   npm run import:finance-spreadsheet
 *   npm run import:finance-spreadsheet -- --email=you@example.com
 *   npm run import:finance-spreadsheet -- --dry-run
 *
 * Env (.env.local):
 *   SUPABASE_DB_URL
 *   IMPORT_USER_EMAIL (optional default email)
 *   IMPORT_SPREADSHEET_PATH (optional xlsx path)
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const DEFAULT_SPREADSHEET = path.join(
  process.env.HOME ?? "",
  "Downloads",
  "Finance_Tracker (1).xlsx",
);

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

function parseArgs(argv) {
  const args = { dryRun: false, email: null, spreadsheet: null };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--email=")) args.email = arg.slice("--email=".length);
    else if (arg.startsWith("--spreadsheet="))
      args.spreadsheet = arg.slice("--spreadsheet=".length);
  }
  return args;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function advanceOccurrence(fromDate, frequency) {
  const from = startOfDay(fromDate);
  switch (frequency) {
    case "weekly":
      from.setDate(from.getDate() + 7);
      return startOfDay(from);
    case "biweekly":
      from.setDate(from.getDate() + 14);
      return startOfDay(from);
    case "monthly":
      from.setMonth(from.getMonth() + 1);
      return startOfDay(from);
    default:
      from.setDate(from.getDate() + 7);
      return startOfDay(from);
  }
}

function computeInitialNextOccurrence(startDate, frequency, referenceDate = new Date()) {
  let next = startOfDay(startDate);
  const today = startOfDay(referenceDate);
  if (next.getTime() > today.getTime()) return next;
  let guard = 0;
  while (next.getTime() < today.getTime() && guard < 500) {
    next = advanceOccurrence(next, frequency);
    guard += 1;
  }
  return next;
}

function createSchedule(startDate, frequency, referenceDate = new Date()) {
  return {
    start_date: toDateString(startDate),
    next_occurrence: toDateString(
      computeInitialNextOccurrence(startDate, frequency, referenceDate),
    ),
    last_processed_date: null,
    recurring_status: "active",
  };
}

function defaultStartDate(referenceDate, daysAgo = 120) {
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - daysAgo);
  return start;
}

const ACCOUNTS = [
  {
    name: "Vallant Checking (CC)",
    institution: "Vallant",
    type: "checking",
    balance: 1200,
  },
  {
    name: "Vallant Checking (Bills)",
    institution: "Vallant",
    type: "checking",
    balance: 1100,
  },
  {
    name: "Vallant House Savings",
    institution: "Vallant",
    type: "savings",
    balance: 8200,
  },
  {
    name: "Vallant Vacation Savings",
    institution: "Vallant",
    type: "savings",
    balance: 1500,
  },
  {
    name: "SOFI Savings (Alahnna)",
    institution: "SOFI",
    type: "savings",
    balance: 800,
  },
];

const INVESTMENTS = [
  {
    name: "Truist Investment Cash",
    type: "brokerage",
    value: 1532.68,
    weeklyContribution: 82.7,
  },
  { name: "Charles Schwab", type: "brokerage", value: 0, weeklyContribution: null },
  { name: "Coinbase", type: "crypto", value: 0, weeklyContribution: null },
];

const GOALS = [
  {
    name: "House Fund",
    type: "house",
    icon: "🏠",
    current: 8200,
    target: 8200,
    weeklyContribution: 200,
  },
  {
    name: "Vacation Fund",
    type: "vacation",
    icon: "✈️",
    current: 1500,
    target: 1500,
    weeklyContribution: 100,
  },
  {
    name: "Investment Fund",
    type: "custom",
    icon: "⭐",
    current: 1532.68,
    target: 1532.68,
    weeklyContribution: 82.7,
  },
  {
    name: "Emergency / SOFI",
    type: "emergency_fund",
    icon: "🛡️",
    current: 800,
    target: 800,
    weeklyContribution: null,
  },
];

const INCOME = {
  name: "Weekly Paycheck",
  amount: 880.66,
  frequency: "weekly",
  category: "Employment",
  depositAccountName: "Vallant Checking (CC)",
};

const CREDIT_CARDS = [
  { name: "Apple Card", limit: 2000 },
  { name: "Capital One Savor", limit: 1200 },
  { name: "Capital One Gas", limit: 1200 },
  { name: "Discover", limit: 1000 },
  { name: "Amazon Chase", limit: 2000 },
];

async function findExistingName(client, table, userId, name, extraWhere = "") {
  const params = [userId, name.trim().toLowerCase()];
  let query = `SELECT id, name FROM ${table} WHERE user_id = $1 AND lower(trim(name)) = $2`;
  if (extraWhere) query += ` AND ${extraWhere}`;
  query += " LIMIT 1";
  const result = await client.query(query, params);
  return result.rows[0] ?? null;
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const args = parseArgs(process.argv.slice(2));
  const connectionString = process.env.SUPABASE_DB_URL ?? fileEnv.SUPABASE_DB_URL;
  const email =
    args.email ??
    process.env.IMPORT_USER_EMAIL ??
    fileEnv.IMPORT_USER_EMAIL ??
    fileEnv.RESEND_SANDBOX_ACCOUNT_EMAIL ??
    "christiangoller99@gmail.com";
  const spreadsheetPath =
    args.spreadsheet ??
    process.env.IMPORT_SPREADSHEET_PATH ??
    fileEnv.IMPORT_SPREADSHEET_PATH ??
    DEFAULT_SPREADSHEET;

  if (!connectionString) {
    console.error("Missing SUPABASE_DB_URL in .env.local");
    process.exit(1);
  }

  if (!fs.existsSync(spreadsheetPath)) {
    console.error(`Spreadsheet not found: ${spreadsheetPath}`);
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const summary = {
    spreadsheet: spreadsheetPath,
    userEmail: email,
    dryRun: args.dryRun,
    accountsImported: [],
    accountsSkipped: [],
    goalsImported: [],
    goalsSkipped: [],
    incomeImported: [],
    incomeSkipped: [],
    creditCardsImported: [],
    creditCardsSkipped: [],
    investmentsImported: [],
    investmentsSkipped: [],
    rowsSkipped: [
      "Weekly Tracking historical rows (snapshot balances only)",
      "Income & Transfers weekly history rows",
      "Per-account weekly ledger rows",
      "Investment Tracker historical rows",
      "Side Hustle empty income rows (category available as free-text: Side Hustle)",
      "Misc debts sheet rows (Phone, iPad, Watch — not in import spec)",
      "Weekly Bills transfer ($115) — no Buxme recurring transfer entity; fund Bills checking via paycheck flow",
      "Charles Schwab / Coinbase account rows — represented in investments table only",
      "Truist Investment Cash account row — represented in investments table only",
    ],
  };

  await client.connect();

  try {
    const userResult = await client.query(
      "SELECT id, email, full_name FROM public.profiles WHERE lower(email) = lower($1) LIMIT 1",
      [email],
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new Error(`No profile found for ${email}`);
    }

    const householdResult = await client.query(
      "SELECT household_id FROM public.household_members WHERE user_id = $1 LIMIT 1",
      [user.id],
    );
    const householdId = householdResult.rows[0]?.household_id ?? null;
    const referenceDate = new Date();

    console.log(`Import target: ${user.full_name || user.email} (${user.id})`);
    console.log(`Spreadsheet: ${spreadsheetPath}`);
    if (summary.dryRun) console.log("DRY RUN — no writes");

    await client.query("BEGIN");

    const accountIds = new Map();

    for (const account of ACCOUNTS) {
      const existing = await findExistingName(
        client,
        "public.accounts",
        user.id,
        account.name,
        "record_kind = 'account'",
      );
      if (existing) {
        summary.accountsSkipped.push(`${account.name} (already exists)`);
        accountIds.set(account.name, existing.id);
        continue;
      }

      if (!summary.dryRun) {
        const inserted = await client.query(
          `INSERT INTO public.accounts (
            user_id, household_id, record_kind, name, institution, type, balance, monthly_change
          ) VALUES ($1, $2, 'account', $3, $4, $5, $6, 0)
          RETURNING id`,
          [
            user.id,
            householdId,
            account.name,
            account.institution,
            account.type,
            account.balance,
          ],
        );
        accountIds.set(account.name, inserted.rows[0].id);
      }

      summary.accountsImported.push(
        `${account.name} (${account.type}) — $${account.balance.toLocaleString("en-US")}`,
      );
    }

    for (const investment of INVESTMENTS) {
      const existing = await findExistingName(
        client,
        "public.investments",
        user.id,
        investment.name,
      );
      if (existing) {
        summary.investmentsSkipped.push(`${investment.name} (already exists)`);
        continue;
      }

      const schedule =
        investment.weeklyContribution != null
          ? createSchedule(defaultStartDate(referenceDate), "weekly", referenceDate)
          : {
              start_date: null,
              next_occurrence: null,
              last_processed_date: null,
              recurring_status: null,
            };

      if (!summary.dryRun) {
        await client.query(
          `INSERT INTO public.investments (
            user_id, household_id, name, type, value, monthly_change,
            monthly_contribution, contribution_frequency,
            start_date, next_occurrence, last_processed_date, recurring_status
          ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10, $11)`,
          [
            user.id,
            householdId,
            investment.name,
            investment.type,
            investment.value,
            investment.weeklyContribution,
            investment.weeklyContribution != null ? "weekly" : null,
            schedule.start_date,
            schedule.next_occurrence,
            schedule.last_processed_date,
            schedule.recurring_status,
          ],
        );
      }

      const valueLabel =
        investment.value > 0
          ? `$${investment.value.toLocaleString("en-US")}`
          : "$0";
      const contribLabel =
        investment.weeklyContribution != null
          ? `, weekly +$${investment.weeklyContribution}`
          : "";
      summary.investmentsImported.push(`${investment.name} — ${valueLabel}${contribLabel}`);
    }

    for (const goal of GOALS) {
      const existing = await findExistingName(client, "public.goals", user.id, goal.name);
      if (existing) {
        summary.goalsSkipped.push(`${goal.name} (already exists)`);
        continue;
      }

      const schedule =
        goal.weeklyContribution != null
          ? createSchedule(defaultStartDate(referenceDate), "weekly", referenceDate)
          : {
              start_date: null,
              next_occurrence: null,
              last_processed_date: null,
              recurring_status: null,
            };

      if (!summary.dryRun) {
        await client.query(
          `INSERT INTO public.goals (
            user_id, household_id, name, goal_type, icon, current_amount, target_amount,
            contribution_amount, contribution_frequency,
            start_date, next_occurrence, last_processed_date, recurring_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            user.id,
            householdId,
            goal.name,
            goal.type,
            goal.icon,
            goal.current,
            goal.target,
            goal.weeklyContribution,
            goal.weeklyContribution != null ? "weekly" : null,
            schedule.start_date,
            schedule.next_occurrence,
            schedule.last_processed_date,
            schedule.recurring_status,
          ],
        );
      }

      const contribLabel =
        goal.weeklyContribution != null
          ? `, weekly +$${goal.weeklyContribution}`
          : "";
      summary.goalsImported.push(
        `${goal.name} — $${goal.current.toLocaleString("en-US")}${contribLabel}`,
      );
    }

    const incomeExisting = await findExistingName(
      client,
      "public.transactions",
      user.id,
      INCOME.name,
      "transaction_type = 'income'",
    );
    if (incomeExisting) {
      summary.incomeSkipped.push(`${INCOME.name} (already exists)`);
    } else {
      const depositAccountId = accountIds.get(INCOME.depositAccountName) ?? null;
      const schedule = createSchedule(
        defaultStartDate(referenceDate),
        INCOME.frequency,
        referenceDate,
      );

      if (!summary.dryRun) {
        await client.query(
          `INSERT INTO public.transactions (
            user_id, household_id, transaction_type, name, amount, frequency, category, account_id,
            start_date, next_occurrence, last_processed_date, recurring_status
          ) VALUES ($1, $2, 'income', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            user.id,
            householdId,
            INCOME.name,
            INCOME.amount,
            INCOME.frequency,
            INCOME.category,
            depositAccountId,
            schedule.start_date,
            schedule.next_occurrence,
            schedule.last_processed_date,
            schedule.recurring_status,
          ],
        );
      }

      summary.incomeImported.push(
        `${INCOME.name} — $${INCOME.amount}/week → ${INCOME.depositAccountName}`,
      );
    }

    summary.incomeSkipped.push(
      "Side Hustle category ready for manual income entries (no empty rows imported)",
    );

    for (const card of CREDIT_CARDS) {
      const existing = await findExistingName(
        client,
        "public.accounts",
        user.id,
        card.name,
        "record_kind = 'debt'",
      );
      if (existing) {
        summary.creditCardsSkipped.push(`${card.name} (already exists)`);
        continue;
      }

      if (!summary.dryRun) {
        await client.query(
          `INSERT INTO public.accounts (
            user_id, household_id, record_kind, name, institution, type,
            balance, original_balance, monthly_change, interest_rate, minimum_payment, due_day
          ) VALUES ($1, $2, 'debt', $3, $4, 'credit_card', 0, $5, 0, 0, 0, 15)`,
          [
            user.id,
            householdId,
            card.name,
            `Credit limit $${card.limit.toLocaleString("en-US")}`,
            card.limit,
          ],
        );
      }

      summary.creditCardsImported.push(`${card.name} — limit $${card.limit.toLocaleString("en-US")}, balance $0`);
    }

    if (summary.dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }

    console.log("\n=== Import Summary ===");
    console.log(`Accounts imported (${summary.accountsImported.length}):`);
    for (const row of summary.accountsImported) console.log(`  • ${row}`);
    if (summary.accountsSkipped.length) {
      console.log(`Accounts skipped (${summary.accountsSkipped.length}):`);
      for (const row of summary.accountsSkipped) console.log(`  • ${row}`);
    }

    console.log(`\nGoals imported (${summary.goalsImported.length}):`);
    for (const row of summary.goalsImported) console.log(`  • ${row}`);
    if (summary.goalsSkipped.length) {
      console.log(`Goals skipped (${summary.goalsSkipped.length}):`);
      for (const row of summary.goalsSkipped) console.log(`  • ${row}`);
    }

    console.log(`\nIncome imported (${summary.incomeImported.length}):`);
    for (const row of summary.incomeImported) console.log(`  • ${row}`);
    if (summary.incomeSkipped.length) {
      console.log(`Income notes (${summary.incomeSkipped.length}):`);
      for (const row of summary.incomeSkipped) console.log(`  • ${row}`);
    }

    console.log(`\nCredit cards imported (${summary.creditCardsImported.length}):`);
    for (const row of summary.creditCardsImported) console.log(`  • ${row}`);
    if (summary.creditCardsSkipped.length) {
      console.log(`Credit cards skipped (${summary.creditCardsSkipped.length}):`);
      for (const row of summary.creditCardsSkipped) console.log(`  • ${row}`);
    }

    console.log(`\nInvestment accounts imported (${summary.investmentsImported.length}):`);
    for (const row of summary.investmentsImported) console.log(`  • ${row}`);
    if (summary.investmentsSkipped.length) {
      console.log(`Investments skipped (${summary.investmentsSkipped.length}):`);
      for (const row of summary.investmentsSkipped) console.log(`  • ${row}`);
    }

    console.log(`\nRows skipped (${summary.rowsSkipped.length}):`);
    for (const row of summary.rowsSkipped) console.log(`  • ${row}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
