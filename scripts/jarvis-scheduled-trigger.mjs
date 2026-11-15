/** Build one bounded execution queue from the reviewed repository manifest. */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BUSINESSES, classifyTask, routeModel } from "../lib/jarvis/queuePolicy.mjs";

const sourcePath = resolve(process.env.JARVIS_APPROVED_TASKS_PATH ?? "data/jarvis-scheduled-tasks.json");
const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const MAX_TASKS = 200;
const TRIGGER_WINDOW_MS = 15 * 60 * 1000;
const idPattern = /^[a-z][a-z0-9-]{2,39}$/;
const now = () => new Date().toISOString();

function fail(message) {
  throw new Error(`Invalid Jarvis approval manifest: ${message}`);
}

function normalize(task, index) {
  if (!task || typeof task !== "object") fail(`entry ${index} is not an object`);
  if (!idPattern.test(task.id ?? "")) fail(`entry ${index} has an invalid id`);
  if (!BUSINESSES[task.business]) fail(`entry ${task.id} has an unsupported business`);
  if (task.status !== "approved") fail(`entry ${task.id} is not approved`);
  if (!task.reviewedAt || Number.isNaN(Date.parse(task.reviewedAt))) {
    fail(`entry ${task.id} is missing a valid reviewedAt timestamp`);
  }
  if (!Array.isArray(task.audit) || !task.audit.some(event => event?.type === "approved")) {
    fail(`entry ${task.id} is missing an approval audit event`);
  }
  if (typeof task.title !== "string" || !task.title.trim() || task.title.length > 180 || /[\r\n]/.test(task.title)) {
    fail(`entry ${task.id} has an invalid title`);
  }
  if (!task.scheduledAt || Number.isNaN(Date.parse(task.scheduledAt))) {
    fail(`entry ${task.id} has an invalid scheduledAt timestamp`);
  }
  const kind = task.model?.kind ?? classifyTask(task.title);
  const model = routeModel(kind);
  return {
    ...task,
    businessName: BUSINESSES[task.business].name,
    attempts: Number.isInteger(task.attempts) && task.attempts >= 0 ? task.attempts : 0,
    risk: task.risk ?? "low",
    model: { kind, model: task.model?.model ?? model.model },
    audit: [...task.audit, { type: "trigger_loaded", actor: "jarvis-scheduled-trigger", at: now() }],
  };
}

const manifest = JSON.parse(await readFile(sourcePath, "utf8"));
if (!Array.isArray(manifest)) fail("root must be an array");
if (manifest.length > MAX_TASKS) fail(`more than ${MAX_TASKS} tasks`);
const normalized = manifest.map(normalize);
const ids = new Set();
for (const task of normalized) {
  if (ids.has(task.id)) fail(`duplicate task id ${task.id}`);
  ids.add(task.id);
}
const currentTime = Date.now();
const queue = normalized.filter(task => {
  const scheduledTime = Date.parse(task.scheduledAt);
  return scheduledTime >= currentTime - TRIGGER_WINDOW_MS &&
    scheduledTime <= currentTime + TRIGGER_WINDOW_MS;
});

await mkdir(dirname(queuePath), { recursive: true });
const temporary = `${queuePath}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(queue, null, 2)}\n`, { mode: 0o600 });
await rename(temporary, queuePath);
console.log(JSON.stringify({ loaded: queue.length, skippedOutsideWindow: normalized.length - queue.length, queuePath }));
