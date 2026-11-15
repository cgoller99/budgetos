export const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

const TASK_ID = /^[a-z0-9][a-z0-9-]{2,79}$/;

export function selectDueTask(tasks, now = Date.now()) {
  if (!Array.isArray(tasks)) throw new Error("Invalid approved task manifest");

  return tasks
    .filter(task => task?.status === "approved" && typeof task.scheduledAt === "string")
    .filter(task => TASK_ID.test(task.id ?? ""))
    .map(task => ({ task, scheduledTime: Date.parse(task.scheduledAt) }))
    .filter(({ scheduledTime }) => Number.isFinite(scheduledTime) && scheduledTime <= now)
    .sort((left, right) =>
      left.scheduledTime - right.scheduledTime || left.task.id.localeCompare(right.task.id))
    .at(0)?.task ?? null;
}
