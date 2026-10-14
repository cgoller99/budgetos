import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { IncomePlan, IncomePlanAllocation, IncomePlanSchedule } from "@/lib/incomePlan/types";
import type { Debt, DebtAccountType, FinanceData } from "@/lib/finance/types";

export const EXTRA_DEBT_ALLOCATION_NAME = "Extra debt payment";
const MAX_MONTHS = 600;
const BALANCE_EPSILON_CENTS = 1;

export type PayoffStrategyKind = "snowball" | "avalanche" | "custom";

export type PayoffDebt = {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  accountType?: DebtAccountType;
};

export type DebtPayoffRequest = {
  debts: PayoffDebt[];
  strategy: PayoffStrategyKind;
  extraMonthly?: number;
  customOrder?: string[];
  extraByDebtId?: Record<string, number>;
  monthlyBudget?: number | null;
  referenceDate?: Date;
};

export type DebtMonthLine = {
  debtId: string;
  name: string;
  startingBalance: number;
  minimumPayment: number;
  extraPayment: number;
  principalPaid: number;
  interestCharged: number;
  endingBalance: number;
  receivesExtra: boolean;
};

export type DebtPayoffMonth = {
  index: number;
  label: string;
  startingBalance: number;
  minimumPayment: number;
  extraPayment: number;
  principalPaid: number;
  interestCharged: number;
  endingBalance: number;
  extraDebtId: string | null;
  extraDebtName: string | null;
  paidOffDebtIds: string[];
  lines: DebtMonthLine[];
};

export type DebtPayoffMilestone = {
  id: "first-payoff" | "quarter" | "half" | "debt-free";
  label: string;
  monthIndex: number | null;
};

export type DebtPayoffResult = {
  strategy: PayoffStrategyKind;
  isReliable: boolean;
  incompleteReason: string | null;
  assumptions: string[];
  months: number | null;
  debtFreeDate: Date | null;
  timeLabel: string;
  totalInterest: number | null;
  totalPaid: number | null;
  monthlyCommitment: number;
  order: Array<{ id: string; name: string }>;
  payoffMonthByDebtId: Record<string, number | null>;
  schedule: DebtPayoffMonth[];
  milestones: DebtPayoffMilestone[];
};

export type DebtOverview = {
  totalBalance: number;
  totalMinimum: number;
  weightedApr: number | null;
  activeCount: number;
  projected: DebtPayoffResult;
};

export type DebtStrategyComparison = {
  snowball: DebtPayoffResult;
  avalanche: DebtPayoffResult;
  custom: DebtPayoffResult;
  interestSaved: {
    snowball: number | null;
    avalanche: number | null;
    custom: number | null;
  };
  recommended: "snowball" | "avalanche" | null;
  recommendation: string;
};

export type DebtRecommendation = {
  id: string;
  title: string;
  detail: string;
};

type WorkingDebt = {
  id: string;
  name: string;
  accountType: DebtAccountType;
  apr: number;
  minimumCents: number;
  balanceCents: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  next.setHours(0, 0, 0, 0);
  return next;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function formatPayoffDuration(months: number | null): string {
  if (months == null) {
    return "Forecast incomplete";
  }
  if (months <= 0) {
    return "Debt-free now";
  }
  if (months === 1) {
    return "1 month";
  }
  if (months < 12) {
    return `${months} months`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) {
    return years === 1 ? "1 year" : `${years} years`;
  }
  return `${years} yr ${rest} mo`;
}

export function monthlyAmountFromSchedule(
  amount: number,
  schedule: IncomePlanSchedule,
  customIntervalDays: number | null = null,
): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  switch (schedule) {
    case "weekly":
      return roundCurrency((amount * 52) / 12);
    case "biweekly":
      return roundCurrency((amount * 26) / 12);
    case "twice_monthly":
      return roundCurrency(amount * 2);
    case "monthly":
      return roundCurrency(amount);
    case "quarterly":
      return roundCurrency(amount / 3);
    case "yearly":
      return roundCurrency(amount / 12);
    case "custom": {
      const days =
        customIntervalDays && customIntervalDays > 0 ? customIntervalDays : 30;
      return roundCurrency((amount * 365) / days / 12);
    }
    default:
      return roundCurrency(amount);
  }
}

export function plannedExtraDebtMonthly(
  plan: IncomePlan | null | undefined,
): number {
  if (!plan?.isActive) {
    return 0;
  }
  const resolved = resolveAllocationAmounts(plan);
  return roundCurrency(
    resolved.reduce((total, item) => {
      if (item.allocation.name !== EXTRA_DEBT_ALLOCATION_NAME || item.amount <= 0) {
        return total;
      }
      return (
        total +
        monthlyAmountFromSchedule(
          item.amount,
          plan.paySchedule,
          plan.customIntervalDays,
        )
      );
    }, 0),
  );
}

export function incomePlanAllocationsWithExtraDebt<
  T extends Omit<IncomePlanAllocation, "id"> & { id?: string },
>(
  allocations: T[],
  extra: { amount: number; debtId: string | null },
): Omit<IncomePlanAllocation, "id">[] {
  const kept = allocations
    .filter((allocation) => allocation.name !== EXTRA_DEBT_ALLOCATION_NAME)
    .map((allocation, index) => ({
      name: allocation.name,
      icon: allocation.icon,
      amount: allocation.amount,
      percentage: allocation.percentage ?? null,
      allocationType: allocation.allocationType ?? null,
      isRemainingBalance: allocation.isRemainingBalance,
      accountId: allocation.accountId,
      goalId: allocation.goalId,
      billId: allocation.billId ?? null,
      debtId: allocation.debtId ?? null,
      investmentId: allocation.investmentId ?? null,
      monthlyTarget: allocation.monthlyTarget,
      contributionFrequency: allocation.contributionFrequency ?? null,
      sortOrder: allocation.sortOrder ?? index,
    }));

  if (extra.amount <= 0 || !extra.debtId) {
    return kept;
  }

  kept.push({
    name: EXTRA_DEBT_ALLOCATION_NAME,
    icon: "💳",
    amount: roundCurrency(extra.amount),
    percentage: null,
    allocationType: "fixed",
    isRemainingBalance: false,
    accountId: null,
    goalId: null,
    billId: null,
    debtId: extra.debtId,
    investmentId: null,
    monthlyTarget: null,
    contributionFrequency: null,
    sortOrder: kept.length,
  });
  return kept;
}

function activeDebts(debts: PayoffDebt[]): WorkingDebt[] {
  return debts
    .filter((debt) => debt.balance > 0.009)
    .map((debt) => ({
      id: debt.id,
      name: debt.name.trim() || "Debt",
      accountType: debt.accountType ?? "other",
      apr: Number.isFinite(debt.interestRate) ? Math.max(debt.interestRate, 0) : 0,
      minimumCents: Math.max(0, toCents(debt.minimumPayment)),
      balanceCents: toCents(debt.balance),
    }));
}

function compareName(left: WorkingDebt, right: WorkingDebt): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function priorityOrder(
  debts: WorkingDebt[],
  strategy: PayoffStrategyKind,
  customOrder: string[],
  balanceOf: (debt: WorkingDebt) => number = (debt) => debt.balanceCents,
): WorkingDebt[] {
  const active = debts.filter((debt) => balanceOf(debt) > BALANCE_EPSILON_CENTS);
  if (strategy === "custom") {
    const rank = new Map(customOrder.map((id, index) => [id, index]));
    return [...active].sort((left, right) => {
      const leftRank = rank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || right.apr - left.apr || compareName(left, right);
    });
  }
  if (strategy === "snowball") {
    return [...active].sort(
      (left, right) =>
        balanceOf(left) - balanceOf(right) ||
        right.apr - left.apr ||
        compareName(left, right),
    );
  }
  return [...active].sort(
    (left, right) =>
      right.apr - left.apr ||
      balanceOf(left) - balanceOf(right) ||
      compareName(left, right),
  );
}

function assumptionsFor(debts: WorkingDebt[], monthlyBudget: number | null, minimumPool: number): string[] {
  const notes = [
    "Promotional and variable APR changes are not stored, so this forecast keeps each debt's current APR.",
  ];
  if (debts.some((debt) => debt.apr === 0)) {
    notes.push("A 0% APR adds no interest. If that rate is unknown rather than promotional, treat the interest total as incomplete.");
  }
  if (debts.some((debt) => debt.accountType === "credit_card")) {
    notes.push("Credit card minimums use the fixed amount you entered. Issuers often recalculate that minimum.");
  }
  if (monthlyBudget != null && toCents(monthlyBudget) + BALANCE_EPSILON_CENTS < minimumPool) {
    notes.push("The custom monthly budget is below the combined minimum payments, so some debts receive only a partial payment.");
  }
  return notes;
}

function mergeExtraMaps(
  ...maps: Array<Record<string, number> | undefined>
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const map of maps) {
    if (!map) {
      continue;
    }
    for (const [id, value] of Object.entries(map)) {
      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }
      merged[id] = roundCurrency((merged[id] ?? 0) + value);
    }
  }
  return merged;
}

function interestSavedAmount(
  withExtra: DebtPayoffResult,
  baseline: DebtPayoffResult,
): number | null {
  if (
    !withExtra.isReliable ||
    !baseline.isReliable ||
    withExtra.totalInterest == null ||
    baseline.totalInterest == null
  ) {
    return null;
  }
  return roundCurrency(Math.max(0, baseline.totalInterest - withExtra.totalInterest));
}

export function projectDebtPayoff(request: DebtPayoffRequest): DebtPayoffResult {
  const referenceDate = request.referenceDate ?? new Date();
  const strategy = request.strategy;
  const extraMonthlyCents = Math.max(0, toCents(request.extraMonthly ?? 0));
  const customOrder = request.customOrder ?? [];
  const extraByDebtId = request.extraByDebtId ?? {};
  const monthlyBudget =
    request.monthlyBudget != null && Number.isFinite(request.monthlyBudget)
      ? Math.max(0, request.monthlyBudget)
      : null;
  const state = activeDebts(request.debts);
  const minimumPool = state.reduce((total, debt) => total + debt.minimumCents, 0);
  const earmarkedPool = state.reduce(
    (total, debt) => total + Math.max(0, toCents(extraByDebtId[debt.id] ?? 0)),
    0,
  );
  const baseBudgetCents =
    monthlyBudget != null ? toCents(monthlyBudget) : minimumPool + extraMonthlyCents;
  const budgetCents = baseBudgetCents + earmarkedPool;
  const assumptions = assumptionsFor(state, monthlyBudget, minimumPool);
  const emptyOrder = priorityOrder(state, strategy, customOrder).map((debt) => ({
    id: debt.id,
    name: debt.name,
  }));

  if (state.length === 0) {
    return {
      strategy,
      isReliable: true,
      incompleteReason: null,
      assumptions,
      months: 0,
      debtFreeDate: new Date(referenceDate),
      timeLabel: formatPayoffDuration(0),
      totalInterest: 0,
      totalPaid: 0,
      monthlyCommitment: 0,
      order: [],
      payoffMonthByDebtId: {},
      schedule: [],
      milestones: [
        { id: "first-payoff", label: "First debt paid off", monthIndex: null },
        { id: "quarter", label: "25% of debt eliminated", monthIndex: null },
        { id: "half", label: "50% of debt eliminated", monthIndex: null },
        { id: "debt-free", label: "Final debt paid off", monthIndex: 0 },
      ],
    };
  }

  const startingTotal = state.reduce((total, debt) => total + debt.balanceCents, 0);
  const schedule: DebtPayoffMonth[] = [];
  const payoffMonthByDebtId: Record<string, number | null> = {};
  for (const debt of state) {
    payoffMonthByDebtId[debt.id] = null;
  }
  let totalInterestCents = 0;
  let totalPaidCents = 0;
  let months = 0;
  let guard = 0;

  while (
    state.some((debt) => debt.balanceCents > BALANCE_EPSILON_CENTS) &&
    guard < MAX_MONTHS
  ) {
    guard += 1;
    months += 1;
    const monthDate = addMonths(referenceDate, months);
    const starting = new Map(state.map((debt) => [debt.id, debt.balanceCents]));
    const monthOrder = priorityOrder(
      state,
      strategy,
      customOrder,
      (debt) => starting.get(debt.id) ?? 0,
    );
    const interestById = new Map<string, number>();

    for (const debt of state) {
      if (debt.balanceCents <= BALANCE_EPSILON_CENTS) {
        interestById.set(debt.id, 0);
        continue;
      }
      const interest = Math.round((debt.balanceCents * debt.apr) / 1200);
      interestById.set(debt.id, interest);
      debt.balanceCents += interest;
      totalInterestCents += interest;
    }

    let strategyRemaining = baseBudgetCents;
    let earmarkRemaining = earmarkedPool;
    const minimumPaid = new Map<string, number>();
    const extraPaid = new Map<string, number>();
    const pay = (
      debt: WorkingDebt,
      amount: number,
      bucket: Map<string, number>,
      pool: "strategy" | "earmark",
    ) => {
      const poolRemaining = pool === "strategy" ? strategyRemaining : earmarkRemaining;
      const applied = Math.min(Math.max(amount, 0), debt.balanceCents, poolRemaining);
      if (applied <= 0) {
        return 0;
      }
      debt.balanceCents -= applied;
      if (pool === "strategy") {
        strategyRemaining -= applied;
      } else {
        earmarkRemaining -= applied;
      }
      bucket.set(debt.id, (bucket.get(debt.id) ?? 0) + applied);
      totalPaidCents += applied;
      return applied;
    };

    for (const debt of monthOrder) {
      pay(debt, Math.min(debt.minimumCents, debt.balanceCents), minimumPaid, "strategy");
    }

    for (const debt of monthOrder) {
      pay(debt, toCents(extraByDebtId[debt.id] ?? 0), extraPaid, "earmark");
    }

    for (const debt of monthOrder) {
      pay(debt, strategyRemaining, extraPaid, "strategy");
    }

    let extraDebtId: string | null = null;
    let extraDebtAmount = 0;
    for (const [id, amount] of extraPaid) {
      if (amount > extraDebtAmount) {
        extraDebtId = id;
        extraDebtAmount = amount;
      }
    }

    const paidOffDebtIds: string[] = [];
    const lines: DebtMonthLine[] = [];
    for (const debt of state) {
      const startCents = starting.get(debt.id) ?? 0;
      if (startCents <= BALANCE_EPSILON_CENTS && debt.balanceCents <= BALANCE_EPSILON_CENTS) {
        continue;
      }
      const interest = interestById.get(debt.id) ?? 0;
      const minimum = minimumPaid.get(debt.id) ?? 0;
      const extra = extraPaid.get(debt.id) ?? 0;
      const ending = debt.balanceCents;
      if (startCents > BALANCE_EPSILON_CENTS && ending <= BALANCE_EPSILON_CENTS) {
        debt.balanceCents = 0;
        paidOffDebtIds.push(debt.id);
        payoffMonthByDebtId[debt.id] = months;
      }
      lines.push({
        debtId: debt.id,
        name: debt.name,
        startingBalance: fromCents(startCents),
        minimumPayment: fromCents(minimum),
        extraPayment: fromCents(extra),
        principalPaid: fromCents(Math.max(0, minimum + extra - interest)),
        interestCharged: fromCents(interest),
        endingBalance: fromCents(Math.max(debt.balanceCents, 0)),
        receivesExtra: extra > 0,
      });
    }

    const monthStart = lines.reduce((total, line) => total + toCents(line.startingBalance), 0);
    schedule.push({
      index: months,
      label: monthLabel(monthDate),
      startingBalance: fromCents(monthStart),
      minimumPayment: fromCents(lines.reduce((total, line) => total + toCents(line.minimumPayment), 0)),
      extraPayment: fromCents(lines.reduce((total, line) => total + toCents(line.extraPayment), 0)),
      principalPaid: fromCents(lines.reduce((total, line) => total + toCents(line.principalPaid), 0)),
      interestCharged: fromCents(lines.reduce((total, line) => total + toCents(line.interestCharged), 0)),
      endingBalance: fromCents(lines.reduce((total, line) => total + toCents(line.endingBalance), 0)),
      extraDebtId,
      extraDebtName: state.find((debt) => debt.id === extraDebtId)?.name ?? null,
      paidOffDebtIds,
      lines,
    });
  }

  const paidOff = !state.some((debt) => debt.balanceCents > BALANCE_EPSILON_CENTS);
  const isReliable = paidOff && months < MAX_MONTHS && budgetCents > 0;
  const order = Object.entries(payoffMonthByDebtId)
    .filter((entry): entry is [string, number] => entry[1] != null)
    .sort((left, right) => left[1] - right[1])
    .map(([id]) => ({
      id,
      name: state.find((debt) => debt.id === id)?.name ?? emptyOrder.find((item) => item.id === id)?.name ?? "Debt",
    }));
  const quarterTarget = startingTotal * 0.75;
  const halfTarget = startingTotal * 0.5;
  const quarter = schedule.find((month) => toCents(month.endingBalance) <= quarterTarget);
  const half = schedule.find((month) => toCents(month.endingBalance) <= halfTarget);
  const firstPayoff = schedule.find((month) => month.paidOffDebtIds.length > 0);

  return {
    strategy,
    isReliable,
    incompleteReason: isReliable
      ? null
      : "Forecast incomplete. The current payments do not pay these balances off, so a debt-free date would be misleading.",
    assumptions,
    months: isReliable ? months : null,
    debtFreeDate: isReliable ? addMonths(referenceDate, months) : null,
    timeLabel: formatPayoffDuration(isReliable ? months : null),
    totalInterest: isReliable ? fromCents(totalInterestCents) : null,
    totalPaid: isReliable ? fromCents(totalPaidCents) : null,
    monthlyCommitment: fromCents(budgetCents),
    order: order.length > 0 ? order : emptyOrder,
    payoffMonthByDebtId,
    schedule,
    milestones: [
      {
        id: "first-payoff",
        label: "First debt paid off",
        monthIndex: firstPayoff?.index ?? null,
      },
      {
        id: "quarter",
        label: "25% of debt eliminated",
        monthIndex: quarter?.index ?? null,
      },
      {
        id: "half",
        label: "50% of debt eliminated",
        monthIndex: half?.index ?? null,
      },
      {
        id: "debt-free",
        label: "Final debt paid off",
        monthIndex: isReliable ? months : null,
      },
    ],
  };
}

export function weightedAverageApr(debts: PayoffDebt[]): number | null {
  const active = debts.filter((debt) => debt.balance > 0.009);
  const total = active.reduce((sum, debt) => sum + debt.balance, 0);
  if (total <= 0) {
    return null;
  }
  const weighted = active.reduce(
    (sum, debt) => sum + debt.balance * Math.max(debt.interestRate, 0),
    0,
  );
  return roundCurrency(weighted / total);
}

export function buildDebtOverview(
  debts: PayoffDebt[],
  projection: DebtPayoffResult,
): DebtOverview {
  const active = debts.filter((debt) => debt.balance > 0.009);
  return {
    totalBalance: roundCurrency(active.reduce((sum, debt) => sum + debt.balance, 0)),
    totalMinimum: roundCurrency(active.reduce((sum, debt) => sum + Math.max(debt.minimumPayment, 0), 0)),
    weightedApr: weightedAverageApr(debts),
    activeCount: active.length,
    projected: projection,
  };
}

export function compareDebtStrategies(
  request: Omit<DebtPayoffRequest, "strategy"> & {
    customOrder?: string[];
    sharedExtraByDebtId?: Record<string, number>;
  },
): DebtStrategyComparison {
  const sharedExtra = request.sharedExtraByDebtId ?? {};
  const customExtra =
    request.monthlyBudget != null
      ? sharedExtra
      : mergeExtraMaps(sharedExtra, request.extraByDebtId);
  const base = {
    debts: request.debts,
    extraMonthly: request.extraMonthly,
    customOrder: request.customOrder,
    referenceDate: request.referenceDate,
  };
  const snowball = projectDebtPayoff({
    ...base,
    strategy: "snowball",
    monthlyBudget: null,
    extraByDebtId: sharedExtra,
  });
  const avalanche = projectDebtPayoff({
    ...base,
    strategy: "avalanche",
    monthlyBudget: null,
    extraByDebtId: sharedExtra,
  });
  const custom = projectDebtPayoff({
    ...base,
    strategy: "custom",
    monthlyBudget: request.monthlyBudget,
    extraByDebtId: customExtra,
  });
  const snowballBaseline = projectDebtPayoff({
    debts: request.debts,
    strategy: "snowball",
    referenceDate: request.referenceDate,
  });
  const avalancheBaseline = projectDebtPayoff({
    debts: request.debts,
    strategy: "avalanche",
    referenceDate: request.referenceDate,
  });
  const customBaseline = projectDebtPayoff({
    debts: request.debts,
    strategy: "custom",
    customOrder: request.customOrder,
    referenceDate: request.referenceDate,
  });
  const bothReliable = snowball.isReliable && avalanche.isReliable;
  const interestGap =
    bothReliable && snowball.totalInterest != null && avalanche.totalInterest != null
      ? roundCurrency(snowball.totalInterest - avalanche.totalInterest)
      : null;
  const hasApr = request.debts.some((debt) => debt.balance > 0 && debt.interestRate > 0);
  let recommended: "snowball" | "avalanche" | null = null;
  let recommendation =
    "Add an APR above 0% to compare which strategy costs less interest.";
  if (bothReliable && hasApr && interestGap != null) {
    if (interestGap > 0.009) {
      recommended = "avalanche";
      recommendation = `Avalanche costs ${formatDollars(interestGap)} less interest than snowball. Snowball can still help when paying off the smallest balance first makes the plan easier to stick with.`;
    } else if (interestGap < -0.009) {
      recommended = "snowball";
      recommendation = `Snowball costs ${formatDollars(Math.abs(interestGap))} less interest with these balances. That is uncommon, and it is because the smaller balance also carries the higher rate.`;
    } else {
      recommended = "avalanche";
      recommendation =
        "Snowball and avalanche cost the same interest here. Avalanche is the mathematical default when the rates are reliable.";
    }
  } else if (!hasApr) {
    recommendation =
      "Every active APR is 0%, so the interest cost is the same. Snowball pays off the smallest balance first, which can make progress easier to see.";
  } else if (!bothReliable) {
    recommendation =
      "The interest comparison is incomplete because at least one strategy does not pay the balances off.";
  }

  return {
    snowball,
    avalanche,
    custom,
    interestSaved: {
      snowball: interestSavedAmount(snowball, snowballBaseline),
      avalanche: interestSavedAmount(avalanche, avalancheBaseline),
      custom: interestSavedAmount(custom, customBaseline),
    },
    recommended,
    recommendation,
  };
}

function formatDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function debtDoesNotAmortize(debt: PayoffDebt): boolean {
  if (debt.balance <= 0.009) {
    return false;
  }
  const interest = roundCurrency((debt.balance * Math.max(debt.interestRate, 0)) / 1200);
  return debt.minimumPayment <= interest + 0.009;
}

export function buildDebtRecommendations(input: {
  debts: PayoffDebt[];
  comparison: DebtStrategyComparison;
  extraMonthly: number;
  safeToSpend?: number | null;
  monthlyIncome?: number | null;
}): DebtRecommendation[] {
  const notes: DebtRecommendation[] = [];
  const { comparison, debts } = input;
  const baseline = projectDebtPayoff({
    debts,
    strategy: "avalanche",
    extraMonthly: 0,
  });
  const plusFifty = projectDebtPayoff({
    debts,
    strategy: "avalanche",
    extraMonthly: 50,
  });
  if (
    baseline.isReliable &&
    plusFifty.isReliable &&
    baseline.totalInterest != null &&
    plusFifty.totalInterest != null &&
    baseline.totalInterest - plusFifty.totalInterest >= 1
  ) {
    notes.push({
      id: "extra-50",
      title: "An extra $50 a month reduces interest",
      detail: `On the avalanche plan, $50 more each month saves ${formatDollars(baseline.totalInterest - plusFifty.totalInterest)} of interest and finishes ${Math.max(0, (baseline.months ?? 0) - (plusFifty.months ?? 0))} months sooner. This is a preview, not a saved payment.`,
    });
  }
  if (
    comparison.recommended === "avalanche" &&
    comparison.snowball.totalInterest != null &&
    comparison.avalanche.totalInterest != null &&
    comparison.snowball.totalInterest - comparison.avalanche.totalInterest >= 1
  ) {
    notes.push({
      id: "avalanche-cheaper",
      title: "Avalanche saves more interest than snowball",
      detail: comparison.recommendation,
    });
  }
  for (const debt of debts) {
    if (debt.balance <= 0 || debt.interestRate < 15 || debt.accountType !== "credit_card") {
      continue;
    }
    const monthly = roundCurrency((debt.balance * debt.interestRate) / 1200);
    if (monthly < 1) {
      continue;
    }
    notes.push({
      id: `apr-${debt.id}`,
      title: `${debt.name} is a high-APR card`,
      detail: `At ${debt.interestRate}% APR, the current balance adds about ${formatDollars(monthly)} of interest this month before any payment.`,
    });
  }
  for (const debt of debts) {
    if (!debtDoesNotAmortize(debt)) {
      continue;
    }
    notes.push({
      id: `amortize-${debt.id}`,
      title: `${debt.name} does not pay down on its minimum`,
      detail: "The minimum payment does not cover this month's interest, so the balance can grow. The debt-free forecast stays incomplete until the payment is larger than the interest.",
    });
  }
  const commitment = comparison.avalanche.monthlyCommitment;
  const extra = Math.max(0, input.extraMonthly);
  if (
    input.monthlyIncome != null &&
    input.monthlyIncome > 0 &&
    input.safeToSpend != null &&
    extra > input.safeToSpend + 0.009
  ) {
    notes.push({
      id: "cash-short",
      title: "The extra payment is larger than available cash",
      detail: `The preview adds ${formatDollars(extra)} on top of minimums. Safe to Spend is ${formatDollars(input.safeToSpend)} after the minimums already counted there. The combined debt commitment in this preview is ${formatDollars(commitment)}.`,
    });
  }
  return notes;
}

export function payoffDebtsFromFinance(data: Pick<FinanceData, "debts">): PayoffDebt[] {
  return (data.debts ?? []).map((debt: Debt) => ({
    id: debt.id,
    name: debt.name,
    balance: debt.balance,
    interestRate: debt.interestRate,
    minimumPayment: debt.minimumPayment,
    accountType: debt.accountType,
  }));
}
