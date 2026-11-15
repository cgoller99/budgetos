/** Durable, approval-gated worker for the scoped business queue. */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { getBusinessHandler } from "../lib/jarvis/businessHandlers.mjs";
import { BUSINESSES, isDue } from "../lib/jarvis/queuePolicy.mjs";

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-executions");
const lockPath = `${queuePath}.lock`;
const maxAttempts = 3;
const leaseMs = 10 * 60 * 1000;
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-business-worker";
const now = () => new Date().toISOString();
const event = (type, details = {}) => ({ type, actor, at: now(), ...details });

async function load() {
  try {
    const tasks = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(tasks)) throw Error("Invalid queue");
    return tasks;
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
    if (error.code === "EEXIST") throw Error("Queue locked; retry later.");
    throw error;
  }
  try {
    const tasks = await load();
    const result = await operation(tasks);
    const temp = `${queuePath}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
    await rename(temp, queuePath);
    return result;
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => {});
  }
}

function hasApproval(task) {
  return task.status === "approved" &&
    Array.isArray(task.audit) &&
    task.audit.some(record => record.type === "approved");
}

function executionId(task) {
  return createHash("sha256")
    .update(`${task.id}:${task.attempts}:${task.business}`)
    .digest("hex")
    .slice(0, 20);
}

async function reconcile(tasks) {
  for (const task of tasks.filter(item => item.status === "running")) {
    const resultPath = join(resultDir, `${task.executionId}.json`);
    let result;
    try {
      result = JSON.parse(await readFile(resultPath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (result?.taskId === task.id && result?.executionId === task.executionId && result.status === "completed") {
      task.status = "completed";
      task.completedAt = result.completedAt;
      task.resultPath = relative(process.cwd(), resultPath).replaceAll("\\", "/");
      (task.audit ??= []).push(event("completed_reconciled", { executionId: task.executionId }));
    } else if (Date.now() - Date.parse(task.startedAt ?? "") > leaseMs) {
      task.status = task.attempts < maxAttempts ? "approved" : "failed";
      task.lastError = "Execution lease expired before result persistence";
      task.failedAt = now();
      (task.audit ??= []).push(event(task.status === "approved" ? "retry_scheduled" : "failed", {
        executionId: task.executionId,
        attempts: task.attempts,
        reason: task.lastError,
      }));
    }
  }
}

await locked(async tasks => {
  await reconcile(tasks);
});

const claimed = await locked(tasks => {
  const task = tasks.find(item =>
    hasApproval(item) &&
    isDue(item) &&
    BUSINESSES[item.business] &&
    getBusinessHandler(item.business) &&
    (item.attempts ?? 0) < maxAttempts,
  );
  if (!task) return null;
  task.status = "running";
  task.startedAt = now();
  task.attempts = (task.attempts ?? 0) + 1;
  task.executionId = executionId(task);
  (task.audit ??= []).push(event("claimed", {
    business: task.business,
    executionId: task.executionId,
    attempt: task.attempts,
  }));
  return { ...task, audit: undefined };
});

if (!claimed) {
  console.log("No approved, due, business-isolated tasks available.");
  process.exit(0);
}

const handler = getBusinessHandler(claimed.business);
try {
  const result = await handler.run({ root: process.cwd(), task: claimed });
  const completedAt = now();
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    handler: handler.name,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt,
    result,
  };
  await mkdir(resultDir, { recursive: true });
  const resultPath = join(resultDir, `${claimed.executionId}.json`);
  await writeFile(resultPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await locked(tasks => {
    const task = tasks.find(item => item.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) throw Error("Execution claim changed");
    task.status = "completed";
    task.completedAt = completedAt;
    task.resultPath = relative(process.cwd(), resultPath).replaceAll("\\", "/");
    (task.audit ??= []).push(event("completed", {
      business: task.business,
      executionId: task.executionId,
      resultPath: task.resultPath,
    }));
  });
  console.log(JSON.stringify({ taskId: claimed.id, business: claimed.business, status: "completed", resultPath }, null, 2));
} catch (error) {
  await locked(tasks => {
    const task = tasks.find(item => item.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) return;
    task.status = task.attempts < maxAttempts ? "approved" : "failed";
    task.lastError = String(error.message).slice(0, 500);
    task.failedAt = now();
    (task.audit ??= []).push(event(task.status === "approved" ? "retry_scheduled" : "failed", {
      business: task.business,
      executionId: task.executionId,
      attempts: task.attempts,
      error: task.lastError,
    }));
  });
  console.error(error);
  process.exitCode = 1;
}
