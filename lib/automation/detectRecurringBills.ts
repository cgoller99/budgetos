import type { AutomationSuggestion } from "@/lib/automation/types";
import type { Bill, FinanceData, Transaction } from "@/lib/finance/types";

function normalizeMerchantName(category: string, notes: string | null): string {
  const source = notes?.trim() || category.trim();
  return source.toLowerCase().replace(/\s+/g, " ").trim();
}

function displayMerchantName(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function monthsAgo(referenceDate: Date, months: number): Date {
  const date = new Date(referenceDate);
  date.setMonth(date.getMonth() - months);
  return date;
}

function amountsAreSimilar(amounts: number[]): boolean {
  if (amounts.length === 0) {
    return false;
  }

  const average = amounts.reduce((total, amount) => total + amount, 0) / amounts.length;

  if (average <= 0) {
    return false;
  }

  return amounts.every(
    (amount) => Math.abs(amount - average) / average <= 0.15,
  );
}

function daysOfMonthAreSimilar(days: number[]): boolean {
  if (days.length < 2) {
    return true;
  }

  const average = days.reduce((total, day) => total + day, 0) / days.length;
  return days.every((day) => Math.abs(day - average) <= 3);
}

function getEligibleExpenses(data: FinanceData): Transaction[] {
  const cutoff = monthsAgo(new Date(), 3).toISOString().slice(0, 10);

  return data.transactions.filter(
    (transaction) =>
      transaction.type === "expense" &&
      !transaction.billId &&
      transaction.date >= cutoff &&
      transaction.amount > 0,
  );
}

function billAlreadyExists(bills: Bill[], merchantKey: string): boolean {
  return bills.some((bill) => bill.name.toLowerCase().trim() === merchantKey);
}

export function detectRecurringBillSuggestions(
  data: FinanceData,
  referenceDate = new Date(),
): AutomationSuggestion[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of getEligibleExpenses(data)) {
    const merchantKey = normalizeMerchantName(
      transaction.category,
      transaction.notes,
    );

    if (merchantKey.length < 3) {
      continue;
    }

    const existing = groups.get(merchantKey) ?? [];
    existing.push(transaction);
    groups.set(merchantKey, existing);
  }

  const suggestions: AutomationSuggestion[] = [];

  for (const [merchantKey, transactions] of groups) {
    if (billAlreadyExists(data.bills, merchantKey)) {
      continue;
    }

    const monthKeys = new Set(transactions.map((item) => item.date.slice(0, 7)));

    if (monthKeys.size < 3 || transactions.length < 3) {
      continue;
    }

    const amounts = transactions.map((item) => item.amount);

    if (!amountsAreSimilar(amounts)) {
      continue;
    }

    const days = transactions.map((item) => new Date(item.date).getDate());

    if (!daysOfMonthAreSimilar(days)) {
      continue;
    }

    const averageAmount =
      Math.round((amounts.reduce((total, amount) => total + amount, 0) / amounts.length) * 100) /
      100;
    const dueDay = Math.min(28, Math.max(1, Math.round(
      days.reduce((total, day) => total + day, 0) / days.length,
    )));
    const displayName = displayMerchantName(merchantKey);

    suggestions.push({
      id: `automation-recurring-bill-${merchantKey.replace(/[^a-z0-9]+/g, "-")}`,
      kind: "recurring_bill",
      title: `Make ${displayName} a recurring bill?`,
      description: `We noticed ${displayName} has charged around the same time for the last 3 months.`,
      icon: "📅",
      tone: "accent",
      priority: 80,
      timestamp: referenceDate.toISOString(),
      provider: "buxme",
      entityType: "merchant",
      entityId: merchantKey,
      detailHref: "/bills",
      primaryAction: {
        label: "Create Bill",
        type: "create_bill",
        payload: {
          name: displayName,
          amount: averageAmount,
          dueDay,
          autopay: false,
          recurring: true,
          category: transactions[0]?.category ?? "Subscriptions",
        },
      },
      secondaryAction: {
        label: "Ignore",
        type: "dismiss",
      },
    });
  }

  return suggestions;
}
