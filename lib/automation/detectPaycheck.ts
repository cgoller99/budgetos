import type { AutomationSuggestion } from "@/lib/automation/types";
import type { FinanceData } from "@/lib/finance/types";

function amountsMatch(
  left: number,
  right: number,
  toleranceRatio = 0.05,
): boolean {
  if (left <= 0 || right <= 0) {
    return false;
  }

  return Math.abs(left - right) / right <= toleranceRatio;
}

export function detectPaycheckSuggestions(
  data: FinanceData,
  referenceDate = new Date(),
): AutomationSuggestion[] {
  const plan = data.incomePlan;

  if (!plan) {
    return [];
  }

  const processedTransactionIds = new Set(
    (data.incomePlanPaychecks ?? [])
      .map((event) => event.incomeTransactionId)
      .filter((value): value is string => Boolean(value)),
  );

  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const matches = data.transactions.filter(
    (transaction) =>
      transaction.type === "income" &&
      transaction.date >= cutoffDate &&
      !processedTransactionIds.has(transaction.id) &&
      !transaction.notes?.includes("Income Plan paycheck received") &&
      amountsMatch(transaction.amount, plan.paycheckAmount),
  );

  return matches.map((transaction) => ({
    id: `automation-paycheck-${transaction.id}`,
    kind: "paycheck_detected" as const,
    title: "Paycheck detected.",
    description: "Apply your Income Plan?",
    icon: "💵",
    tone: "accent" as const,
    priority: 100,
    timestamp: transaction.date,
    provider: "buxme",
    entityId: transaction.id,
    entityType: "transaction",
    detailHref: "/income?tab=plan",
    primaryAction: {
      label: "Apply",
      type: "apply_paycheck" as const,
      payload: {
        transactionId: transaction.id,
      },
    },
    secondaryAction: {
      label: "Skip",
      type: "skip" as const,
    },
  }));
}
