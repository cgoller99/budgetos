import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;

const nowIso = () => new Date().toISOString();

function appendAudit(task, event, details = {}, now = nowIso()) {
  if (!Array.isArray(task.audit)) task.audit = [];
  task.audit.push({ type: event, event, at: now, ...details });
  if (task.audit.length > 50) task.audit = task.audit.slice(-50);
}

async function readQueue(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(value)) throw new Error("Invalid Jarvis queue");
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function withQueueLock(path, operation) {
  const lockPath = `${path}.lock`;
  await mkdir(dirname(path), { recursive: true });
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Jarvis queue locked; retry later.");
    throw error;
  }
  try {
    const tasks = await readQueue(path);
    const result = await operation(tasks);
    const tempPath = `${path}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, path);
    return result;
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}

function executionId(task) {
  return createHash("sha256")
    .update(`${task.business}:${task.id}:${task.attempts}`)
    .digest("hex")
    .slice(0, 24);
}

function eligible(task, now) {
  return task.status === "approved"
    && isDue(task, now)
    && task.risk !== "high"
    && Number(task.attempts || 0) < MAX_ATTEMPTS;
}

function compareTasks(a, b) {
  return Number(b.priority || 0) - Number(a.priority || 0)
    || Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0)
    || String(a.id).localeCompare(String(b.id));
}

async function reconcileLeases({ queuePath, resultDir, rootDir, now }) {
  await withQueueLock(queuePath, async tasks => {
    for (const task of tasks.filter(item => item.status === "running")) {
      const resultPath = join(resultDir, `${task.executionId}.json`);
      let record;
      try {
        record = JSON.parse(await readFile(resultPath, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (record?.taskId === task.id && record.executionId === task.executionId && record.status === "completed") {
        task.status = "completed";
        task.completedAt = record.completedAt;
        task.resultPath = relative(rootDir, resultPath).replaceAll("\\", "/");
        appendAudit(task, "completed", { executionId: task.executionId }, nowIso());
      } else if (Date.parse(task.startedAt || 0) + LEASE_MS < now) {
        task.status = Number(task.attempts || 0) < MAX_ATTEMPTS ? "approved" : "failed";
        task.lastError = "Execution lease expired before result persistence";
        task.failedAt = nowIso();
        appendAudit(task, "lease_expired", {
          executionId: task.executionId,
          nextStatus: task.status,
        }, nowIso());
      }
    }
  });
}

/**
 * Run at most one safe task. Handlers are selected by business and classified
 * kind; a handler never receives tasks belonging to another business.
 */
export async function runOnce({
  queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json"),
  resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/executions"),
  rootDir = process.cwd(),
  handlers,
  clock = () => Date.now(),
  actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-worker",
} = {}) {
  const now = clock();
  await reconcileLeases({ queuePath, resultDir, rootDir, now });
  const claimed = await withQueueLock(queuePath, async tasks => {
    const blocked = tasks.filter(task => task.status === "approved" && isDue(task, now)
      && (task.risk === "high" || !handlers?.[task.business]?.[task.model?.kind]));
    for (const task of blocked) {
      if (task.risk === "high") {
        task.status = "blocked";
        appendAudit(task, "blocked", { reason: "high-risk tasks require a separate approved executor" }, nowIso());
      } else if (!handlers?.[task.business]?.[task.model?.kind]) {
        task.status = "blocked";
        appendAudit(task, "blocked", { reason: "no business-scoped handler registered" }, nowIso());
      }
    }
    const task = tasks.filter(item => eligible(item, now))
      .sort(compareTasks)
      .find(item => handlers?.[item.business]?.[item.model?.kind]);
    if (!task) return null;
    task.status = "running";
    task.startedAt = nowIso();
    task.attempts = Number(task.attempts || 0) + 1;
    task.executionId = executionId(task);
    task.handler = `${task.business}:${task.model.kind}`;
    appendAudit(task, "claimed", { actor, executionId: task.executionId, attempt: task.attempts }, nowIso());
    return { ...task };
  });
  if (!claimed) return { status: "idle" };

  const handler = handlers[claimed.business][claimed.model.kind];
  try {
    const result = await handler({
      task: claimed,
      business: claimed.business,
      rootDir,
      // Handlers may inspect local files, but have no network or credential API.
      readOnly: true,
    });
    const completedAt = nowIso();
    const record = {
      taskId: claimed.id,
      business: claimed.business,
      executionId: claimed.executionId,
      handler: claimed.handler,
      status: "completed",
      startedAt: claimed.startedAt,
      completedAt,
      result,
    };
    await mkdir(resultDir, { recursive: true });
    const resultPath = join(resultDir, `${claimed.executionId}.json`);
    await writeFile(resultPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await withQueueLock(queuePath, tasks => {
      const task = tasks.find(item => item.id === claimed.id);
      if (!task || task.status !== "running" || task.executionId !== claimed.executionId)
        throw new Error("Jarvis execution claim changed");
      task.status = "completed";
      task.completedAt = completedAt;
      task.resultPath = relative(rootDir, resultPath).replaceAll("\\", "/");
      appendAudit(task, "completed", { actor, executionId: task.executionId }, completedAt);
    });
    return { status: "completed", taskId: claimed.id, business: claimed.business, resultPath, result };
  } catch (error) {
    await withQueueLock(queuePath, tasks => {
      const task = tasks.find(item => item.id === claimed.id);
      if (!task || task.status !== "running" || task.executionId !== claimed.executionId) return;
      task.status = Number(task.attempts || 0) < MAX_ATTEMPTS ? "approved" : "failed";
      task.lastError = String(error?.message || error).slice(0, 500);
      task.failedAt = nowIso();
      appendAudit(task, task.status === "approved" ? "retry_scheduled" : "failed", {
        actor, executionId: task.executionId, attempt: task.attempts, nextStatus: task.status,
      }, task.failedAt);
    });
    return { status: "failed", taskId: claimed.id, error: String(error?.message || error) };
  }
}
