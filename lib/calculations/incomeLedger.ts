import type { FinanceData } from "@/lib/finance/types";
import { getTransactionsForMonth } from "@/lib/transactions";
import { filterRealIncomeTransactions } from "@/lib/transactions/transferDetection";

function isPersonalOwnerRow(
  ownerUserId: string | null | undefined,
  viewerUserId: string | null | undefined,
): boolean {
  if (!viewerUserId) {
    return true;
  }

  if (!ownerUserId) {
    return true;
  }

  return ownerUserId === viewerUserId;
}

export function getPersonalLedgerIncomeForMonth(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const viewerUserId = data.viewerUserId ?? null;

  const incomeTransactions = getTransactionsForMonth(data, referenceDate)
    .filter((transaction) => transaction.type === "income")
    .filter((transaction) =>
      isPersonalOwnerRow(transaction.ownerUserId, viewerUserId),
    );

  return filterRealIncomeTransactions(data, incomeTransactions).reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
}

export function getAveragePersonalLedgerIncome(
  data: FinanceData,
  referenceDate = new Date(),
  months = 3,
): number {
  const totals: number[] = [];

  for (let offset = 1; offset <= months; offset += 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 15);
    const income = getPersonalLedgerIncomeForMonth(data, date);

    if (income > 0) {
      totals.push(income);
    }
  }

  if (totals.length === 0) {
    return 0;
  }

  return totals.reduce((total, value) => total + value, 0) / totals.length;
}
