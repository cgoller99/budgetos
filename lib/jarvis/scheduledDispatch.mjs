export const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_FUTURE_SCHEDULED_TASKS = 25;

export function isScheduleWithinBound(value, now = Date.now()) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) &&
    timestamp <= now + MAX_SCHEDULE_AHEAD_MS;
}
