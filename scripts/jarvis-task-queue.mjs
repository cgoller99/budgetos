/** Local, durable proposal queue. Queue transitions are audited; approval never executes work. */
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { BUSINESSES, classifyTask, routeModel, riskFor, isDue } from "../lib/jarvis/queuePolicy.mjs";
import { isScheduleWithinBound, MAX_FUTURE_SCHEDULED_TASKS } from "../lib/jarvis/scheduledDispatch.mjs";
const path = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const lockPath = path + ".lock";
const [command, ...args] = process.argv.slice(2);
const idPattern = /^[a-z][a-z0-9-]{2,39}$/;
const iso = value => new Date(value).toISOString();
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-cli";
async function load() {
  try { const data = JSON.parse(await readFile(path, "utf8")); if (!Array.isArray(data)) throw Error("Invalid queue"); return data; }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
function event(type, details = {}) { return { type, actor, at: new Date().toISOString(), ...details }; }
async function locked(operation) {
  await mkdir(dirname(path), { recursive: true });
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw Error("Queue locked; retry later."); throw error; }
  try {
    const tasks = await load();
    const result = await operation(tasks);
    const tmp = path + ".tmp";
    await writeFile(tmp, JSON.stringify(tasks, null, 2) + "\n", { flag: "w", mode: 0o600 });
    await rename(tmp, path);
    return result;
  } finally { await lock.close(); await unlink(lockPath); }
}
if (command === "list") console.log(JSON.stringify(await load(), null, 2));
else if (command === "add") {
  const [id, first, ...rest] = args;
  const business = BUSINESSES[first] ? first : "buxme";
  const title = (BUSINESSES[first] ? rest : [first, ...rest]).join(" ").trim();
  if (!idPattern.test(id ?? "") || !BUSINESSES[business] || !title || title.length > 180 || /[\r\n]/.test(title))
    throw Error("Usage: add <safe-slug> <business: buxme|website-agency|drivenest> <title max 180 chars>");
  await locked(tasks => {
    if (tasks.some(t => t.id === id)) throw Error("Task already exists.");
    if (tasks.length >= 200) throw Error("Queue capacity reached.");
    const kind = classifyTask(title);
    tasks.push({
      id, title, business, businessName: BUSINESSES[business].name, status: "proposed", attempts: 0,
      risk: riskFor(title), model: routeModel(kind), createdAt: new Date().toISOString(),
      audit: [event("proposed", { business, title })],
    });
  });
  console.log("Task proposed.");
} else if (command === "schedule") {
  const [id, when] = args;
  if (!idPattern.test(id ?? "") || !when || Number.isNaN(Date.parse(when))) throw Error("Usage: schedule <safe-slug> <ISO timestamp>");
  if (!isScheduleWithinBound(when)) throw Error("Schedule must be within 90 days.");
  await locked(tasks => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status !== "proposed") throw Error("Only proposed tasks can be scheduled.");
    const scheduledCount = tasks.filter(item =>
      item.scheduledAt && !isDue(item) && ["proposed", "approved"].includes(item.status),
    ).length;
    if (scheduledCount >= MAX_FUTURE_SCHEDULED_TASKS) throw Error("Future schedule capacity reached.");
    task.scheduledAt = iso(when);
    (task.audit ??= []).push(event("scheduled", { scheduledAt: task.scheduledAt }));
  });
  console.log("Task scheduled.");
} else if (command === "review") {
  const [id, decision] = args;
  if (!idPattern.test(id ?? "") || !["approved", "rejected"].includes(decision)) throw Error("Usage: review <safe-slug> <approved|rejected>");
  await locked(tasks => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status !== "proposed") throw Error("Task must be proposed.");
    if (!isDue(task)) throw Error("Task is scheduled for a future time.");
    task.status = decision; task.reviewedAt = new Date().toISOString();
    (task.audit ??= []).push(event(decision, { risk: task.risk, business: task.business }));
  });
  console.log("Task review recorded. No execution performed.");
} else throw Error("Usage: jarvis-task-queue.mjs <list|add|review>");
