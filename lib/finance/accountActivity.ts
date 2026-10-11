type ActivityTransaction = {
  date: string;
  amount: number;
  type: string;
  accountId: string;
  transferAccountId?: string | null;
};

function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function signedFlow(transaction: ActivityTransaction, accountId: string): number {
  const amount = Math.abs(transaction.amount);
  if (transaction.type === "transfer") {
    if (transaction.accountId === accountId) return -amount;
    if (transaction.transferAccountId === accountId) return amount;
    return 0;
  }
  if (transaction.accountId !== accountId) return 0;
  if (transaction.type === "income") return amount;
  if (transaction.type === "expense") return -amount;
  return 0;
}

/** Oldest-to-newest net flow for the last `monthCount` calendar months. */
export function monthlyAccountActivity(
  transactions: ActivityTransaction[],
  accountId: string,
  monthCount = 6,
  today = new Date(),
): number[] {
  const keys: string[] = [];
  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    keys.push(monthKey(date));
  }

  const totals = new Map(keys.map((key) => [key, 0]));
  for (const transaction of transactions) {
    const key = transaction.date.slice(0, 7);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + signedFlow(transaction, accountId));
  }

  return keys.map((key) => Math.round((totals.get(key) ?? 0) * 100) / 100);
}
