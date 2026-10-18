/**
 * Account balance projections from Income Plan links.
 * Uses posted balances + planned future deposits/withdrawals only.
 * Does not invent market returns or treat planned rows as completed cash.
 */
import { weeklySavingsFromPaycheckAmount } from "@/lib/finance/goalForecast";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import type { Account, FinanceData } from "@/lib/finance/types";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";
import {
  buildPaycheckBreakdown,
  type PaycheckBreakdownRow,
} from "@/lib/budgets/paycheckBreakdown";

export const FORECAST_HORIZONS_WEEKS = [4, 13, 26, 52] as const;
export type ForecastHorizonWeeks = (typeof FORECAST_HORIZONS_WEEKS)[number];

export type PurposeReserve = {
  allocationId: string;
  name: string;
  kind: PaycheckBreakdownRow["kind"];
  weeklyAddition: number;
  /** Cumulative planned contributions at the selected horizon — not a separate cash pile. */
  plannedReserveAtHorizon: number;
  purposeNote: string | null;
};

export type AccountHorizonProjection = {
  weeks: ForecastHorizonWeeks;
  projectedBalance: number;
  plannedDeposits: number;
  plannedWithdrawals: number;
};

export type LinkedAccountForecast = {
  accountId: string;
  accountName: string;
  accountType: Account["type"];
  currentBalance: number;
  lastSyncedAt: string | null;
  weeklyPlannedDeposits: number;
  weeklyPlannedWithdrawals: number;
  weeklyNet: number;
  horizons: AccountHorizonProjection[];
  purposes: PurposeReserve[];
  /** True when more than one allocation purpose shares this destination. */
  isSharedDestination: boolean;
  /** Investment accounts: projections are cash deposits only. */
  excludesMarketPerformance: boolean;
  estimateDisclaimer: string;
};

export type AccountForecastBundle = {
  accounts: LinkedAccountForecast[];
  unlinkedRows: PaycheckBreakdownRow[];
  explanation: string;
};

export type WhatIfAllocationOverride = {
  allocationId: string;
  /** Proposed per-paycheck amount (replaces saved amount for simulation). */
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

/**
 * Bill withdrawals charged against a payment account, converted to a weekly rate.
 * Only bills with a known paymentAccountId are counted — avoids inventing drains.
 */
function weeklyBillWithdrawalsByAccount(
  data: FinanceData,
): Map<string, number> {
  const byAccount = new Map<string, number>();
  for (const bill of data.bills ?? []) {
    const accountId = bill.paymentAccountId;
    if (!accountId || bill.amount <= 0) continue;
    // Approximate weekly from monthly-ish bill amount using 4.33 weeks/month.
    // Prefer frequency when present on bill schedule.
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
        // Avoid treating a calendar month as exactly four weeks.
        weekly = bill.amount / 4.33;
        break;
    }
    byAccount.set(accountId, round((byAccount.get(accountId) ?? 0) + weekly));
  }
  return byAccount;
}

function projectHorizons(
  currentBalance: number,
  weeklyDeposits: number,
  weeklyWithdrawals: number,
): AccountHorizonProjection[] {
  const weeklyNet = weeklyDeposits - weeklyWithdrawals;
  return FORECAST_HORIZONS_WEEKS.map((weeks) => {
    const plannedDeposits = round(weeklyDeposits * weeks);
    const plannedWithdrawals = round(weeklyWithdrawals * weeks);
    return {
      weeks,
      projectedBalance: round(currentBalance + weeklyNet * weeks),
      plannedDeposits,
      plannedWithdrawals,
    };
  });
}

/**
 * Build linked-account forecasts from the active Income Plan.
 * Shared destinations get one combined balance forecast plus purpose-level reserves
 * that do not invent a second balance.
 */
export function buildAccountForecasts(
  data: FinanceData,
  options?: {
    referenceDate?: Date;
    /** What-If overrides — simulation only; never mutates balances. */
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
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));

  /** Per-account deposit contributions from allocations (by purpose). */
  type PurposeAcc = {
    allocationId: string;
    name: string;
    kind: PaycheckBreakdownRow["kind"];
    weeklyAddition: number;
    purposeNote: string | null;
  };
  const depositsByAccount = new Map<string, PurposeAcc[]>();
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

    if (!row.accountId || !accountsById.has(row.accountId)) {
      unlinkedRows.push({
        ...row,
        amountPerPaycheck,
        amountWeekly: round(weekly),
        percentOfPaycheck:
          breakdown.paycheckAmount > 0
            ? round((amountPerPaycheck / breakdown.paycheckAmount) * 100)
            : 0,
      });
      continue;
    }

    // Remaining / flexible spending linked to an account is still a planned parking
    // of paycheck dollars — count as deposit for projection, not as an expense.
    const list = depositsByAccount.get(row.accountId) ?? [];
    list.push({
      allocationId: row.allocationId,
      name: row.name,
      kind: row.kind,
      weeklyAddition: round(weekly),
      purposeNote: row.purposeNote,
    });
    depositsByAccount.set(row.accountId, list);
  }

  // Also include accounts that only have bill withdrawals and no allocation link,
  // only when they appear as payment accounts for linked bill allocations — skip
  // orphan bill-only accounts to keep the Budgets dashboard focused.

  const accounts: LinkedAccountForecast[] = [];
  for (const [accountId, purposes] of depositsByAccount) {
    const account = accountsById.get(accountId);
    if (!account) continue;

    const weeklyPlannedDeposits = round(
      purposes.reduce((sum, item) => sum + item.weeklyAddition, 0),
    );
    // Withdrawals: known bills paid from this account. Do not subtract allocation
    // amounts again — those are destination deposits (internal transfer planning).
    const weeklyPlannedWithdrawals = billWithdrawals.get(accountId) ?? 0;
    const weeklyNet = round(weeklyPlannedDeposits - weeklyPlannedWithdrawals);
    const horizons = projectHorizons(
      account.balance,
      weeklyPlannedDeposits,
      weeklyPlannedWithdrawals,
    );
    const horizonWeeks = options?.horizonWeeks ?? 13;
    const purposeReserves: PurposeReserve[] = purposes.map((purpose) => ({
      allocationId: purpose.allocationId,
      name: purpose.name,
      kind: purpose.kind,
      weeklyAddition: purpose.weeklyAddition,
      plannedReserveAtHorizon: round(purpose.weeklyAddition * horizonWeeks),
      purposeNote: purpose.purposeNote,
    }));

    const excludesMarketPerformance =
      account.type === "investment" || account.type === "crypto";

    accounts.push({
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      currentBalance: round(account.balance),
      lastSyncedAt: account.lastSyncedAt ?? null,
      weeklyPlannedDeposits,
      weeklyPlannedWithdrawals: round(weeklyPlannedWithdrawals),
      weeklyNet,
      horizons,
      purposes: purposeReserves,
      isSharedDestination: purposes.length > 1,
      excludesMarketPerformance,
      estimateDisclaimer: excludesMarketPerformance
        ? "Estimate from planned cash deposits only — not market performance."
        : "Estimate from current balance plus planned deposits minus known bill withdrawals. Not a guarantee.",
    });
  }

  accounts.sort((a, b) => a.accountName.localeCompare(b.accountName));

  return {
    accounts,
    unlinkedRows,
    explanation:
      "Projections start from posted account balances. Planned Income Plan contributions are future deposits until confirmed — they are not double-counted as cash today. Shared destinations show one account forecast plus purpose-level reserves without inventing a second balance.",
  };
}

/**
 * Simulate What-If paycheck amounts against the same forecast engine.
 * Returns current vs proposed account projections for the chosen horizon.
 */
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

/**
 * Resolve allocation amounts for a draft What-If plan (for save preview totals).
 */
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
