/** Local, proposal-only durable task queue. Never executes code or external actions. */
import { mkdir, readFile, writeFile, rename, open } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const path = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const lockPath = path + ".lock";
const [command, ...args] = process.argv.slice(2);
const idPattern = /^[a-z][a-z0-9-]{2,39}$/;
const businesses = {
  buxme: "Buxme",
  "website-agency": "Website-building agency",
  drivenest: "DriveNest Auto Care",
};
const kinds = new Set(["coding", "business", "research", "routine"]);
async function load() {
  try { const data = JSON.parse(await readFile(path, "utf8")); if (!Array.isArray(data)) throw Error("Invalid queue"); return data; }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
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
  } finally { await lock.close(); const { unlink } = await import("node:fs/promises"); await unlink(lockPath); }
}
const now = () => new Date().toISOString();
const audit = (task, event, details = {}) => {
  if (!Array.isArray(task.audit)) task.audit = [];
  task.audit.push({ event, at: now(), ...details });
  if (task.audit.length > 50) task.audit = task.audit.slice(-50);
};
function parseAddTask(rawArgs) {
  const [id, ...rest] = rawArgs;
  const options = {};
  const titleWords = [];
  for (const value of rest) {
    const match = /^--(business|kind|run-at)=(.+)$/.exec(value);
    if (match) options[match[1]] = match[2];
    else titleWords.push(value);
  }
  const title = titleWords.join(" ").trim();
  const business = options.business ?? "buxme";
  const kind = options.kind ?? "routine";
  const runAt = options["run-at"] ?? now();
  if (!idPattern.test(id ?? "") || !title || title.length > 180 || /[\r\n]/.test(title))
    throw Error("Usage: add <safe-slug> <title> [--business=<buxme|website-agency|drivenest>] [--kind=<coding|business|research|routine>] [--run-at=<ISO timestamp>]");
  if (!Object.hasOwn(businesses, business)) throw Error("Unknown business scope.");
  if (!kinds.has(kind)) throw Error("Unknown task kind.");
  if (Number.isNaN(Date.parse(runAt))) throw Error("run-at must be a valid ISO timestamp.");
  return { id, title, business, kind, runAt: new Date(runAt).toISOString() };
}
if (command === "list") console.log(JSON.stringify(await load(), null, 2));
else if (command === "add") {
  const input = parseAddTask(args);
  await locked(tasks => {
    if (tasks.some(t => t.id === input.id)) throw Error("Task already exists.");
    if (tasks.length >= 200) throw Error("Queue capacity reached.");
    const task = {
      ...input,
      status: "proposed",
      approvalRequired: true,
      attempts: 0,
      createdAt: now(),
      audit: [],
    };
    audit(task, "created", { status: task.status, business: task.business });
    tasks.push(task);
  });
  console.log("Task proposed.");
} else if (command === "review") {
  const [id, decision] = args;
  if (!idPattern.test(id ?? "") || !["approved", "rejected"].includes(decision)) throw Error("Usage: review <safe-slug> <approved|rejected>");
  await locked(tasks => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status !== "proposed") throw Error("Task must be proposed.");
    task.status = decision; task.reviewedAt = now();
    audit(task, "reviewed", { status: decision, approvalGate: "human-review" });
  });
  console.log("Task review recorded. No execution performed.");
} else if (command === "due") {
  const at = args[0] ? Date.parse(args[0]) : Date.now();
  if (Number.isNaN(at)) throw Error("Usage: due [ISO timestamp]");
  console.log(JSON.stringify((await load()).filter(task =>
    task.status === "approved" && Date.parse(task.runAt ?? task.createdAt) <= at
  ), null, 2));
} else throw Error("Usage: jarvis-task-queue.mjs <list|add|review|due>");
