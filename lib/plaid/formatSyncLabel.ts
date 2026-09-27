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

  return `Updated ${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
