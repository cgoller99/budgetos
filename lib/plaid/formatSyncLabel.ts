export function formatAccountSyncLabel(
  lastSyncedAt: string | null | undefined,
): string {
  if (!lastSyncedAt) {
    return "Never synced";
  }

  const date = new Date(lastSyncedAt);

  if (Number.isNaN(date.getTime())) {
    return "Never synced";
  }

  return `Synced ${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function formatBankCheckedLabel(
  balancesCheckedAt: string | null | undefined,
): string | null {
  if (!balancesCheckedAt) {
    return null;
  }

  const date = new Date(balancesCheckedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `Bank checked ${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
