export type DayGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

function dayKey(date: string): string {
  return date.slice(0, 10);
}

export function formatDayGroupLabel(day: string, today = new Date()): string {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  if (!year || !month || !dayOfMonth) {
    return day;
  }

  const date = new Date(year, month - 1, dayOfMonth);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((startToday.getTime() - date.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Preserve first-seen day order so a date-desc list stays grouped. */
export function groupByDay<T extends { date: string }>(
  items: T[],
  today = new Date(),
): DayGroup<T>[] {
  const order: string[] = [];
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const key = dayKey(item.date);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(key, [item]);
      order.push(key);
    }
  }

  return order.map((key) => ({
    key,
    label: formatDayGroupLabel(key, today),
    items: buckets.get(key) ?? [],
  }));
}
