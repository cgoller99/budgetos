/**
 * Per-account cashflow for Budgets projections.
 * Combines Income Plan, bills, debts, paycheck deposit, and detected recurring
 * withdrawals. Transfers between own accounts are not treated as expenses.
 */
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { weeklySavingsFromPaycheckAmount } from "@/lib/finance/goalForecast";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import type { Account, Debt, FinanceData } from "@/lib/finance/types";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import { detectRecurringBillCandidatesFromFinanceData } from "@/lib/plaid/recurringBillDetection";
import {
  getDisplayCategory,
  isTransferDisplayCategory,
} from "@/lib/transactions/categoryPresentation";

export type ForecastPurposeKind =
  | "accumulate"
  | "spend"
  | "bill_fund"
  | "rent_reserve"
  | "other";

export type CashflowConfidence = "confirmed" | "estimated";

export type CashflowLineKind =
  | "paycheck"
  | "allocation_in"
  | "transfer_out"
  | "bill"
  | "rent"
  | "subscription"
  | "debt"
  | "recurring"
  | "spending"
  | "other";

export type AccountCashflowLine = {
  id: string;
  name: string;
  kind: CashflowLineKind;
  /** Positive = deposit, negative = withdrawal (weekly rate). */
  weeklyAmount: number;
  confidence: CashflowConfidence;
  detail: string;
};

export type AccountStartingBalance = {
  amount: number;
  /** available | ledger | manual */
  kind: "available" | "ledger" | "manual";
  label: string;
};

export type AccountCashflow = {
  accountId: string;
  starting: AccountStartingBalance;
  lines: AccountCashflowLine[];
  weeklyInflows: number;
  weeklyOutflows: number;
  weeklyNet: number;
  upcomingWithdrawals: AccountCashflowLine[];
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toWeekly(amount: number, frequency?: string | null): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return round(toMonthlyAmount(amount, frequency ?? "monthly") / 4.33);
}

function namesMatch(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function resolveStartingBalance(account: Account): AccountStartingBalance {
  if (
    account.availableBalance != null &&
    Number.isFinite(account.availableBalance)
  ) {
    return {
      amount: round(account.availableBalance),
      kind: "available",
      label: "Available balance (bank)",
    };
  }
  if (account.isPlaidLinked || account.lastSyncedAt) {
    return {
      amount: round(account.balance),
      kind: "ledger",
      label: "Ledger balance (bank)",
    };
  }
  return {
    amount: round(account.balance),
    kind: "manual",
    label: "Manual balance",
  };
}

function billKind(bill: { name: string; category?: string | null }): CashflowLineKind {
  const hay = `${bill.name} ${bill.category ?? ""}`.toLowerCase();
  if (/rent/.test(hay)) return "rent";
  if (/subscription|prime|netflix|spotify|hulu|cursor|software/.test(hay)) {
    return "subscription";
  }
  return "bill";
}

/**
 * Classify how an Income Plan allocation should affect account projections.
 */
export function classifyForecastPurpose(row: {
  name: string;
  kind: string;
  goalId?: string | null;
  billId?: string | null;
}): ForecastPurposeKind {
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
  if (
    row.kind === "goal" ||
    row.goalId ||
    /saving|invest|emergency|vacation|house/.test(name)
  ) {
    return "accumulate";
  }
  return "other";
}

/**
 * Build weekly cashflow lines for every cash/investment account that has
 * Income Plan links, paycheck deposit, bills, debts, or recurring activity.
 */
export function buildAccountCashflows(data: FinanceData): Map<string, AccountCashflow> {
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  const byAccount = new Map<string, AccountCashflowLine[]>();

  const push = (accountId: string | null | undefined, line: AccountCashflowLine) => {
    if (!accountId || line.weeklyAmount === 0) return;
    const list = byAccount.get(accountId) ?? [];
    list.push(line);
    byAccount.set(accountId, list);
  };

  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));
  const depositAccountId = plan?.depositAccountId ?? null;

  // --- Income Plan allocations (destination deposits + spend/bill/rent purpose outflows)
  let billsFundAccountId: string | null = null;
  let rentReserveAccountId: string | null = null;
  let spendingAccountId: string | null = null;
  const allocationTransfersOut: Array<{ accountId: string; amount: number; name: string }> = [];

  if (plan?.isActive && plan.paycheckAmount > 0) {
    const resolved = resolveAllocationAmounts({
      paycheckAmount: plan.paycheckAmount,
      allocations: plan.allocations,
    });
    const weeklyPaycheck =
      weeklySavingsFromPaycheckAmount(
        plan.paycheckAmount,
        plan.paySchedule,
        plan.customIntervalDays,
      ) ?? 0;

    if (depositAccountId && weeklyPaycheck > 0) {
      push(depositAccountId, {
        id: `paycheck-${plan.id}`,
        name: "Paycheck deposit",
        kind: "paycheck",
        weeklyAmount: weeklyPaycheck,
        confidence: "confirmed",
        detail: "Planned Income Plan paycheck into this bank account.",
      });
    }

    for (const item of resolved) {
      const amount = round(item.amount);
      if (amount <= 0 && !item.allocation.isRemainingBalance) continue;
      const weekly =
        weeklySavingsFromPaycheckAmount(
          amount,
          plan.paySchedule,
          plan.customIntervalDays,
        ) ?? 0;
      const purpose = classifyForecastPurpose({
        name: item.allocation.name,
        kind: item.allocation.isRemainingBalance
          ? "remaining"
          : item.allocation.goalId
            ? "goal"
            : item.allocation.billId
              ? "bill"
              : item.allocation.debtId
                ? "debt"
                : "flexible",
        goalId: item.allocation.goalId,
        billId: item.allocation.billId ?? null,
      });
      const destId = item.allocation.accountId;

      if (purpose === "bill_fund" && destId) billsFundAccountId = destId;
      if (purpose === "rent_reserve" && destId) rentReserveAccountId = destId;
      if (purpose === "spend" && destId) spendingAccountId = destId;

      if (destId && weekly > 0) {
        // Paycheck already credited the deposit account — only add allocation_in
        // when money is parked in a different destination (avoids double-counting).
        if (destId !== depositAccountId) {
          push(destId, {
            id: `alloc-in-${item.allocation.id}`,
            name: item.allocation.name,
            kind: "allocation_in",
            weeklyAmount: weekly,
            confidence: "confirmed",
            detail:
              "Planned paycheck allocation to this account (not cash until confirmed).",
          });
          if (depositAccountId) {
            allocationTransfersOut.push({
              accountId: depositAccountId,
              amount: weekly,
              name: item.allocation.name,
            });
          }
        }

        // Purpose-level expected outflows on the destination (or deposit) account.
        if (purpose === "spend") {
          push(destId, {
            id: `spend-${item.allocation.id}`,
            name: `${item.allocation.name} spending`,
            kind: "spending",
            weeklyAmount: -weekly,
            confidence: "estimated",
            detail: "Spending budget is expected to be used, not saved.",
          });
        }
      }
    }

    for (const transfer of allocationTransfersOut) {
      push(transfer.accountId, {
        id: `transfer-out-${transfer.name}`,
        name: `Transfer to ${transfer.name}`,
        kind: "transfer_out",
        weeklyAmount: -transfer.amount,
        confidence: "confirmed",
        detail: "Internal transfer to another linked account — not an expense.",
      });
    }
  }

  // --- Saved bills
  const coveredBillNames: string[] = [];
  const billWeeklyByAccount = new Map<string, number>();
  for (const bill of data.bills ?? []) {
    if (bill.amount <= 0) continue;
    if (bill.schedule?.status === "paused") continue;
    coveredBillNames.push(bill.name);
    const weekly = toWeekly(bill.amount, bill.frequency ?? "monthly");
    const kind = billKind(bill);
    let accountId = bill.paymentAccountId ?? null;
    let confidence: CashflowConfidence = "confirmed";
    let detail = `${bill.name} recurring bill.`;

    if (!accountId) {
      confidence = "estimated";
      if (kind === "rent" && rentReserveAccountId) {
        accountId = rentReserveAccountId;
        detail = `${bill.name} has no payment account — attributed to Rent Reserve account.`;
      } else if (billsFundAccountId) {
        accountId = billsFundAccountId;
        detail = `${bill.name} has no payment account — attributed to Bills account.`;
      } else if (depositAccountId) {
        accountId = depositAccountId;
        detail = `${bill.name} has no payment account — attributed to paycheck deposit account.`;
      }
    }

    // Credit card payment accounts: the charge hits the card, not checking cash.
    // Skip liability accounts for cash projections (card balances are separate).
    if (accountId) {
      const account = accountsById.get(accountId);
      if (account?.type === "credit_card") {
        // Paying the card later is a debt minimum from a cash account — skip here.
        continue;
      }
    }

    if (!accountId || weekly <= 0) continue;
    billWeeklyByAccount.set(
      accountId,
      round((billWeeklyByAccount.get(accountId) ?? 0) + weekly),
    );
    push(accountId, {
      id: `bill-${bill.id}`,
      name: bill.name,
      kind,
      weeklyAmount: -weekly,
      confidence,
      detail,
    });
  }

  // Bills fund allocation: if linked bills already cover the fund, do not also
  // invent a matching spend-all outflow. If fund > known bills, withdraw the gap
  // as other bill payments.
  if (billsFundAccountId && plan?.isActive) {
    const fundWeekly = (byAccount.get(billsFundAccountId) ?? [])
      .filter((line) => line.kind === "allocation_in")
      .reduce((sum, line) => sum + Math.max(0, line.weeklyAmount), 0);
    const knownBills = billWeeklyByAccount.get(billsFundAccountId) ?? 0;
    const gap = round(fundWeekly - knownBills);
    if (gap > 0.5) {
      push(billsFundAccountId, {
        id: `bills-fund-gap-${billsFundAccountId}`,
        name: "Other bill payments",
        kind: "bill",
        weeklyAmount: -gap,
        confidence: "estimated",
        detail:
          "Bills allocation exceeds assigned recurring bills — remaining fund is treated as outgoing bill payments.",
      });
    }
  }

  // Rent reserve: if no rent bill attributed, draw the reserve at the funding rate.
  if (rentReserveAccountId) {
    const hasRentOutflow = (byAccount.get(rentReserveAccountId) ?? []).some(
      (line) => line.kind === "rent",
    );
    if (!hasRentOutflow) {
      const rentIn = (byAccount.get(rentReserveAccountId) ?? [])
        .filter((line) => line.kind === "allocation_in")
        .reduce((sum, line) => sum + Math.max(0, line.weeklyAmount), 0);
      if (rentIn > 0) {
        push(rentReserveAccountId, {
          id: `rent-draw-${rentReserveAccountId}`,
          name: "Rent payment (from reserve)",
          kind: "rent",
          weeklyAmount: -rentIn,
          confidence: "estimated",
          detail:
            "No rent bill payment account is set — reserve is assumed to be paid out as rent, not accumulated forever.",
        });
      }
    }
  }

  // --- Debt minimums (credit cards / loans) from cash accounts
  const debtPayFrom =
    spendingAccountId ?? depositAccountId ?? billsFundAccountId ?? null;
  for (const debt of data.debts ?? []) {
    if (debt.balance <= 0 || debt.minimumPayment <= 0) continue;
    if (coveredBillNames.some((name) => namesMatch(name, debt.name))) continue;
    const weekly = toWeekly(debt.minimumPayment, "monthly");
    if (!debtPayFrom || weekly <= 0) continue;
    const payAccount = accountsById.get(debtPayFrom);
    if (!payAccount || payAccount.type === "credit_card") continue;
    push(debtPayFrom, {
      id: `debt-${debt.id}`,
      name: `${debt.name} minimum`,
      kind: "debt",
      weeklyAmount: -weekly,
      confidence: "estimated",
      detail: `Minimum payment attributed to ${payAccount.name} until a bill payment account is set.`,
    });
  }

  // --- Detected recurring withdrawals not already saved as bills
  const candidates = detectRecurringBillCandidatesFromFinanceData(
    data,
    data.plaidRecurringDismissals ?? [],
  );
  for (const candidate of candidates) {
    if (candidate.action !== "create" || candidate.existingBillId) continue;
    if (
      isTransferDisplayCategory(candidate.category) ||
      getDisplayCategory(candidate.category) === "Transfers"
    ) {
      continue;
    }
    if (
      coveredBillNames.some(
        (name) =>
          namesMatch(name, candidate.displayName) ||
          namesMatch(name, candidate.merchantKey),
      )
    ) {
      continue;
    }
    if (
      (data.debts ?? []).some(
        (debt) =>
          namesMatch(debt.name, candidate.displayName) ||
          namesMatch(debt.name, candidate.merchantKey),
      )
    ) {
      continue;
    }
    const accountId = candidate.paymentAccountId ?? candidate.accountId ?? null;
    if (!accountId) continue;
    const account = accountsById.get(accountId);
    if (!account || account.type === "credit_card") continue;
    const weekly = toWeekly(candidate.averageAmount, candidate.frequency);
    if (weekly <= 0) continue;
    push(accountId, {
      id: `recurring-${candidate.merchantKey}`,
      name: candidate.displayName,
      kind: "recurring",
      weeklyAmount: -weekly,
      confidence: "estimated",
      detail: `Detected recurring charge (~${candidate.frequency}) from bank history — not yet a saved bill.`,
    });
  }

  const result = new Map<string, AccountCashflow>();
  for (const [accountId, lines] of byAccount) {
    const account = accountsById.get(accountId);
    if (!account) continue;
    if (account.isHidden || account.archivedAt) continue;

    // Collapse duplicate transfer/spend noise: keep all lines for transparency.
    const weeklyInflows = round(
      lines
        .filter((line) => line.weeklyAmount > 0)
        .reduce((sum, line) => sum + line.weeklyAmount, 0),
    );
    const weeklyOutflows = round(
      lines
        .filter((line) => line.weeklyAmount < 0)
        .reduce((sum, line) => sum + Math.abs(line.weeklyAmount), 0),
    );
    const upcomingWithdrawals = lines
      .filter((line) => line.weeklyAmount < 0)
      .sort((left, right) => left.weeklyAmount - right.weeklyAmount);

    result.set(accountId, {
      accountId,
      starting: resolveStartingBalance(account),
      lines,
      weeklyInflows,
      weeklyOutflows,
      weeklyNet: round(weeklyInflows - weeklyOutflows),
      upcomingWithdrawals,
    });
  }

  return result;
}

/** Exported for tests — weekly rate helper. */
export function weeklyFromFrequency(amount: number, frequency?: string | null): number {
  return toWeekly(amount, frequency);
}
