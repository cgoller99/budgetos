/** Bounded, local-only Jarvis queue for three business scopes.
 * It records proposals and approvals but never performs external actions.
 */
import { mkdir, open, readFile, rename, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { classifyJarvisTask, selectJarvisModel } from "../lib/jarvis/modelRouting.ts";

export const BUSINESSES = {
  buxme: { name: "Buxme", description: "Personal finance product and growth" },
  websiteAgency: { name: "Website-building agency", description: "Client website delivery" },
  driveNest: { name: "DriveNest Auto Care", description: "Automotive service operations" },
};

const idPattern = /^[a-z][a-z0-9-]{2,39}$/;
const businessPattern = /^[a-z][a-zA-Z0-9]{2,31}$/;
const queuePath = resolve(process.env.JARVIS_BUSINESS_QUEUE_PATH ?? "data/jarvis-business-queue.json");
const lockPath = `${queuePath}.lock`;
const now = () => new Date().toISOString();

export function audit(task, event, details = {}, at = now()) {
  task.audit ??= [];
  task.audit.push({ event, at, ...details });
  if (task.audit.length > 50) task.audit = task.audit.slice(-50);
}

export function createTask({ id, business, title, dueAt, env = process.env }) {
  if (!idPattern.test(id ?? "")) throw Error("Task id must be a safe slug.");
  if (!Object.hasOwn(BUSINESSES, business)) throw Error("Unknown business scope.");
  if (!title?.trim() || title.length > 180 || /[\r\n]/.test(title)) throw Error("Title must be 1-180 characters without newlines.");
  if (dueAt && Number.isNaN(Date.parse(dueAt))) throw Error("dueAt must be an ISO timestamp.");
  const kind = classifyJarvisTask(title);
  const task = {
    id, business, businessName: BUSINESSES[business].name, title: title.trim(),
    status: "proposed", requiresApproval: true, attempts: 0, dueAt: dueAt ?? now(),
    route: selectJarvisModel(kind, env), createdAt: now(), audit: [],
  };
  audit(task, "created", { business, status: task.status, route: task.route.model });
  return task;
}

export function approveTask(task, at = now()) {
  if (task.status !== "proposed") throw Error("Only proposed tasks can be approved.");
  task.status = "approved";
  task.approvedAt = at;
  audit(task, "approved", { approvalGate: "human", status: task.status }, at);
}

export function claimDueTask(tasks, at = now()) {
  const due = tasks
    .filter(task => task.status === "approved" && Date.parse(task.dueAt) <= Date.parse(at))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const task = due[0];
  if (!task) return null;
  task.status = "claimed";
  task.attempts += 1;
  task.claimedAt = at;
  audit(task, "claimed", { status: task.status, execution: "not_started" }, at);
  return task;
}

export function completeTask(task, result, at = now()) {
  if (task.status !== "claimed") throw Error("Only claimed tasks can be completed.");
  task.status = "completed";
  task.completedAt = at;
  task.result = String(result ?? "").slice(0, 500);
  audit(task, "completed", { status: task.status, execution: "recorded_only" }, at);
}

async function load() {
  try {
    const data = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(data)) throw Error("Invalid business queue.");
    return data;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function locked(operation) {
  await mkdir(dirname(queuePath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw Error("Business queue locked; retry later.");
    throw error;
  }
  try {
    const tasks = await load();
    const result = await operation(tasks);
    const temporary = `${queuePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, queuePath);
    return result;
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => {});
  }
}

const [command, ...args] = process.argv.slice(2);
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/jarvis-business-queue.mjs")) {
  if (command === "list") {
    console.log(JSON.stringify(await load(), null, 2));
  } else if (command === "add") {
    const [id, business, title, dueAt] = args;
    await locked(tasks => {
      if (tasks.some(task => task.id === id)) throw Error("Task already exists.");
      if (tasks.length >= 200) throw Error("Queue capacity reached.");
      tasks.push(createTask({ id, business, title, dueAt }));
    });
    console.log("Business task proposed; human approval required.");
  } else if (command === "approve") {
    await locked(tasks => {
      const task = tasks.find(item => item.id === args[0]);
      if (!task) throw Error("Task not found.");
      approveTask(task);
    });
    console.log("Approval recorded; no action executed.");
  } else if (command === "claim") {
    const task = await locked(tasks => claimDueTask(tasks, args[0] || now()));
    console.log(task ? `Claimed ${task.id}; execution remains disabled.` : "No approved task is due.");
  } else if (command === "complete") {
    await locked(tasks => {
      const task = tasks.find(item => item.id === args[0]);
      if (!task) throw Error("Task not found.");
      completeTask(task, args.slice(1).join(" "));
    });
    console.log("Completion recorded; no external action executed.");
  } else {
    throw Error("Usage: add <id> <buxme|websiteAgency|driveNest> <title> [dueAt] | list | approve <id> | claim [now] | complete <id> <result>");
  }
}
