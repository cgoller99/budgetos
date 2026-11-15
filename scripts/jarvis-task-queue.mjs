/** Local, proposal-only durable task queue. Never executes code or external actions. */
import { mkdir, readFile, writeFile, rename, open } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const path = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const lockPath = path + ".lock";
const [command, ...args] = process.argv.slice(2);
const idPattern = /^[a-z][a-z0-9-]{2,39}$/;
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
const audit = (task, event, details = {}) => {
  if (!Array.isArray(task.audit)) task.audit = [];
  task.audit.push({ event, at: new Date().toISOString(), ...details });
  if (task.audit.length > 50) task.audit = task.audit.slice(-50);
};
if (command === "list") console.log(JSON.stringify(await load(), null, 2));
else if (command === "add") {
  const [id, ...words] = args;
  const title = words.join(" ").trim();
  if (!idPattern.test(id ?? "") || !title || title.length > 180 || /[\r\n]/.test(title)) throw Error("Usage: add <safe-slug> <title max 180 chars>");
  await locked(tasks => {
    if (tasks.some(t => t.id === id)) throw Error("Task already exists.");
    if (tasks.length >= 200) throw Error("Queue capacity reached.");
    const task = {
      id, title, status: "proposed", attempts: 0, priority: 0,
      createdAt: new Date().toISOString(), audit: []
    };
    audit(task, "created", { status: task.status });
    tasks.push(task);
  });
  console.log("Task proposed.");
} else if (command === "review") {
  const [id, decision] = args;
  if (!idPattern.test(id ?? "") || !["approved", "rejected"].includes(decision)) throw Error("Usage: review <safe-slug> <approved|rejected>");
  await locked(tasks => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status !== "proposed") throw Error("Task must be proposed.");
    task.status = decision; task.reviewedAt = new Date().toISOString();
    audit(task, "reviewed", { status: decision });
  });
  console.log("Task review recorded. No execution performed.");
} else throw Error("Usage: jarvis-task-queue.mjs <list|add|review>");
