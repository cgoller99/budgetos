export const MAX_FUTURE_SCHEDULED_TASKS = 50;
export const MAX_SCHEDULE_DAYS = 90;

export function isScheduleWithinBound(value, now = Date.now()) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) &&
    timestamp >= now - 15 * 60 * 1000 &&
    timestamp <= now + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;
}
