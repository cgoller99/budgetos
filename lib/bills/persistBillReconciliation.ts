import "server-only";

import {
  diagnoseBillPaymentMatching,
  reconcileBillPayments,
  type BillCycleDiagnostic,
  type BillReconcileResult,
} from "@/lib/bills/reconcileBillPayments";
import type { FinanceData } from "@/lib/finance/types";
import { normalizeRecurringFinanceData } from "@/lib/recurring/normalize";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  buildBillSplitUpdate,
  buildBillUpdate,
  buildTransactionUpdate,
} from "@/lib/supabase/mappers";
import { FinanceService } from "@/lib/supabase/services/financeService";

export type PersistBillReconciliationResult = {
  reconcile: BillReconcileResult;
  diagnostics: BillCycleDiagnostic[];
};

export async function reconcileBillPaymentsForUser(
  supabase: BuxmeSupabaseClient,
  userId: string,
  options?: { referenceDate?: Date; lookbackMonths?: number },
): Promise<PersistBillReconciliationResult> {
  const financeService = new FinanceService(supabase);
  const loaded = await financeService.loadFinanceData(userId);
  const normalized = normalizeRecurringFinanceData(loaded, options?.referenceDate);

  const { data: nextData, result, diagnostics } = reconcileBillPayments(
    normalized,
    options,
  );

  await persistBillReconciliationChanges(supabase, userId, normalized, nextData);

  return { reconcile: result, diagnostics };
}

export async function persistBillReconciliationChanges(
  supabase: BuxmeSupabaseClient,
  userId: string,
  before: FinanceData,
  after: FinanceData,
): Promise<void> {
  const beforeTransactions = new Map(
    (before.transactions ?? []).map((transaction) => [transaction.id, transaction]),
  );

  for (const transaction of after.transactions ?? []) {
    const previous = beforeTransactions.get(transaction.id);
    if (!previous || previous.billId === transaction.billId) {
      continue;
    }

    const { error } = await supabase
      .from("transactions")
      .update(buildTransactionUpdate(transaction))
      .eq("id", transaction.id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  const beforeBills = new Map((before.bills ?? []).map((bill) => [bill.id, bill]));

  for (const bill of after.bills ?? []) {
    const previous = beforeBills.get(bill.id);
    if (!previous) {
      continue;
    }

    const billChanged =
      JSON.stringify(previous.schedule) !== JSON.stringify(bill.schedule) ||
      previous.paidMonth !== bill.paidMonth;

    const splitChanged = (bill.splits ?? []).some((split) => {
      const prevSplit = (previous.splits ?? []).find((item) => item.id === split.id);
      return (
        !prevSplit ||
        prevSplit.paidMonth !== split.paidMonth ||
        prevSplit.paidAmount !== split.paidAmount
      );
    });

    if (!billChanged && !splitChanged) {
      continue;
    }

    const { error: billError } = await supabase
      .from("bills")
      .update(buildBillUpdate(bill))
      .eq("id", bill.id)
      .eq("user_id", userId);

    if (billError) {
      throw billError;
    }

    for (const split of bill.splits ?? []) {
      const prevSplit = (previous.splits ?? []).find((item) => item.id === split.id);
      if (
        prevSplit &&
        prevSplit.paidMonth === split.paidMonth &&
        prevSplit.paidAmount === split.paidAmount
      ) {
        continue;
      }

      const { error: splitError } = await supabase
        .from("bill_splits")
        .update(buildBillSplitUpdate(split))
        .eq("id", split.id)
        .eq("user_id", userId);

      if (splitError) {
        throw splitError;
      }
    }
  }
}

export async function loadBillPaymentDiagnosticsForUser(
  supabase: BuxmeSupabaseClient,
  userId: string,
): Promise<BillCycleDiagnostic[]> {
  const financeService = new FinanceService(supabase);
  const loaded = await financeService.loadFinanceData(userId);
  const normalized = normalizeRecurringFinanceData(loaded);
  return diagnoseBillPaymentMatching(normalized);
}
