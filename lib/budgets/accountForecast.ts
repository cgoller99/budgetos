/**
 * Account balance projections from Income Plan links.
 * Separates contribution totals (planned additions) from projected ending balances.
 * Spending / bills / rent purposes are not treated as permanent savings.
 */
import { weeklySavingsFromPaycheckAmount } from "@/lib/finance/goalForecast";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import type { Account, FinanceData } from "@/lib/finance/types";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";
import { isBalanceStale } from "@/lib/budgets/accountDisplay";
import {
  buildPaycheckBreakdown,
  type PaycheckBreakdownRow,
} from "@/lib/budgets/paycheckBreakdown";

/** Approximate calendar months without treating a month as exactly 4 weeks. */
export const FORECAST_HORIZONS = [
  { weeks: 4.33, id: "1m", label: "1 month", shortLabel: "1 mo" },
  { weeks: 13, id: "3m", label: "3 months", shortLabel: "3 mo" },
  { weeks: 26, id: "6m", label: "6 months", shortLabel: "6 mo" },
  { weeks: 52, id: "12m", label: "12 months", shortLabel: "12 mo" },
] as const;

export type ForecastHorizonId = (typeof FORECAST_HORIZONS)[number]["id"];
export type ForecastHorizonWeeks = (typeof FORECAST_HORIZONS)[number]["weeks"];

/** @deprecated Prefer FORECAST_HORIZONS — kept for tests that assert 13/26 week totals. */
export const FORECAST_HORIZONS_WEEKS = [4, 13, 26, 52] as const;

export type ForecastPurposeKind =
  | "accumulate"
  | "spend"
  | "bill_fund"
  | "rent_reserve"
  | "other";

export type PurposeContribution = {
  allocationId: string;
  name: string;
  kind: PaycheckBreakdownRow["kind"];
  purposeKind: ForecastPurposeKind;
  weeklyAddition: number;
  /** Cumulative planned contributions at each horizon (not ending balances). */
  contributionsByHorizon: ContributionByHorizon;
  purposeNote: string | null;
};

export type AccountHorizonProjection = {
  weeks: number;
  id: ForecastHorizonId;
  label: string;
  projectedBalance: number;
  plannedDeposits: number;
  plannedWithdrawals: number;
  plannedContributions: number;
};

export type LinkedAccountForecast = {
  accountId: string;
  accountName: string;
  accountType: Account["type"];
  currentBalance: number;
  lastSyncedAt: string | null;
  balanceSource: string;
  weeklyPlannedDeposits: number;
  weeklyPlannedWithdrawals: number;
  weeklyNet: number;
  horizons: AccountHorizonProjection[];
  purposes: PurposeContribution[];
  isSharedDestination: boolean;
  excludesMarketPerformance: boolean;
  /** True when bank sync is missing or older than 7 days. */
  isStale: boolean;
  estimateDisclaimer: string;
};

export type AllocationContributionRow = {
  allocationId: string;
  name: string;
  icon: string;
  accountId: string | null;
  accountName: string | null;
  purposeKind: ForecastPurposeKind;
  weeklyAmount: number;
  amountPerPaycheck: number;
  contributionsByHorizon: ContributionByHorizon;
};

export type AccountForecastBundle = {
  accounts: LinkedAccountForecast[];
  /** Purpose-level planned contribution totals (savings/rent/etc.), all horizons. */
  contributionRows: AllocationContributionRow[];
  unlinkedRows: PaycheckBreakdownRow[];
  explanation: string;
};

export type WhatIfAllocationOverride = {
  allocationId: string;
  amountPerPaycheck: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function weeklyFromPaycheck(
  amount: number,
  paySchedule: IncomePlanSchedule | null,
  customIntervalDays: number | null | undefined,
): number {
  if (amount <= 0 || !paySchedule) return 0;
  return (
    weeklySavingsFromPaycheckAmount(amount, paySchedule, customIntervalDays) ?? 0
  );
}

export type ContributionByHorizon = {
  "1m": number;
  "3m": number;
  "6m": number;
  "12m": number;
  /** Exact week multiples used by regression tests (4/13/26/52). */
  4: number;
  13: number;
  26: number;
  52: number;
};

function contributionTable(weekly: number): ContributionByHorizon {
  return {
    "1m": round(weekly * 4.33),
    "3m": round(weekly * 13),
    "6m": round(weekly * 26),
    "12m": round(weekly * 52),
    4: round(weekly * 4),
    13: round(weekly * 13),
    26: round(weekly * 26),
    52: round(weekly * 52),
  };
}

/**
 * Classify how an allocation should affect account projections.
 * Accumulate = savings. Spend / bills / rent use matching outflows.
 */
export function classifyForecastPurpose(
  row: Pick<PaycheckBreakdownRow, "name" | "kind" | "goalId" | "billId">,
): ForecastPurposeKind {
  const name = row.name.toLowerCase();
  if (/rent/.test(name)) return "rent_reserve";
  if (row.kind === "bill" || /^bills?\b/.test(name)) return "bill_fund";
  if (
    row.kind === "remaining" ||
    row.kind === "flexible" ||
    /spend|personal|discretionary|flexible/.test(name)
  ) {
    return "spend";
  }
  if (row.kind === "goal" || row.goalId || /saving|invest|emergency|vacation|house/.test(name)) {
    return "accumulate";
  }
  return "other";
}

function weeklyBillWithdrawalsByAccount(data: FinanceData): Map<string, number> {
  const byAccount = new Map<string, number>();
  for (const bill of data.bills ?? []) {
    const accountId = bill.paymentAccountId;
    if (!accountId || bill.amount <= 0) continue;
    const frequency = bill.frequency ?? "monthly";
    let weekly = 0;
    switch (frequency) {
      case "weekly":
        weekly = bill.amount;
        break;
      case "biweekly":
        weekly = bill.amount / 2;
        break;
      case "yearly":
        weekly = bill.amount / (4.33 * 12);
        break;
      case "quarterly":
        weekly = bill.amount / (4.33 * 3);
        break;
      case "monthly":
      default:
        weekly = bill.amount / 4.33;
        break;
    }
    byAccount.set(accountId, round((byAccount.get(accountId) ?? 0) + weekly));
  }
  return byAccount;
}

/** Match rent-named bills (any payment account) to a weekly rent obligation. */
function weeklyRentObligation(data: FinanceData): number {
  let total = 0;
  for (const bill of data.bills ?? []) {
    if (!/rent/i.test(bill.name) && !/rent/i.test(bill.category ?? "")) continue;
    if (bill.amount <= 0) continue;
    const frequency = bill.frequency ?? "monthly";
    switch (frequency) {
      case "weekly":
        total += bill.amount;
        break;
      case "biweekly":
        total += bill.amount / 2;
        break;
      default:
        total += bill.amount / 4.33;
        break;
    }
  }
  return round(total);
}

function balanceSourceLabel(account: Account): string {
  if (account.isPlaidLinked || account.lastSyncedAt) {
    return account.lastSyncedAt
      ? `Bank sync · ${account.lastSyncedAt}`
      : "Bank-linked balance";
  }
  return "Manual balance";
}

function formatSyncShort(iso: string | null): string {
  if (!iso) return "manual / unknown date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "manual / unknown date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function projectHorizons(
  currentBalance: number,
  weeklyDeposits: number,
  weeklyWithdrawals: number,
  weeklyContributions: number,
): AccountHorizonProjection[] {
  const weeklyNet = weeklyDeposits - weeklyWithdrawals;
  return FORECAST_HORIZONS.map((horizon) => ({
    weeks: horizon.weeks,
    id: horizon.id,
    label: horizon.label,
    projectedBalance: round(currentBalance + weeklyNet * horizon.weeks),
    plannedDeposits: round(weeklyDeposits * horizon.weeks),
    plannedWithdrawals: round(weeklyWithdrawals * horizon.weeks),
    plannedContributions: round(weeklyContributions * horizon.weeks),
  }));
}

export function buildAccountForecasts(
  data: FinanceData,
  options?: {
    referenceDate?: Date;
    whatIfOverrides?: WhatIfAllocationOverride[];
    horizonWeeks?: ForecastHorizonWeeks;
  },
): AccountForecastBundle {
  const breakdown = buildPaycheckBreakdown(data, options?.referenceDate);
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  const paySchedule = plan?.paySchedule ?? null;
  const customIntervalDays = plan?.customIntervalDays ?? null;
  const overrideMap = new Map(
    (options?.whatIfOverrides ?? []).map((item) => [
      item.allocationId,
      item.amountPerPaycheck,
    ]),
  );

  const billWithdrawals = weeklyBillWithdrawalsByAccount(data);
  const rentWeekly = weeklyRentObligation(data);
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));

  type PurposeAcc = {
    allocationId: string;
    name: string;
    icon: string;
    kind: PaycheckBreakdownRow["kind"];
    purposeKind: ForecastPurposeKind;
    weeklyAddition: number;
    amountPerPaycheck: number;
    purposeNote: string | null;
    accountId: string | null;
    accountName: string | null;
  };

  const depositsByAccount = new Map<string, PurposeAcc[]>();
  const contributionRows: AllocationContributionRow[] = [];
  const unlinkedRows: PaycheckBreakdownRow[] = [];

  for (const row of breakdown.rows) {
    const override = overrideMap.get(row.allocationId);
    const amountPerPaycheck =
      override != null ? round(Math.max(0, override)) : row.amountPerPaycheck;
    const weekly = weeklyFromPaycheck(
      amountPerPaycheck,
      paySchedule,
      customIntervalDays,
    );
    const purposeKind = classifyForecastPurpose(row);
    const purposeNote =
      row.purposeNote ??
      (purposeKind === "spend"
        ? "Spending allocation — projected as spent, not saved."
        : purposeKind === "bill_fund"
          ? "Bills fund — deposits offset expected bill payments."
          : purposeKind === "rent_reserve"
            ? "Rent reserve — contributions park for rent; rent payments reduce the balance when known."
            : null);

    const contrib: AllocationContributionRow = {
      allocationId: row.allocationId,
      name: row.name,
      icon: row.icon,
      accountId: row.accountId,
      accountName: row.accountName,
      purposeKind,
      weeklyAmount: round(weekly),
      amountPerPaycheck,
      contributionsByHorizon: contributionTable(weekly),
    };
    contributionRows.push(contrib);

    if (!row.accountId || !accountsById.has(row.accountId)) {
      unlinkedRows.push({
        ...row,
        amountPerPaycheck,
        amountWeekly: round(weekly),
        percentOfPaycheck:
          breakdown.paycheckAmount > 0
            ? round((amountPerPaycheck / breakdown.paycheckAmount) * 100)
            : 0,
        purposeNote,
      });
      continue;
    }

    const list = depositsByAccount.get(row.accountId) ?? [];
    list.push({
      allocationId: row.allocationId,
      name: row.name,
      icon: row.icon,
      kind: row.kind,
      purposeKind,
      weeklyAddition: round(weekly),
      amountPerPaycheck,
      purposeNote,
      accountId: row.accountId,
      accountName: row.accountName,
    });
    depositsByAccount.set(row.accountId, list);
  }

  const accounts: LinkedAccountForecast[] = [];
  let rentAssigned = false;

  for (const [accountId, purposes] of depositsByAccount) {
    const account = accountsById.get(accountId);
    if (!account) continue;

    const weeklyPlannedDeposits = round(
      purposes.reduce((sum, item) => sum + item.weeklyAddition, 0),
    );

    // Known bill withdrawals from this payment account.
    let weeklyPlannedWithdrawals = billWithdrawals.get(accountId) ?? 0;

    // Spending / flexible: treat planned inflow as expected outflow (not savings).
    const spendWeekly = round(
      purposes
        .filter((item) => item.purposeKind === "spend")
        .reduce((sum, item) => sum + item.weeklyAddition, 0),
    );
    weeklyPlannedWithdrawals = round(weeklyPlannedWithdrawals + spendWeekly);

    // Bills fund: if no payment-account bills are linked, assume the bills
    // allocation is spent on obligations (net ~0), not accumulated.
    const billFundWeekly = round(
      purposes
        .filter((item) => item.purposeKind === "bill_fund")
        .reduce((sum, item) => sum + item.weeklyAddition, 0),
    );
    if (billFundWeekly > 0 && (billWithdrawals.get(accountId) ?? 0) <= 0) {
      weeklyPlannedWithdrawals = round(weeklyPlannedWithdrawals + billFundWeekly);
    }

    // Rent reserve: apply rent bill when known; otherwise do not invent endless
    // accumulation — assume reserve is drawn for rent at the funding rate.
    const rentPurposeWeekly = round(
      purposes
        .filter((item) => item.purposeKind === "rent_reserve")
        .reduce((sum, item) => sum + item.weeklyAddition, 0),
    );
    if (rentPurposeWeekly > 0) {
      if (rentWeekly > 0 && !rentAssigned) {
        weeklyPlannedWithdrawals = round(weeklyPlannedWithdrawals + rentWeekly);
        rentAssigned = true;
      } else if (rentWeekly <= 0) {
        weeklyPlannedWithdrawals = round(
          weeklyPlannedWithdrawals + rentPurposeWeekly,
        );
      }
    }

    const accumulateWeekly = round(
      purposes
        .filter((item) => item.purposeKind === "accumulate" || item.purposeKind === "other")
        .reduce((sum, item) => sum + item.weeklyAddition, 0),
    );

    const weeklyNet = round(weeklyPlannedDeposits - weeklyPlannedWithdrawals);
    const horizons = projectHorizons(
      account.balance,
      weeklyPlannedDeposits,
      weeklyPlannedWithdrawals,
      accumulateWeekly + rentPurposeWeekly,
    );

    const purposeReserves: PurposeContribution[] = purposes.map((purpose) => ({
      allocationId: purpose.allocationId,
      name: purpose.name,
      kind: purpose.kind,
      purposeKind: purpose.purposeKind,
      weeklyAddition: purpose.weeklyAddition,
      contributionsByHorizon: contributionTable(purpose.weeklyAddition),
      purposeNote: purpose.purposeNote,
    }));

    const excludesMarketPerformance =
      account.type === "investment" || account.type === "crypto";

    const hasSpendOrBills = purposes.some(
      (item) =>
        item.purposeKind === "spend" ||
        item.purposeKind === "bill_fund" ||
        item.purposeKind === "rent_reserve",
    );

    const stale = isBalanceStale(account.lastSyncedAt ?? null);
    accounts.push({
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      currentBalance: round(account.balance),
      lastSyncedAt: account.lastSyncedAt ?? null,
      balanceSource: `${balanceSourceLabel(account)} · as of ${formatSyncShort(account.lastSyncedAt ?? null)}`,
      weeklyPlannedDeposits,
      weeklyPlannedWithdrawals: round(weeklyPlannedWithdrawals),
      weeklyNet,
      horizons,
      purposes: purposeReserves,
      isSharedDestination: purposes.length > 1,
      excludesMarketPerformance,
      isStale: stale,
      estimateDisclaimer: excludesMarketPerformance
        ? "Estimate from planned cash deposits only — not market performance."
        : hasSpendOrBills
          ? "Future balance = actual money + planned deposits − expected spending/bills/rent. Not a guarantee."
          : "Future balance = actual money + planned deposits − known withdrawals. Not a guarantee.",
    });
  }

  accounts.sort((a, b) => a.accountName.localeCompare(b.accountName));

  return {
    accounts,
    contributionRows,
    unlinkedRows,
    explanation:
      "Contribution totals are planned paycheck additions over each horizon. Projected ending balances start from posted account balances and subtract expected spending, bills, and rent — they are estimates, not guarantees.",
  };
}

export function compareWhatIfForecasts(
  data: FinanceData,
  overrides: WhatIfAllocationOverride[],
  horizonWeeks: ForecastHorizonWeeks = 13,
): {
  current: AccountForecastBundle;
  proposed: AccountForecastBundle;
  horizonWeeks: ForecastHorizonWeeks;
} {
  return {
    current: buildAccountForecasts(data, { horizonWeeks }),
    proposed: buildAccountForecasts(data, {
      whatIfOverrides: overrides,
      horizonWeeks,
    }),
    horizonWeeks,
  };
}

export function summarizeWhatIfPaycheck(
  data: FinanceData,
  overrides: WhatIfAllocationOverride[],
): { paycheckAmount: number; totalAllocated: number; unallocated: number } {
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  if (!plan?.isActive) {
    return { paycheckAmount: 0, totalAllocated: 0, unallocated: 0 };
  }
  const overrideMap = new Map(
    overrides.map((item) => [item.allocationId, item.amountPerPaycheck]),
  );
  const resolved = resolveAllocationAmounts({
    paycheckAmount: plan.paycheckAmount,
    allocations: plan.allocations.map((allocation) => {
      const override = overrideMap.get(allocation.id);
      if (override == null || allocation.isRemainingBalance) {
        return allocation;
      }
      return {
        ...allocation,
        amount: override,
        percentage: null,
        allocationType: "fixed" as const,
      };
    }),
  });
  const totalAllocated = round(
    resolved.reduce((sum, item) => sum + item.amount, 0),
  );
  return {
    paycheckAmount: round(plan.paycheckAmount),
    totalAllocated,
    unallocated: round(Math.max(0, plan.paycheckAmount - totalAllocated)),
  };
}
