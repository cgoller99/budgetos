/** Plain-language time left until a goal date. */
export function describeTimeRemaining(date: Date | null, now = new Date()): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "Set a weekly amount to estimate time remaining";
  }

  const days = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "Due now";
  if (days === 1) return "1 day left";
  if (days < 14) return `${days} days left`;

  const weeks = Math.round(days / 7);
  if (weeks < 8) return weeks === 1 ? "1 week left" : `${weeks} weeks left`;

  const months = Math.max(1, Math.round(days / 30.44));
  return months === 1 ? "1 month left" : `${months} months left`;
}
