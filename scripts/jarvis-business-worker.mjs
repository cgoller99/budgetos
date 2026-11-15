/** One bounded, approval-gated, read-only execution per invocation. */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { isDue, routeForTask } from "../lib/jarvis/queuePolicy.mjs";
import { handlerFor } from "../lib/jarvis/businessHandlers.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;
export const MAX_AUDIT_ENTRIES = 50;
const root = process.cwd();
const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-executions");
const lockPath = `${queuePath}.lock`;
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-business-worker";
const now = () => new Date().toISOString();

function audit(task, type, details = {}) {
  (task.audit ??= []).push({ event: type, type, actor, at: now(), ...details });
  if (task.audit.length > MAX_AUDIT_ENTRIES) task.audit = task.audit.slice(-MAX_AUDIT_ENTRIES);
}

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
    if (error.code === "EEXIST") throw new Error("Queue locked; retry later");
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

function executionId(task) {
  return createHash("sha256").update(`${task.id}:${task.attempts}`).digest("hex").slice(0, 20);
}

function safeRoute(task) {
  try {
    return routeForTask(task);
  } catch {
    return null;
  }
}

function retryDelay() {
  const configured = Number(process.env.JARVIS_RETRY_DELAY_MS ?? 1000);
  return Number.isFinite(configured) && configured >= 0
    ? Math.min(configured, 15 * 60 * 1000)
    : 1000;
}

function approvedByHuman(task) {
  return task.status === "approved" &&
    task.reviewedAt &&
    task.audit?.some(event => event.type === "approved");
}

async function reconcile() {
  await locked(async tasks => {
    for (const task of tasks.filter(item => item.status === "running")) {
      const resultPath = join(resultDir, `${task.executionId}.json`);
      try {
        const record = JSON.parse(await readFile(resultPath, "utf8"));
        if (record.taskId === task.id &&
          record.executionId === task.executionId &&
          record.claimId === task.claimId &&
          record.status === "completed") {
          task.status = "completed";
          task.completedAt = record.completedAt;
          task.resultPath = relative(root, resultPath).replaceAll("\\", "/");
          audit(task, "reconciled", { executionId: task.executionId });
          continue;
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const started = Date.parse(task.claimExpiresAt ?? task.startedAt ?? "") - LEASE_MS;
      if (!Number.isFinite(started) || Date.now() - started <= LEASE_MS) continue;
      const retry = (task.attempts ?? 0) < MAX_ATTEMPTS;
      task.status = retry ? "approved" : "failed";
      task.nextAttemptAt = retry ? new Date(Date.now() + retryDelay()).toISOString() : undefined;
      task.lastError = "Execution lease expired before result persistence";
      audit(task, retry ? "retry_scheduled" : "failed", { attempt: task.attempts ?? 0, reason: task.lastError });
    }
  });
}

async function blockUnsafe() {
  await locked(tasks => {
    for (const task of tasks) {
      if (!approvedByHuman(task)) continue;
      const reason = task.risk === "high"
        ? "High-risk work requires a separate reviewed flow"
        : !safeRoute(task) ? "Queued model route is invalid or unsupported"
          : !handlerFor(task.business, task.model?.kind, task) ? "No business handler registered" : null;
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
      approvedByHuman(item) &&
      item.risk !== "high" &&
      isDue(item) &&
      (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= Date.now()) &&
      (item.attempts ?? 0) < MAX_ATTEMPTS &&
      safeRoute(item) &&
      handlerFor(item.business, item.model?.kind, item),
    );
    if (!task) return null;
    task.status = "running";
    task.startedAt = now();
    task.attempts = (task.attempts ?? 0) + 1;
    task.executionId = executionId(task);
    task.claimId = randomUUID();
    task.claimExpiresAt = new Date(Date.now() + LEASE_MS).toISOString();
    task.nextAttemptAt = undefined;
    const route = safeRoute(task);
    audit(task, "claimed", {
      executionId: task.executionId,
      claimId: task.claimId,
      claimExpiresAt: task.claimExpiresAt,
      attempt: task.attempts,
      model: route.model,
    });
    return { ...task, route };
  });
}

async function markFailure(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(item => item.id === claimed.id);
    if (!task || task.status !== "running" ||
      task.executionId !== claimed.executionId || task.claimId !== claimed.claimId) {
      throw new Error("Execution claim changed");
    }
    const retry = task.attempts < MAX_ATTEMPTS;
    task.status = retry ? "approved" : "failed";
    task.nextAttemptAt = retry ? new Date(Date.now() + retryDelay()).toISOString() : undefined;
    task.lastError = String(error.message ?? error).slice(0, 500);
    task.failedAt = now();
    audit(task, retry ? "retry_scheduled" : "failed", { attempt: task.attempts, error: task.lastError });
  });
}

async function persistResult(record, resultPath) {
  await mkdir(dirname(resultPath), { recursive: true });
  try {
    const existing = JSON.parse(await readFile(resultPath, "utf8"));
    if (existing.taskId === record.taskId &&
      existing.executionId === record.executionId &&
      existing.claimId === record.claimId &&
      existing.status === "completed") return;
    throw new Error("Execution result already exists with different claim");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = `${resultPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, resultPath);
}

await reconcile();
await blockUnsafe();
const claimed = await claim();
if (!claimed) {
  console.log("No approved, due, safe business tasks available.");
  process.exit(0);
}

try {
  if (process.env.JARVIS_TEST_FAIL_ONCE === `${claimed.id}:${claimed.attempts}`) throw new Error("Injected handler failure");
  const handler = handlerFor(claimed.business, claimed.model.kind, claimed);
  if (!handler || !claimed.route) throw new Error("Execution route is no longer available");
  const result = await handler({ root, task: claimed, route: claimed.route });
  if (!result || result.sideEffects?.length) throw new Error("Business handler returned unsafe side effects");
  const resultPath = join(resultDir, `${claimed.executionId}.json`);
  const completedAt = now();
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    businessName: claimed.businessName,
    kind: claimed.model.kind,
    model: claimed.route.model,
    claimId: claimed.claimId,
    title: claimed.title,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt,
    audit: [
      ...claimed.audit,
      { event: "completed", type: "completed", actor, at: completedAt, executionId: claimed.executionId, claimId: claimed.claimId },
    ],
    result,
  };
  await persistResult(record, resultPath);
  await locked(tasks => {
    const task = tasks.find(item => item.id === claimed.id);
    if (!task || task.executionId !== claimed.executionId || task.claimId !== claimed.claimId) throw new Error("Execution claim changed");
    if (task.status === "completed") return;
    if (task.status !== "running") throw new Error("Execution claim changed");
    task.status = "completed";
    task.completedAt = record.completedAt;
    task.resultPath = relative(root, resultPath).replaceAll("\\", "/");
    audit(task, "completed", { executionId: claimed.executionId, resultPath: task.resultPath });
  });
  console.log(JSON.stringify({ taskId: claimed.id, business: claimed.business, status: "completed" }));
} catch (error) {
  await markFailure(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
