import { resolvePaymentAccountId } from "@/lib/finance/balanceEffects";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { advancePayDate } from "@/lib/incomePlan/payDates";
import { resolveAllocations } from "@/lib/allocation/allocationEngine";
import {
  applyEnvelopeContribution,
  buildVirtualEnvelopes,
  syncStoredEnvelopesFromVirtual,
} from "@/lib/allocation/envelopes";
import { appendLedgerEntries, buildPaycheckLedgerEntry } from "@/lib/allocation/ledgerEngine";
import type {
  AllocationLedgerEntry,
  EnvelopeType,
  PaycheckExecutionResult,
} from "@/lib/allocation/types";
import type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanPaycheckEvent,
  MarkPaycheckReceivedInput,
} from "@/lib/incomePlan/types";
import {
  applyDebtPaymentEffect,
  applyGoalContributionEffect,
  applyTransactionEffect,
} from "@/lib/transactions/applyTransactionEffects";

function createTransaction(
  partial: Omit<Transaction, "id"> & { id?: string },
): Transaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    amount: partial.amount,
    type: partial.type,
    category: partial.category,
    accountId: partial.accountId,
    transferAccountId: partial.transferAccountId ?? null,
    date: partial.date,
    notes: partial.notes,
    goalId: partial.goalId ?? null,
    billId: partial.billId ?? null,
    debtId: partial.debtId ?? null,
  };
}

function inferDestinationType(
  allocation: IncomePlanAllocation,
): EnvelopeType | "account" {
  if (allocation.goalId) return "goal";
  if (allocation.billId) return "bill";
  if (allocation.debtId) return "debt";
  if (allocation.investmentId) return "investment";
  if (allocation.accountId) return "account";
  return "category";
}

function inferDestinationId(allocation: IncomePlanAllocation): string | null {
  return (
    allocation.goalId ??
    allocation.billId ??
    allocation.debtId ??
    allocation.investmentId ??
    allocation.accountId
  );
}

function moveAllocationAmount(
  data: FinanceData,
  params: {
    allocation: IncomePlanAllocation;
    amount: number;
    depositAccountId: string;
    date: string;
  },
): { data: FinanceData; transactionId: string | null } {
  const { allocation, amount, depositAccountId, date } = params;

  if (amount <= 0) {
    return { data, transactionId: null };
  }

  if (allocation.goalId) {
    const goal = data.savingsGoals.find((item) => item.id === allocation.goalId);
    const transaction = createTransaction({
      amount,
      type: "expense",
      category: "Goal Contribution",
      accountId: depositAccountId,
      transferAccountId: null,
      date,
      notes: goal
        ? `Income Plan → ${goal.name}`
        : `Income Plan → ${allocation.name}`,
      goalId: allocation.goalId,
    });

    let next: FinanceData = {
      ...data,
      transactions: [transaction, ...data.transactions],
    };
    next = applyTransactionEffect(next, transaction);
    next = applyGoalContributionEffect(next, transaction);

    return { data: next, transactionId: transaction.id };
  }

  if (allocation.debtId) {
    const debt = data.debts.find((item) => item.id === allocation.debtId);
    const paymentAmount = Math.min(amount, debt?.balance ?? amount);
    const transaction = createTransaction({
      amount: paymentAmount,
      type: "expense",
      category: "Debt Payment",
      accountId: depositAccountId,
      transferAccountId: null,
      date,
      notes: debt
        ? `Income Plan → ${debt.name}`
        : `Income Plan → ${allocation.name}`,
      debtId: allocation.debtId,
    });

    let next: FinanceData = {
      ...data,
      transactions: [transaction, ...data.transactions],
    };
    next = applyTransactionEffect(next, transaction);
    next = applyDebtPaymentEffect(next, transaction);

    return { data: next, transactionId: transaction.id };
  }

  if (allocation.accountId && allocation.accountId !== depositAccountId) {
    const transaction = createTransaction({
      amount,
      type: "transfer",
      category: allocation.name,
      accountId: depositAccountId,
      transferAccountId: allocation.accountId,
      date,
      notes: `Income Plan → ${allocation.name}`,
    });

    let next: FinanceData = {
      ...data,
      transactions: [transaction, ...data.transactions],
    };
    next = applyTransactionEffect(next, transaction);

    return { data: next, transactionId: transaction.id };
  }

  return { data, transactionId: null };
}

export function executePaycheckAllocations(
  data: FinanceData,
  plan: IncomePlan,
  input: MarkPaycheckReceivedInput = {},
  referenceDate = new Date(),
): PaycheckExecutionResult {
  if (!plan.isActive) {
    throw new Error("Income plan is not active.");
  }

  const depositAccountId = resolvePaymentAccountId(
    data,
    plan.depositAccountId,
  );

  if (!depositAccountId) {
    throw new Error("Add a checking account to receive paychecks.");
  }

  const payDate = plan.nextPayDate;
  const date =
    referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString();
  const resolved = resolveAllocations(plan, input.customAllocations);
  const paycheckEventId = crypto.randomUUID();
  const ledgerEntries: AllocationLedgerEntry[] = [];

  const incomeTransaction = createTransaction({
    amount: plan.paycheckAmount,
    type: "income",
    category: "Paycheck",
    accountId: depositAccountId,
    transferAccountId: null,
    date,
    notes: "Income Plan paycheck received",
  });

  let next: FinanceData = {
    ...data,
    transactions: [incomeTransaction, ...data.transactions],
  };
  next = applyTransactionEffect(next, incomeTransaction);

  const allocationEvents: IncomePlanPaycheckEvent["allocationEvents"] = [];
  let virtualEnvelopes = buildVirtualEnvelopes(next, plan);

  for (const { allocation, amount } of resolved) {
    const moved = moveAllocationAmount(next, {
      allocation,
      amount,
      depositAccountId,
      date,
    });

    next = moved.data;

    allocationEvents.push({
      id: crypto.randomUUID(),
      allocationId: allocation.id,
      amount,
      transactionId: moved.transactionId,
    });

    if (amount > 0) {
      const ledgerEntry = buildPaycheckLedgerEntry({
        paycheckEventId,
        allocationId: allocation.id,
        sourceAccountId: depositAccountId,
        destinationType: inferDestinationType(allocation),
        destinationId: inferDestinationId(allocation),
        destinationName: allocation.name,
        amount,
        transferDate: payDate,
        frequency: plan.paySchedule,
        transactionId: moved.transactionId,
      });

      ledgerEntries.push(ledgerEntry);

      virtualEnvelopes = applyEnvelopeContribution(virtualEnvelopes, {
        allocationId: allocation.id,
        amount,
        date: payDate,
        ledgerEntryId: ledgerEntry.id,
      });
    }
  }

  next = appendLedgerEntries(next, ledgerEntries);
  next = {
    ...next,
    envelopeBalances: syncStoredEnvelopesFromVirtual(
      virtualEnvelopes,
      next.envelopeBalances,
    ),
  };

  const updatedPlan: IncomePlan = {
    ...plan,
    lastProcessedDate: payDate,
    nextPayDate: advancePayDate(plan),
  };

  const paycheckEvent: IncomePlanPaycheckEvent = {
    id: paycheckEventId,
    incomePlanId: plan.id,
    payDate,
    grossAmount: plan.paycheckAmount,
    isExtraPaycheck: input.isExtraPaycheck ?? false,
    incomeTransactionId: incomeTransaction.id,
    allocationEvents,
  };

  return {
    data: {
      ...next,
      incomePlan: updatedPlan,
      incomePlanPaychecks: [paycheckEvent, ...(data.incomePlanPaychecks ?? [])],
    },
    paycheckEvent,
    ledgerEntries,
    resolvedAllocations: resolved,
  };
}

/** Manual or Plaid-triggered income plan run — same logic as paycheck processing. */
export function runIncomePlan(
  data: FinanceData,
  plan: IncomePlan,
  input: MarkPaycheckReceivedInput = {},
  referenceDate = new Date(),
): PaycheckExecutionResult {
  return executePaycheckAllocations(data, plan, input, referenceDate);
}
