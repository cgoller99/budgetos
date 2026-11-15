/** Bounded worker for approved business tasks. Handlers are local read-only inventories. */
import { readFile, writeFile, rename, mkdir, open, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, join } from "node:path";
import { isDue } from "../lib/jarvis/queuePolicy.mjs";
import { getBusinessHandler } from "../lib/jarvis/businessHandlers.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;
export const MAX_AUDIT_ENTRIES = 50;
const root = process.cwd();
const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-executions");
const lockPath = queuePath + ".lock";
const maxAttempts = 3;
const leaseMs = 10 * 60 * 1000;
const now = () => new Date().toISOString();
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-business-worker";
const hasApprovalAudit = task => Array.isArray(task.audit) &&
  task.audit.some(entry => entry?.type === "approved");

function audit(task, type, details = {}) {
  if (!Array.isArray(task.audit)) task.audit = [];
  task.audit.push({ type, actor, at: now(), ...details });
  if (task.audit.length > MAX_AUDIT_ENTRIES) task.audit = task.audit.slice(-MAX_AUDIT_ENTRIES);
}

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
    if (error.code === "EEXIST") throw Error("Queue locked; retry later");
    throw error;
  }
  try {
    const tasks = await load();
    const result = await operation(tasks);
    const temporary = `${queuePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(tasks, null, 2) + "\n", { mode: 0o600 });
    await rename(temporary, queuePath);
    return result;
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}

function executionId(task) {
  return createHash("sha256").update(`${task.id}:${task.attempts}`).digest("hex").slice(0, 20);
}

function retryDelay() {
  const configured = Number(process.env.JARVIS_RETRY_DELAY_MS);
  return Number.isFinite(configured) && configured >= 0
    ? Math.min(configured, 15 * 60 * 1000)
    : 1000;
}

async function reconcile() {
  await locked(async tasks => {
    for (const task of tasks.filter(item => item.status === "running")) {
      const resultPath = join(resultDir, `${task.executionId}.json`);
      let record;
      try {
        record = JSON.parse(await readFile(resultPath, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (record?.status === "completed" && record.taskId === task.id && record.executionId === task.executionId &&
        record.business === task.business && record.result?.business === task.business) {
        task.status = "completed";
        task.completedAt = record.completedAt;
        task.resultPath = relative(root, resultPath).replaceAll("\\", "/");
        audit(task, "reconciled_completed", { executionId: task.executionId });
      } else if (record?.status === "completed" && record.taskId === task.id && record.executionId === task.executionId &&
        (record.business !== task.business || record.result?.business !== task.business)) {
        task.status = (task.attempts ?? 0) < maxAttempts ? "approved" : "failed";
        task.lastError = "Execution result failed business isolation validation";
        task.failedAt = now();
        audit(task, "result_rejected", { attempts: task.attempts ?? 0, status: task.status });
      } else if (Date.now() - Date.parse(task.startedAt ?? "") > leaseMs) {
        task.status = (task.attempts ?? 0) < maxAttempts ? "approved" : "failed";
        task.lastError = "Execution lease expired before result persistence";
        task.failedAt = now();
        audit(task, "lease_expired", { attempts: task.attempts ?? 0, status: task.status });
      }
    }
  });
}

async function blockUnsafe() {
  await locked(tasks => {
    for (const task of tasks) {
      if (task.status !== "approved" || !task.reviewedAt || !hasApprovalAudit(task)) continue;
      const reason = task.risk === "high"
        ? "High-risk work requires a separate reviewed flow"
        : !getBusinessHandler(task.business, task.model?.kind, task) ? "No business handler registered" : null;
      if (!reason) continue;
      task.status = "blocked";
      task.blockedAt = now();
      audit(task, "blocked", { reason });
    }
  });
}

async function claim() {
  return locked(tasks => {
    const task = tasks.find(item =>
      item.status === "approved" &&
      item.reviewedAt &&
      hasApprovalAudit(item) &&
      item.risk !== "high" &&
      isDue(item) &&
      (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= Date.now()) &&
      (item.attempts ?? 0) < maxAttempts &&
      getBusinessHandler(item.business, item.model?.kind)
    );
    if (!task) return null;
    task.status = "running";
    task.startedAt = now();
    task.attempts = (task.attempts ?? 0) + 1;
    task.executionId = executionId(task);
    task.nextAttemptAt = undefined;
    audit(task, "claimed", { executionId: task.executionId, attempt: task.attempts });
    return { ...task };
  });
}

async function complete(claimed, record, resultPath) {
  await locked(tasks => {
    const task = tasks.find(item => item.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) throw Error("Execution claim changed");
    task.status = "completed";
    task.completedAt = record.completedAt;
    task.resultPath = relative(root, resultPath).replaceAll("\\", "/");
    audit(task, "completed", { executionId: claimed.executionId, resultPath: task.resultPath });
  });
}

async function fail(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(item => item.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) return;
    task.status = task.attempts < maxAttempts ? "approved" : "failed";
    task.lastError = String(error.message ?? error).slice(0, 500);
    task.failedAt = now();
    if (task.status === "approved") task.nextAttemptAt = new Date(Date.now() + retryDelay()).toISOString();
    audit(task, "failed", {
      attempt: task.attempts,
      status: task.status,
      error: task.lastError,
      nextAttemptAt: task.nextAttemptAt,
    });
  });
}

await reconcile();
const claimed = await claim();
if (!claimed) {
  console.log("No approved, due, safe business tasks available.");
  process.exit(0);
}

try {
  if (process.env.JARVIS_TEST_FAIL_ONCE === `${claimed.id}:${claimed.attempts}`) {
    throw Error("Injected handler failure for retry test");
  }
  const handler = getBusinessHandler(claimed.business, claimed.model.kind);
  if (!handler) throw Error("No handler registered for business and task kind");
  const isolatedTask = Object.freeze({
    id: claimed.id,
    title: claimed.title,
    business: claimed.business,
    businessName: claimed.businessName,
    risk: claimed.risk,
    model: claimed.model,
  });
  const result = await handler({ root, task: isolatedTask });
  if (!result || result.business !== claimed.business || result.kind !== claimed.model.kind) {
    throw Error("Handler returned a cross-business or invalid result");
  }
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    businessName: claimed.businessName,
    kind: claimed.model.kind,
    title: claimed.title,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt: now(),
    result,
  };
  await mkdir(resultDir, { recursive: true });
  const resultPath = join(resultDir, `${claimed.executionId}.json`);
  await writeFile(resultPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  await complete(claimed, record, resultPath);
  console.log(JSON.stringify({ taskId: claimed.id, business: claimed.business, status: "completed", resultPath }, null, 2));
} catch (error) {
  await fail(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
