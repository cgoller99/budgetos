/** Load only reviewed, bounded, read-only work for the existing Jarvis worker. */
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BUSINESSES, classifyTask, routeModel } from "../lib/jarvis/queuePolicy.mjs";
import { isScheduleWithinBound, MAX_FUTURE_SCHEDULED_TASKS } from "../lib/jarvis/scheduledDispatch.mjs";

const sourcePath = resolve(process.env.JARVIS_APPROVED_TASKS_PATH ?? "data/jarvis-scheduled-tasks.json");
const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const auditPath = resolve(process.env.JARVIS_RUN_AUDIT_PATH ?? "jarvis-output/scheduler-runs.jsonl");
const MAX_TASKS = 200;
const WINDOW_MS = 15 * 60 * 1000;
const idPattern = /^[a-z][a-z0-9-]{2,39}$/;
const now = () => new Date().toISOString();

function invalid(message) {
  throw new Error(`Invalid Jarvis approval manifest: ${message}`);
}

function normalize(task, index) {
  if (!task || typeof task !== "object") invalid(`entry ${index} is not an object`);
  if (!idPattern.test(task.id ?? "")) invalid(`entry ${index} has an invalid id`);
  if (!BUSINESSES[task.business]) invalid(`entry ${task.id} has an unsupported business`);
  if (task.status !== "approved") invalid(`entry ${task.id} is not approved`);
  if (task.risk === "high") invalid(`entry ${task.id} is high risk`);
  if (!task.reviewedAt || Number.isNaN(Date.parse(task.reviewedAt))) {
    invalid(`entry ${task.id} is missing reviewedAt`);
  }
  if (!Array.isArray(task.audit) || !task.audit.some(event => event?.type === "approved")) {
    invalid(`entry ${task.id} is missing an approval audit event`);
  }
  if (typeof task.title !== "string" || !task.title.trim() || task.title.length > 180 || /[\r\n]/.test(task.title)) {
    invalid(`entry ${task.id} has an invalid title`);
  }
  if (!task.scheduledAt || !isScheduleWithinBound(task.scheduledAt)) {
    invalid(`entry ${task.id} has a schedule outside the 90-day bound`);
  }
  const kind = task.model?.kind ?? classifyTask(task.title);
  const route = routeModel(kind);
  return {
    ...task,
    businessName: BUSINESSES[task.business].name,
    attempts: Number.isInteger(task.attempts) && task.attempts >= 0 ? task.attempts : 0,
    model: { kind, model: route.model },
    audit: [...task.audit, { type: "trigger_loaded", actor: "jarvis-scheduled-trigger", at: now() }],
  };
}

const manifest = JSON.parse(await readFile(sourcePath, "utf8"));
if (!Array.isArray(manifest)) invalid("root must be an array");
if (manifest.length > MAX_TASKS) invalid(`more than ${MAX_TASKS} tasks`);

const normalized = manifest.map(normalize);
const ids = new Set();
for (const task of normalized) {
  if (ids.has(task.id)) invalid(`duplicate task id ${task.id}`);
  ids.add(task.id);
}
const futureCount = normalized.filter(task => Date.parse(task.scheduledAt) > Date.now()).length;
if (futureCount > MAX_FUTURE_SCHEDULED_TASKS) invalid("future schedule capacity reached");

const currentTime = Date.now();
const due = normalized.filter(task => {
  const timestamp = Date.parse(task.scheduledAt);
  return timestamp >= currentTime - WINDOW_MS && timestamp <= currentTime + WINDOW_MS;
});

await mkdir(dirname(queuePath), { recursive: true });
const temporary = `${queuePath}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(due, null, 2)}\n`, { mode: 0o600 });
await rename(temporary, queuePath);
await mkdir(dirname(auditPath), { recursive: true });
await appendFile(auditPath, `${JSON.stringify({
  actor: "jarvis-scheduled-trigger",
  at: now(),
  loaded: due.map(task => task.id),
  skippedOutsideWindow: normalized.length - due.length,
})}\n`, { mode: 0o600 });
console.log(JSON.stringify({ loaded: due.length, skippedOutsideWindow: normalized.length - due.length }));
