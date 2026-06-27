/** Convert a per-period amount into an approximate monthly equivalent. */
export function toMonthlyAmount(
  amount: number,
  frequency?: string | null,
): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
    case "every_2_weeks":
      return (amount * 26) / 12;
    case "twice_monthly":
      return amount * 2;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    case "monthly":
    default:
      return amount;
  }
}
