/**
 * Account balance projections from Income Plan links + real cash outflows.
 * Uses accountCashflow for bills, debts, paycheck, rent, and recurring charges.
 */
import { weeklySavingsFromPaycheckAmount } from "@/lib/finance/goalForecast";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import type { Account, FinanceData } from "@/lib/finance/types";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";
import { isBalanceStale } from "@/lib/budgets/accountDisplay";
import {
  buildAccountCashflows,
  classifyForecastPurpose,
  type AccountCashflowLine,
  type ForecastPurposeKind,
} from "@/lib/budgets/accountCashflow";
import {
  buildPaycheckBreakdown,
  type PaycheckBreakdownRow,
} from "@/lib/budgets/paycheckBreakdown";

export { classifyForecastPurpose };
export type { ForecastPurposeKind };

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

export type ContributionByHorizon = {
  "1m": number;
  "3m": number;
  "6m": number;
  "12m": number;
  4: number;
  13: number;
  26: number;
  52: number;
};

export type PurposeContribution = {
  allocationId: string;
  name: string;
  kind: PaycheckBreakdownRow["kind"];
  purposeKind: ForecastPurposeKind;
  weeklyAddition: number;
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
  balanceKind: "available" | "ledger" | "manual";
  lastSyncedAt: string | null;
  balanceSource: string;
  weeklyPlannedDeposits: number;
  weeklyPlannedWithdrawals: number;
  weeklyNet: number;
  horizons: AccountHorizonProjection[];
  purposes: PurposeContribution[];
  upcomingWithdrawals: AccountCashflowLine[];
  isSharedDestination: boolean;
  excludesMarketPerformance: boolean;
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

  // Apply What-If overrides into a synthetic FinanceData clone for cashflow.
  const cashflowData: FinanceData =
    overrideMap.size > 0 && plan
      ? {
          ...data,
          incomePlan: {
            ...plan,
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
          },
        }
      : data;

  const cashflows = buildAccountCashflows(cashflowData);
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));

  const contributionRows: AllocationContributionRow[] = [];
  const unlinkedRows: PaycheckBreakdownRow[] = [];
  const purposesByAccount = new Map<
    string,
    Array<{
      allocationId: string;
      name: string;
      kind: PaycheckBreakdownRow["kind"];
      purposeKind: ForecastPurposeKind;
      weeklyAddition: number;
      purposeNote: string | null;
    }>
  >();

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

    contributionRows.push({
      allocationId: row.allocationId,
      name: row.name,
      icon: row.icon,
      accountId: row.accountId,
      accountName: row.accountName,
      purposeKind,
      weeklyAmount: round(weekly),
      amountPerPaycheck,
      contributionsByHorizon: contributionTable(weekly),
    });

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

    const list = purposesByAccount.get(row.accountId) ?? [];
    list.push({
      allocationId: row.allocationId,
      name: row.name,
      kind: row.kind,
      purposeKind,
      weeklyAddition: round(weekly),
      purposeNote,
    });
    purposesByAccount.set(row.accountId, list);
  }

  // Include every account that has cashflow activity (not only allocation destinations).
  const accountIds = new Set<string>([
    ...purposesByAccount.keys(),
    ...cashflows.keys(),
  ]);

  const accounts: LinkedAccountForecast[] = [];
  for (const accountId of accountIds) {
    const account = accountsById.get(accountId);
    if (!account || account.isHidden || account.archivedAt) continue;
    if (account.type === "credit_card") continue;

    const cashflow = cashflows.get(accountId);
    const purposes = purposesByAccount.get(accountId) ?? [];
    const weeklyPlannedDeposits = cashflow?.weeklyInflows ?? 0;
    const weeklyPlannedWithdrawals = cashflow?.weeklyOutflows ?? 0;
    const accumulateWeekly = round(
      purposes
        .filter(
          (item) =>
            item.purposeKind === "accumulate" || item.purposeKind === "other",
        )
        .reduce((sum, item) => sum + item.weeklyAddition, 0),
    );
    const rentPurposeWeekly = round(
      purposes
        .filter((item) => item.purposeKind === "rent_reserve")
        .reduce((sum, item) => sum + item.weeklyAddition, 0),
    );

    const starting = cashflow?.starting ?? {
      amount: round(account.availableBalance ?? account.balance),
      kind: account.availableBalance != null ? ("available" as const) : ("ledger" as const),
      label: "Account balance",
    };

    const horizons = projectHorizons(
      starting.amount,
      weeklyPlannedDeposits,
      weeklyPlannedWithdrawals,
      accumulateWeekly + rentPurposeWeekly,
    );

    const excludesMarketPerformance =
      account.type === "investment" || account.type === "crypto";
    const stale = isBalanceStale(account.lastSyncedAt ?? null);
    const hasRealOutflows = (cashflow?.upcomingWithdrawals.length ?? 0) > 0;

    accounts.push({
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      currentBalance: starting.amount,
      balanceKind: starting.kind,
      lastSyncedAt: account.lastSyncedAt ?? null,
      balanceSource: `${starting.label} · as of ${formatSyncShort(account.lastSyncedAt ?? null)}`,
      weeklyPlannedDeposits,
      weeklyPlannedWithdrawals: round(weeklyPlannedWithdrawals),
      weeklyNet: round(weeklyPlannedDeposits - weeklyPlannedWithdrawals),
      horizons,
      purposes: purposes.map((purpose) => ({
        allocationId: purpose.allocationId,
        name: purpose.name,
        kind: purpose.kind,
        purposeKind: purpose.purposeKind,
        weeklyAddition: purpose.weeklyAddition,
        contributionsByHorizon: contributionTable(purpose.weeklyAddition),
        purposeNote: purpose.purposeNote,
      })),
      upcomingWithdrawals: cashflow?.upcomingWithdrawals ?? [],
      isSharedDestination: purposes.length > 1,
      excludesMarketPerformance,
      isStale: stale,
      estimateDisclaimer: excludesMarketPerformance
        ? "Estimate from planned cash deposits only — not market performance."
        : hasRealOutflows
          ? "Future balance = actual money + planned in − bills, rent, debt, spending, and other known withdrawals. Not a guarantee."
          : "Future balance = actual money + planned deposits − known withdrawals. Not a guarantee.",
    });
  }

  accounts.sort((a, b) => a.accountName.localeCompare(b.accountName));

  return {
    accounts,
    contributionRows,
    unlinkedRows,
    explanation:
      "Projections start from available/ledger balances, add planned paycheck pieces, and subtract recurring bills, rent, debt minimums, spending, and detected recurring charges. Internal transfers are not counted as expenses.",
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
