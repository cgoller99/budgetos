import type { AutomationProvider, AutomationSuggestion } from "@/lib/automation/types";
import type { FinanceData } from "@/lib/finance/types";
import { detectRecurringBillCandidates } from "@/lib/plaid/recurringDetectionService";
import { detectPayrollCandidates } from "@/lib/plaid/incomeDetectionService";
import type { PlaidMappedTransaction } from "@/lib/plaid/types";

function toPlaidMappedTransactions(data: FinanceData): PlaidMappedTransaction[] {
  return data.transactions
    .filter((transaction) => Boolean(transaction.externalTransactionId))
    .map((transaction) => {
      const account = data.accounts.find((item) => item.id === transaction.accountId);

      return {
        externalTransactionId: transaction.externalTransactionId!,
        externalAccountId: account?.externalAccountId ?? transaction.accountId,
        amount: transaction.amount,
        type: transaction.type === "transfer" ? "expense" : transaction.type,
        category: transaction.category,
        date: transaction.date,
        notes: transaction.notes,
        name: transaction.notes,
      };
    });
}

export const plaidAutomationProvider: AutomationProvider = {
  id: "plaid",
  getSuggestions(data, referenceDate = new Date()) {
    const plaidTransactions = toPlaidMappedTransactions(data);
    const suggestions: AutomationSuggestion[] = [];

    const recurringCandidates = detectRecurringBillCandidates(
      plaidTransactions,
      data.plaidRecurringDismissals ?? [],
    );

    for (const candidate of recurringCandidates) {
      suggestions.push({
        id: `plaid-recurring-bill-${candidate.merchantKey.replace(/[^a-z0-9]+/g, "-")}`,
        kind: "recurring_bill" as const,
        title: "We found a recurring charge",
        description: `${candidate.displayName} looks like a recurring bill around $${candidate.averageAmount.toFixed(2)}.`,
        icon: "📅",
        tone: "accent" as const,
        priority: 85,
        timestamp: referenceDate.toISOString(),
        provider: "plaid",
        entityType: "merchant",
        entityId: candidate.merchantKey,
        detailHref: "/bills",
        primaryAction: {
          label: "Create",
          type: "create_bill",
          payload: {
            name: candidate.displayName,
            amount: candidate.averageAmount,
            dueDay: candidate.dueDay,
            autopay: false,
            recurring: true,
            category: candidate.category,
          },
        },
        secondaryAction: {
          label: "Ignore",
          type: "dismiss",
        },
        tertiaryAction: {
          label: "Never ask again",
          type: "dismiss_permanently",
          payload: {
            merchantKey: candidate.merchantKey,
          },
        },
      });
    }

    const plan = data.incomePlan;

    if (plan) {
      const depositAccount = data.accounts.find(
        (account) => account.id === plan.depositAccountId,
      );
      const payrollCandidates = detectPayrollCandidates({
        transactions: plaidTransactions,
        paycheckAmount: plan.paycheckAmount,
        depositAccountExternalId: depositAccount?.externalAccountId ?? null,
        referenceDate,
      });

      for (const candidate of payrollCandidates) {
        suggestions.push({
          id: `plaid-paycheck-${candidate.transactionId}`,
          kind: "paycheck_detected" as const,
          title: "Paycheck detected.",
          description: "Apply your Income Plan?",
          icon: "💵",
          tone: "accent" as const,
          priority: 105,
          timestamp: candidate.postedDate,
          provider: "plaid",
          entityId: candidate.transactionId,
          entityType: "transaction",
          detailHref: "/income?tab=plan",
          primaryAction: {
            label: "Apply",
            type: "apply_paycheck",
            payload: {
              transactionId: candidate.transactionId,
            },
          },
          secondaryAction: {
            label: "Skip",
            type: "skip",
          },
        });
      }
    }

    return suggestions;
  },
};
