/** One bounded worker pass for approved, due, low/medium-risk business tasks. */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { BUSINESSES, isDue, riskFor } from "../lib/jarvis/queuePolicy.mjs";
import { getBusinessHandler } from "../lib/jarvis/businessHandlers.mjs";

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-executions");
const lockPath = `${queuePath}.lock`;
export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-business-worker";
const now = () => new Date().toISOString();

async function load() {
  try {
    const tasks = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(tasks)) throw new Error("Invalid queue");
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
    if (error.code === "EEXIST") throw new Error("Queue locked; retry later.");
    throw error;
  }
  try {
    const tasks = await load();
    const result = await operation(tasks);
    const temporary = `${queuePath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, queuePath);
    return result;
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => {});
  }
}

function audit(task, type, details = {}) {
  (task.audit ??= []).push({ type, actor, at: now(), ...details });
  if (task.audit.length > 100) task.audit = task.audit.slice(-100);
}

function approved(task) {
  return task.status === "approved" &&
    task.reviewedAt &&
    Array.isArray(task.audit) &&
    task.audit.some(entry =>
      entry.type === "approved" &&
      entry.business === task.business,
    );
}

function safeTask(task) {
  return approved(task) &&
    isDue(task) &&
    BUSINESSES[task.business]?.name === task.businessName &&
    riskFor(task.title ?? "") !== "high" &&
    Boolean(getBusinessHandler(task.business)) &&
    (task.attempts ?? 0) < MAX_ATTEMPTS &&
    (!task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= Date.now());
}

async function blockUnsafeTasks() {
  await locked(tasks => {
    for (const task of tasks) {
      if (!approved(task)) continue;
      const identityValid = BUSINESSES[task.business]?.name === task.businessName;
      const highRisk = riskFor(task.title ?? "") === "high";
      const handlerAvailable = Boolean(getBusinessHandler(task.business));
      if (identityValid && !highRisk && handlerAvailable) continue;
      task.status = "blocked";
      task.blockedAt = now();
      audit(task, "blocked", {
        reason: !identityValid
          ? "Business identity does not match the registered business scope"
          : highRisk
            ? "High-risk work requires a separate reviewed flow"
            : "No handler is registered for this business",
      });
    }
  });
}

function executionId(task) {
  return createHash("sha256")
    .update(`${task.id}:${task.business}:${task.attempts}`)
    .digest("hex")
    .slice(0, 20);
}

async function readResult(executionId) {
  try {
    return JSON.parse(await readFile(join(resultDir, `${executionId}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function reconcile(tasks) {
  for (const task of tasks.filter(item => item.status === "running")) {
    const record = await readResult(task.executionId);
    if (
      record?.taskId === task.id &&
      record?.executionId === task.executionId &&
      record?.business === task.business &&
      record.status === "completed"
    ) {
      task.status = "completed";
      task.completedAt = record.completedAt;
      task.resultPath = relative(process.cwd(), join(resultDir, `${task.executionId}.json`)).replaceAll("\\", "/");
      audit(task, "completed_reconciled", { executionId: task.executionId });
      continue;
    }
    const started = Date.parse(task.startedAt ?? "");
    if (!Number.isFinite(started) || Date.now() - started <= LEASE_MS) continue;
    task.status = (task.attempts ?? 0) < MAX_ATTEMPTS ? "approved" : "failed";
    task.lastError = "Execution lease expired before result persistence";
    task.failedAt = now();
    audit(task, task.status === "approved" ? "retry_scheduled" : "failed", {
      executionId: task.executionId,
      attempts: task.attempts ?? 0,
      reason: task.lastError,
    });
  }
}

async function persistResult(record) {
  await mkdir(resultDir, { recursive: true });
  const resultPath = join(resultDir, `${record.executionId}.json`);
  const existing = await readResult(record.executionId);
  if (existing) {
    if (
      existing.taskId !== record.taskId ||
      existing.business !== record.business ||
      existing.status !== "completed"
    ) throw new Error("Execution result identity conflict");
    return resultPath;
  }
  const temporary = `${resultPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, resultPath);
  return resultPath;
}

async function fail(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(item =>
      item.id === claimed.id &&
      item.business === claimed.business &&
      item.executionId === claimed.executionId &&
      item.status === "running",
    );
    if (!task) return;
    task.status = task.attempts < MAX_ATTEMPTS ? "approved" : "failed";
    task.lastError = String(error?.message ?? error).slice(0, 500);
    task.failedAt = now();
    if (task.status === "approved") {
      const delay = Math.min(15 * 60 * 1000, 1000 * 2 ** Math.max(0, task.attempts - 1));
      task.nextAttemptAt = new Date(Date.now() + delay).toISOString();
    }
    audit(task, task.status === "approved" ? "retry_scheduled" : "failed", {
      executionId: task.executionId,
      attempts: task.attempts,
      error: task.lastError,
      nextAttemptAt: task.nextAttemptAt,
    });
  });
}

await blockUnsafeTasks();
await locked(reconcile);
const claimed = await locked(tasks => {
  const task = tasks.find(safeTask);
  if (!task) return null;
  task.status = "running";
  task.startedAt = now();
  task.attempts = (task.attempts ?? 0) + 1;
  task.nextAttemptAt = undefined;
  task.executionId = executionId(task);
  audit(task, "claimed", {
    business: task.business,
    executionId: task.executionId,
    attempt: task.attempts,
  });
  return { ...task, audit: undefined };
});

if (!claimed) {
  console.log("No approved, due, business-isolated tasks available.");
  process.exit(0);
}

try {
  const handler = getBusinessHandler(claimed.business);
  const result = await handler.run({
    root: process.cwd(),
    task: Object.freeze({
      id: claimed.id,
      title: claimed.title,
      business: claimed.business,
      businessName: claimed.businessName,
    }),
  });
  if (result?.taskId !== claimed.id || result?.business !== claimed.business) {
    throw new Error("Handler returned an invalid business result");
  }
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
  const resultPath = await persistResult(record);
  await locked(tasks => {
    const task = tasks.find(item =>
      item.id === claimed.id &&
      item.business === claimed.business &&
      item.executionId === claimed.executionId &&
      item.status === "running",
    );
    if (!task) throw new Error("Execution claim changed");
    task.status = "completed";
    task.completedAt = completedAt;
    task.resultPath = relative(process.cwd(), resultPath).replaceAll("\\", "/");
    audit(task, "completed", {
      business: task.business,
      executionId: task.executionId,
      resultPath: task.resultPath,
    });
  });
  console.log(JSON.stringify({ taskId: claimed.id, business: claimed.business, status: "completed", resultPath }, null, 2));
} catch (error) {
  await fail(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
