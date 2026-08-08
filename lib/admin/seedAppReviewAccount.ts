import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

/** Hard-locked App Review target. Refusing any other email is intentional. */
export const APP_REVIEW_TARGET_EMAIL = "christiangoller11@gmail.com";

const SEED_MARKER = "buxme-app-review-seed";
const SEED_INSTITUTION = "App Review Seed";

export type SeedAction = {
  action: "added" | "skipped" | "updated" | "unchanged";
  entity: string;
  detail: string;
};

export type AppReviewSeedResult = {
  email: string;
  userId: string;
  dryRun: boolean;
  actions: SeedAction[];
  subscriptionBefore: SubscriptionSnapshot;
  subscriptionAfter: SubscriptionSnapshot;
  subscriptionUnchanged: boolean;
};

type SubscriptionSnapshot = {
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_provider: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  apple_product_id: string | null;
  apple_original_transaction_id: string | null;
  subscription_current_period_end: string | null;
};

type SeedOptions = {
  dryRun?: boolean;
  /** Must match APP_REVIEW_TARGET_EMAIL exactly (case-insensitive). */
  email?: string;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function yearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function clampDueDay(day: number, reference = new Date()): number {
  const lastDay = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
}

function daysFromNow(offset: number, reference = new Date()): number {
  const date = new Date(reference);
  date.setDate(date.getDate() + offset);
  if (date.getMonth() !== reference.getMonth()) {
    // Keep within current month to avoid overdue/next-month confusion.
    return clampDueDay(reference.getDate() + Math.max(offset, 1), reference);
  }
  return clampDueDay(date.getDate(), reference);
}

function snapshotSubscription(row: Record<string, unknown> | null): SubscriptionSnapshot {
  return {
    subscription_plan: (row?.subscription_plan as string | null) ?? null,
    subscription_status: (row?.subscription_status as string | null) ?? null,
    subscription_provider: (row?.subscription_provider as string | null) ?? null,
    stripe_customer_id: (row?.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id: (row?.stripe_subscription_id as string | null) ?? null,
    apple_product_id: (row?.apple_product_id as string | null) ?? null,
    apple_original_transaction_id:
      (row?.apple_original_transaction_id as string | null) ?? null,
    subscription_current_period_end:
      (row?.subscription_current_period_end as string | null) ?? null,
  };
}

function subscriptionsEqual(a: SubscriptionSnapshot, b: SubscriptionSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function resolveUserIdByEmail(
  admin: BuxmeSupabaseClient,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === target);
    if (match?.id) {
      return { id: match.id, email: match.email ?? target };
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function resolveHouseholdId(
  admin: BuxmeSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("household_id")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.household_id) return profile.household_id as string;

  const { data: membership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return (membership?.household_id as string | null) ?? null;
}

function push(
  actions: SeedAction[],
  action: SeedAction["action"],
  entity: string,
  detail: string,
) {
  actions.push({ action, entity, detail });
}

export async function seedAppReviewAccount(
  admin: BuxmeSupabaseClient,
  options: SeedOptions = {},
): Promise<AppReviewSeedResult> {
  const email = (options.email ?? APP_REVIEW_TARGET_EMAIL).trim().toLowerCase();
  const dryRun = Boolean(options.dryRun);

  if (email !== APP_REVIEW_TARGET_EMAIL.toLowerCase()) {
    throw new Error(
      `Refusing to seed ${email}. This script only targets ${APP_REVIEW_TARGET_EMAIL}.`,
    );
  }

  const user = await resolveUserIdByEmail(admin, email);
  if (!user) {
    throw new Error(`No auth user found for ${email}`);
  }

  const userId = user.id;
  const householdId = await resolveHouseholdId(admin, userId);
  const now = new Date();
  const currentMonth = yearMonth(now);
  const actions: SeedAction[] = [];

  const { data: profileBefore, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, subscription_plan, subscription_status, subscription_provider, stripe_customer_id, stripe_subscription_id, apple_product_id, apple_original_transaction_id, subscription_current_period_end",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileBefore) {
    throw new Error(`Profile missing for ${email} (${userId})`);
  }

  const subscriptionBefore = snapshotSubscription(profileBefore);

  const [
    goalsResult,
    billsResult,
    accountsResult,
    transactionsResult,
    plansResult,
    investmentsResult,
  ] = await Promise.all([
    admin.from("goals").select("id, name, current_amount, target_amount").eq("user_id", userId),
    admin
      .from("bills")
      .select("id, name, amount, due_day, paid_month, category")
      .eq("user_id", userId),
    admin
      .from("accounts")
      .select(
        "id, name, type, record_kind, balance, interest_rate, minimum_payment, institution, external_account_id",
      )
      .eq("user_id", userId),
    admin
      .from("transactions")
      .select(
        "id, name, amount, frequency, transaction_type, transaction_date, category, notes, external_transaction_id, account_id, recurring_status",
      )
      .eq("user_id", userId),
    admin.from("income_plans").select("*").eq("user_id", userId).eq("is_active", true),
    admin.from("investments").select("id, name, value").eq("user_id", userId),
  ]);

  for (const result of [
    goalsResult,
    billsResult,
    accountsResult,
    transactionsResult,
    plansResult,
    investmentsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const goals = goalsResult.data ?? [];
  const bills = billsResult.data ?? [];
  const accounts = accountsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const activePlans = plansResult.data ?? [];
  const investments = investmentsResult.data ?? [];

  push(
    actions,
    "unchanged",
    "investments",
    `Preserved ${investments.length} investment row(s); no investment writes.`,
  );

  // ── Goals ──────────────────────────────────────────────────────────────
  const desiredGoals = [
    {
      name: "Emergency Fund",
      goal_type: "emergency_fund",
      icon: "🛡️",
      current_amount: 2500,
      target_amount: 10000,
      contribution_amount: 250,
      contribution_frequency: "monthly",
    },
    {
      name: "Vacation",
      goal_type: "vacation",
      icon: "✈️",
      current_amount: 1200,
      target_amount: 4000,
      contribution_amount: 200,
      contribution_frequency: "monthly",
    },
    {
      name: "New Vehicle",
      goal_type: "other",
      icon: "🚗",
      current_amount: 3500,
      target_amount: 25000,
      contribution_amount: 400,
      contribution_frequency: "monthly",
    },
  ] as const;

  const goalIdsByName = new Map<string, string>();
  for (const goal of goals) {
    goalIdsByName.set(normalizeName(goal.name), goal.id);
  }

  for (const goal of desiredGoals) {
    const existingId = goalIdsByName.get(normalizeName(goal.name));
    if (existingId) {
      push(actions, "skipped", "goal", `${goal.name} already exists`);
      continue;
    }

    if (dryRun) {
      push(actions, "added", "goal", `[dry-run] would create ${goal.name}`);
      continue;
    }

    const { data, error } = await admin
      .from("goals")
      .insert({
        user_id: userId,
        household_id: householdId,
        name: goal.name,
        goal_type: goal.goal_type,
        icon: goal.icon,
        current_amount: goal.current_amount,
        target_amount: goal.target_amount,
        contribution_amount: goal.contribution_amount,
        contribution_frequency: goal.contribution_frequency,
        start_date: isoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
        next_occurrence: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
        recurring_status: "active",
      })
      .select("id, name")
      .single();

    if (error) throw error;
    goalIdsByName.set(normalizeName(goal.name), data.id);
    push(actions, "added", "goal", `${goal.name} ($${goal.current_amount}/$${goal.target_amount})`);
  }

  // Refresh goals map after inserts for allocation linking
  const { data: freshGoals } = await admin
    .from("goals")
    .select("id, name")
    .eq("user_id", userId);
  for (const goal of freshGoals ?? []) {
    goalIdsByName.set(normalizeName(goal.name), goal.id);
  }

  // ── Bills ──────────────────────────────────────────────────────────────
  const paidDueDay = clampDueDay(Math.max(1, now.getDate() - 4), now);
  const dueSoonDay = daysFromNow(2, now);
  const upcomingA = daysFromNow(10, now);
  const upcomingB = daysFromNow(14, now);
  const upcomingC = daysFromNow(18, now);

  const desiredBills = [
    {
      name: "Phone",
      amount: 120,
      due_day: paidDueDay,
      category: "Utilities",
      paid: true,
    },
    {
      name: "Internet",
      amount: 75,
      due_day: dueSoonDay,
      category: "Utilities",
      paid: false,
    },
    {
      name: "Car Insurance",
      amount: 210,
      due_day: upcomingA,
      category: "Insurance",
      paid: false,
    },
    {
      name: "Streaming",
      amount: 19.99,
      due_day: upcomingB,
      category: "Subscriptions",
      paid: false,
    },
    {
      name: "Utilities",
      amount: 145,
      due_day: upcomingC,
      category: "Utilities",
      paid: false,
    },
  ] as const;

  const existingBillNames = new Set(bills.map((bill) => normalizeName(bill.name)));

  for (const bill of desiredBills) {
    if (existingBillNames.has(normalizeName(bill.name))) {
      push(actions, "skipped", "bill", `${bill.name} already exists`);
      continue;
    }

    if (dryRun) {
      push(
        actions,
        "added",
        "bill",
        `[dry-run] would create ${bill.name} $${bill.amount} due day ${bill.due_day}${bill.paid ? " (paid)" : ""}`,
      );
      continue;
    }

    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, bill.due_day);
    const nextOccurrence = new Date(now.getFullYear(), now.getMonth(), bill.due_day);
    if (bill.paid && nextOccurrence.getTime() <= now.getTime()) {
      nextOccurrence.setMonth(nextOccurrence.getMonth() + 1);
    }

    const billId = crypto.randomUUID();
    const { error: billError } = await admin.from("bills").insert({
      id: billId,
      user_id: userId,
      household_id: householdId,
      name: bill.name,
      amount: bill.amount,
      due_day: bill.due_day,
      autopay: false,
      recurring: true,
      category: bill.category,
      paid_month: bill.paid ? currentMonth : null,
      bill_frequency: "monthly",
      paycheck_assignment: "first_paycheck",
      start_date: isoDate(startDate),
      next_occurrence: isoDate(nextOccurrence),
      last_processed_date: bill.paid ? isoDate(now) : null,
      recurring_status: "active",
    });
    if (billError) throw billError;

    const { error: splitError } = await admin.from("bill_splits").insert({
      bill_id: billId,
      user_id: userId,
      household_id: householdId,
      amount: bill.amount,
      due_day: bill.due_day,
      paycheck_assignment: "first_paycheck",
      paid_month: bill.paid ? currentMonth : null,
      paid_amount: bill.paid ? bill.amount : 0,
      sort_order: 0,
    });
    if (splitError) throw splitError;

    push(
      actions,
      "added",
      "bill",
      `${bill.name} $${bill.amount} · due day ${bill.due_day}${bill.paid ? " · paid this month" : ""}`,
    );
  }

  // ── Income source (do not duplicate) ───────────────────────────────────
  const recurringIncome = transactions.filter(
    (row) => row.transaction_type === "income" && row.frequency != null,
  );
  let paycheckAmount = 0;
  let paySchedule: "biweekly" | "monthly" | "every_2_weeks" = "biweekly";

  if (recurringIncome.length > 0) {
    const primary = [...recurringIncome].sort(
      (a, b) => Number(b.amount) - Number(a.amount),
    )[0]!;
    paycheckAmount = Number(primary.amount) || 0;
    const freq = String(primary.frequency);
    if (freq === "monthly") paySchedule = "monthly";
    else if (freq === "every_2_weeks" || freq === "biweekly") paySchedule = "biweekly";
    push(
      actions,
      "skipped",
      "income_source",
      `Kept existing paycheck source “${primary.name}” ($${paycheckAmount}, ${freq})`,
    );
  } else {
    paycheckAmount = 3200;
    paySchedule = "biweekly";
    if (dryRun) {
      push(actions, "added", "income_source", "[dry-run] would create biweekly Paycheck $3,200");
    } else {
      const nextPay = new Date(now);
      nextPay.setDate(nextPay.getDate() + ((5 - nextPay.getDay() + 7) % 7 || 7)); // next Friday-ish
      const { error } = await admin.from("transactions").insert({
        user_id: userId,
        household_id: householdId,
        transaction_type: "income",
        name: "Paycheck",
        amount: paycheckAmount,
        frequency: "every_2_weeks",
        category: "Salary",
        notes: `${SEED_MARKER}:paycheck-source`,
        external_transaction_id: `${SEED_MARKER}:income-source:paycheck`,
        transaction_date: isoDate(now),
        start_date: isoDate(new Date(now.getFullYear(), now.getMonth() - 3, 1)),
        next_occurrence: isoDate(nextPay),
        recurring_status: "active",
      });
      if (error) throw error;
      push(actions, "added", "income_source", "Paycheck $3,200 every_2_weeks");
    }
  }

  if (!Number.isFinite(paycheckAmount) || paycheckAmount <= 0) {
    paycheckAmount = 3200;
  }

  // ── Income plan + allocations ──────────────────────────────────────────
  const checking =
    accounts.find((account) => account.type === "checking" && account.record_kind !== "debt") ??
    accounts.find((account) => account.record_kind !== "debt") ??
    null;

  const allocationBlueprint = (() => {
    const billsBucket = Math.round(paycheckAmount * 0.35 * 100) / 100;
    const savingsBucket = Math.round(paycheckAmount * 0.15 * 100) / 100;
    const investingBucket = Math.round(paycheckAmount * 0.1 * 100) / 100;
    const vacationBucket = Math.round(paycheckAmount * 0.08 * 100) / 100;
    const assigned = billsBucket + savingsBucket + investingBucket + vacationBucket;
    return [
      { name: "Bills", icon: "📄", amount: billsBucket, remaining: false },
      { name: "Savings", icon: "🏦", amount: savingsBucket, remaining: false, goal: "Emergency Fund" },
      {
        name: "Investing",
        icon: "📈",
        amount: investingBucket,
        remaining: false,
      },
      {
        name: "Vacation",
        icon: "✈️",
        amount: vacationBucket,
        remaining: false,
        goal: "Vacation",
      },
      {
        name: "Spending / Remaining Balance",
        icon: "💵",
        amount: null as number | null,
        remaining: true,
        // remaining is paycheck - assigned
        _check: Math.round((paycheckAmount - assigned) * 100) / 100,
      },
    ];
  })();

  let planId: string | null = activePlans[0]?.id ?? null;

  if (planId) {
    push(
      actions,
      "skipped",
      "income_plan",
      `Active income plan already exists ($${activePlans[0]?.paycheck_amount ?? "?"})`,
    );
  } else if (dryRun) {
    push(
      actions,
      "added",
      "income_plan",
      `[dry-run] would create ${paySchedule} plan for $${paycheckAmount}`,
    );
  } else {
    const anchor = new Date(now);
    anchor.setDate(anchor.getDate() - 14);
    const nextPay = new Date(now);
    nextPay.setDate(nextPay.getDate() + 7);
    const schedule =
      paySchedule === "monthly"
        ? "monthly"
        : paySchedule === "biweekly" || paySchedule === "every_2_weeks"
          ? "biweekly"
          : "biweekly";

    const { data: plan, error } = await admin
      .from("income_plans")
      .insert({
        user_id: userId,
        household_id: householdId,
        pay_schedule: schedule,
        paycheck_amount: paycheckAmount,
        anchor_date: isoDate(anchor),
        weekly_day_of_week: nextPay.getDay(),
        monthly_days: [1, 15],
        deposit_account_id: checking?.id ?? null,
        next_pay_date: isoDate(nextPay),
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    planId = plan.id;
    push(
      actions,
      "added",
      "income_plan",
      `${schedule} plan · paycheck $${paycheckAmount} · next ${isoDate(nextPay)}`,
    );
  }

  if (planId && !dryRun) {
    const { data: existingAllocations, error: allocLoadError } = await admin
      .from("income_plan_allocations")
      .select("id, name, is_remaining_balance")
      .eq("income_plan_id", planId)
      .eq("user_id", userId);
    if (allocLoadError) throw allocLoadError;

    const existingNames = new Set(
      (existingAllocations ?? []).map((row) => normalizeName(row.name)),
    );

    if ((existingAllocations ?? []).length === 0) {
      const rows = allocationBlueprint.map((item, index) => ({
        income_plan_id: planId!,
        user_id: userId,
        household_id: householdId,
        name: item.name,
        icon: item.icon,
        amount: item.remaining ? null : item.amount,
        is_remaining_balance: item.remaining,
        account_id: checking?.id ?? null,
        goal_id:
          "goal" in item && item.goal
            ? (goalIdsByName.get(normalizeName(item.goal)) ?? null)
            : null,
        monthly_target: item.remaining
          ? null
          : item.amount != null
            ? Math.round(item.amount * (paySchedule === "monthly" ? 1 : 2) * 100) / 100
            : null,
        sort_order: index,
      }));

      const { error } = await admin.from("income_plan_allocations").insert(rows);
      if (error) throw error;
      push(
        actions,
        "added",
        "income_plan_allocations",
        `Created ${rows.length} allocations reconciling to $${paycheckAmount}`,
      );
    } else {
      let added = 0;
      for (const [index, item] of allocationBlueprint.entries()) {
        if (existingNames.has(normalizeName(item.name))) continue;
        const { error } = await admin.from("income_plan_allocations").insert({
          income_plan_id: planId,
          user_id: userId,
          household_id: householdId,
          name: item.name,
          icon: item.icon,
          amount: item.remaining ? null : item.amount,
          is_remaining_balance: item.remaining,
          account_id: checking?.id ?? null,
          goal_id:
            "goal" in item && item.goal
              ? (goalIdsByName.get(normalizeName(item.goal)) ?? null)
              : null,
          sort_order: index + 10,
        });
        if (error) throw error;
        added += 1;
      }
      if (added > 0) {
        push(actions, "added", "income_plan_allocations", `Added ${added} missing allocation(s)`);
      } else {
        push(actions, "skipped", "income_plan_allocations", "Allocations already present");
      }
    }
  } else if (planId && dryRun) {
    push(actions, "added", "income_plan_allocations", "[dry-run] would ensure allocation buckets");
  }

  // ── Debts ──────────────────────────────────────────────────────────────
  const debtRows = accounts.filter((account) => account.record_kind === "debt");
  const hasCreditCardDebt = debtRows.some(
    (debt) =>
      debt.type === "credit_card" ||
      normalizeName(debt.name).includes("credit"),
  );
  const hasAutoOrPersonal = debtRows.some(
    (debt) =>
      debt.type === "auto_loan" ||
      debt.type === "personal_loan" ||
      normalizeName(debt.name).includes("auto") ||
      normalizeName(debt.name).includes("car") ||
      normalizeName(debt.name).includes("personal"),
  );

  const desiredDebts = [
    !hasCreditCardDebt
      ? {
          name: "Visa Credit Card",
          type: "credit_card",
          balance: 2450,
          original_balance: 3200,
          interest_rate: 21.9,
          minimum_payment: 95,
          due_day: 18,
        }
      : null,
    !hasAutoOrPersonal
      ? {
          name: "Auto Loan",
          type: "auto_loan",
          balance: 12800,
          original_balance: 22000,
          interest_rate: 6.4,
          minimum_payment: 365,
          due_day: 12,
        }
      : null,
  ].filter(Boolean) as Array<{
    name: string;
    type: string;
    balance: number;
    original_balance: number;
    interest_rate: number;
    minimum_payment: number;
    due_day: number;
  }>;

  if (desiredDebts.length === 0) {
    push(
      actions,
      "skipped",
      "debt",
      "Credit/auto-style debts already present; no demo debts added",
    );
  }

  for (const debt of desiredDebts) {
    if (dryRun) {
      push(
        actions,
        "added",
        "debt",
        `[dry-run] would create ${debt.name} $${debt.balance} @ ${debt.interest_rate}% / $${debt.minimum_payment} min`,
      );
      continue;
    }

    const { error } = await admin.from("accounts").insert({
      user_id: userId,
      household_id: householdId,
      record_kind: "debt",
      name: debt.name,
      institution: SEED_INSTITUTION,
      type: debt.type,
      balance: debt.balance,
      original_balance: debt.original_balance,
      monthly_change: -debt.minimum_payment,
      interest_rate: debt.interest_rate,
      minimum_payment: debt.minimum_payment,
      due_day: debt.due_day,
      include_in_net_worth: true,
      include_in_safe_to_spend: false,
      is_hidden: false,
    });
    if (error) throw error;
    push(
      actions,
      "added",
      "debt",
      `${debt.name} $${debt.balance} · ${debt.interest_rate}% APR · $${debt.minimum_payment}/mo`,
    );
  }

  // ── Demo ledger transactions (sparse) ──────────────────────────────────
  const ledgerExpenses = transactions.filter(
    (row) =>
      row.transaction_type === "expense" &&
      row.frequency == null &&
      !String(row.external_transaction_id ?? "").startsWith(SEED_MARKER),
  );
  const seedTxExisting = new Set(
    transactions
      .map((row) => row.external_transaction_id)
      .filter((value): value is string => Boolean(value)),
  );

  const accountId = checking?.id ?? null;
  const desiredTx = [
    {
      key: `${SEED_MARKER}:txn:grocery`,
      name: "Whole Foods",
      amount: 86.42,
      type: "expense" as const,
      category: "Groceries",
      daysAgo: 2,
    },
    {
      key: `${SEED_MARKER}:txn:gas`,
      name: "Shell Gas",
      amount: 48.2,
      type: "expense" as const,
      category: "Gas",
      daysAgo: 4,
    },
    {
      key: `${SEED_MARKER}:txn:restaurant`,
      name: "Chipotle",
      amount: 17.65,
      type: "expense" as const,
      category: "Restaurants",
      daysAgo: 5,
    },
    {
      key: `${SEED_MARKER}:txn:shopping`,
      name: "Target",
      amount: 64.99,
      type: "expense" as const,
      category: "Shopping",
      daysAgo: 8,
    },
    {
      key: `${SEED_MARKER}:txn:insurance`,
      name: "Geico",
      amount: 210,
      type: "expense" as const,
      category: "Insurance",
      daysAgo: 11,
    },
    {
      key: `${SEED_MARKER}:txn:utilities`,
      name: "City Power & Light",
      amount: 145,
      type: "expense" as const,
      category: "Utilities",
      daysAgo: 13,
    },
    {
      key: `${SEED_MARKER}:txn:income-history`,
      name: "Paycheck",
      amount: paycheckAmount,
      type: "income" as const,
      category: "Salary",
      daysAgo: 7,
    },
    {
      key: `${SEED_MARKER}:txn:transfer`,
      name: "Transfer to Savings",
      amount: 250,
      type: "transfer" as const,
      category: "Transfer",
      daysAgo: 6,
    },
  ];

  // Only add demo expenses if the ledger is sparse (< 8 non-seed expenses)
  const shouldAddDemoTx = ledgerExpenses.length < 8;

  if (!shouldAddDemoTx) {
    push(
      actions,
      "skipped",
      "transactions",
      `Ledger already has ${ledgerExpenses.length} expenses; skipped demo expense pack`,
    );
  }

  for (const tx of desiredTx) {
    if (seedTxExisting.has(tx.key)) {
      push(actions, "skipped", "transaction", `${tx.name} seed already present`);
      continue;
    }

    if (tx.type === "expense" && !shouldAddDemoTx) {
      continue;
    }

    // Always allow one recent income history + transfer for demo clarity if missing
    if (tx.type !== "expense" && !shouldAddDemoTx) {
      const hasSimilarIncome =
        tx.type === "income" &&
        transactions.some(
          (row) =>
            row.transaction_type === "income" &&
            row.frequency == null &&
            Math.abs(Number(row.amount) - tx.amount) < 1,
        );
      if (hasSimilarIncome) {
        push(actions, "skipped", "transaction", `Similar income history already exists`);
        continue;
      }
      const hasTransfer = transactions.some((row) => row.transaction_type === "transfer");
      if (tx.type === "transfer" && hasTransfer) {
        push(actions, "skipped", "transaction", "Transfer already exists in ledger");
        continue;
      }
    }

    const date = new Date(now);
    date.setDate(date.getDate() - tx.daysAgo);

    if (dryRun) {
      push(
        actions,
        "added",
        "transaction",
        `[dry-run] ${tx.type} ${tx.name} $${tx.amount} (${isoDate(date)})`,
      );
      continue;
    }

    const { error } = await admin.from("transactions").insert({
      user_id: userId,
      household_id: householdId,
      transaction_type: tx.type,
      name: tx.name,
      amount: tx.amount,
      category: tx.category,
      account_id: accountId,
      notes: `${tx.name} · ${SEED_MARKER}`,
      external_transaction_id: tx.key,
      transaction_date: `${isoDate(date)}T15:00:00.000Z`,
      frequency: null,
      recurring_status: null,
    });
    if (error) throw error;
    push(
      actions,
      "added",
      "transaction",
      `${tx.type} ${tx.name} $${tx.amount} (${isoDate(date)})`,
    );
  }

  // ── Verify subscription untouched ──────────────────────────────────────
  const { data: profileAfter, error: afterError } = await admin
    .from("profiles")
    .select(
      "subscription_plan, subscription_status, subscription_provider, stripe_customer_id, stripe_subscription_id, apple_product_id, apple_original_transaction_id, subscription_current_period_end",
    )
    .eq("id", userId)
    .maybeSingle();
  if (afterError) throw afterError;

  const subscriptionAfter = snapshotSubscription(profileAfter);
  const subscriptionUnchanged = subscriptionsEqual(
    subscriptionBefore,
    subscriptionAfter,
  );

  if (!subscriptionUnchanged) {
    throw new Error(
      "Safety abort: subscription fields changed unexpectedly. Investigate immediately.",
    );
  }

  push(
    actions,
    "unchanged",
    "subscription",
    `Pro entitlement preserved (${subscriptionAfter.subscription_plan}/${subscriptionAfter.subscription_status}/${subscriptionAfter.subscription_provider})`,
  );

  return {
    email,
    userId,
    dryRun,
    actions,
    subscriptionBefore,
    subscriptionAfter,
    subscriptionUnchanged,
  };
}
