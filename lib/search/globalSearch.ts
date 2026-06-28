import type { FinanceData } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/finance/format";

export type SearchResultType =
  | "account"
  | "bill"
  | "transaction"
  | "goal"
  | "income";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
  amount?: number;
};

const TYPE_LABELS: Record<SearchResultType, string> = {
  account: "Account",
  bill: "Bill",
  transaction: "Transaction",
  goal: "Goal",
  income: "Income",
};

export function getSearchResultTypeLabel(type: SearchResultType): string {
  return TYPE_LABELS[type];
}

function matchesQuery(values: string[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return values.some((value) => value.toLowerCase().includes(normalized));
}

function accountName(data: FinanceData, accountId: string): string {
  return data.accounts.find((account) => account.id === accountId)?.name ?? "Account";
}

export function searchFinanceData(
  data: FinanceData,
  query: string,
): SearchResult[] {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const account of data.accounts) {
    if (
      matchesQuery(
        [account.name, account.institution, account.type],
        normalized,
      )
    ) {
      results.push({
        id: account.id,
        type: "account",
        title: account.name,
        subtitle: `${account.institution} · ${formatCurrency(account.balance)}`,
        href: "/accounts",
        amount: account.balance,
      });
    }
  }

  for (const bill of data.bills) {
    if (matchesQuery([bill.name, bill.category], normalized)) {
      results.push({
        id: bill.id,
        type: "bill",
        title: bill.name,
        subtitle: `${bill.category} · ${formatCurrency(bill.amount)}/mo`,
        href: "/bills",
        amount: bill.amount,
      });
    }
  }

  for (const transaction of data.transactions) {
    if (
      matchesQuery(
        [
          transaction.category,
          transaction.notes,
          transaction.type,
          accountName(data, transaction.accountId),
        ],
        normalized,
      )
    ) {
      const sign =
        transaction.type === "income"
          ? "+"
          : transaction.type === "expense"
            ? "-"
            : "";
      results.push({
        id: transaction.id,
        type: "transaction",
        title: transaction.category || transaction.notes || "Transaction",
        subtitle: `${transaction.date} · ${sign}${formatCurrency(transaction.amount)}`,
        href: "/transactions",
        amount: transaction.amount,
      });
    }
  }

  for (const goal of data.savingsGoals) {
    if (matchesQuery([goal.name, goal.type], normalized)) {
      results.push({
        id: goal.id,
        type: "goal",
        title: goal.name,
        subtitle: `${formatCurrency(goal.current)} of ${formatCurrency(goal.target)}`,
        href: "/savings",
        amount: goal.current,
      });
    }
  }

  for (const source of data.income) {
    if (matchesQuery([source.name, source.category, source.frequency], normalized)) {
      results.push({
        id: source.id,
        type: "income",
        title: source.name,
        subtitle: `${source.category} · ${formatCurrency(source.amount)}`,
        href: "/income",
        amount: source.amount,
      });
    }
  }

  return results.slice(0, 20);
}
