import { readFile, writeFile, rename, mkdir, open, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname, join, relative } from "node:path";
import { dispatchTask, handlerFor, isLeaseExpired, MAX_ATTEMPTS, validateClaimable } from "../lib/jarvis/businessWorker.mjs";

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-results");
const lockPath = `${queuePath}.lock`;
const actor = process.env.JARVIS_WORKER_ID?.trim() || "jarvis-business-worker";
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

function audit(task, type, details = {}) {
  (task.audit ??= []).push({ type, actor, at: now(), ...details });
}

async function locked(operation) {
  await mkdir(dirname(queuePath), { recursive: true });
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
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
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}

function executionId(task) {
  return createHash("sha256").update(`${task.id}:${task.attempts}`).digest("hex").slice(0, 20);
}

async function reconcile() {
  await locked(tasks => {
    for (const task of tasks) {
      if (!isLeaseExpired(task)) continue;
      const retry = (task.attempts ?? 0) < MAX_ATTEMPTS;
      task.status = retry ? "approved" : "failed";
      task.lastError = "Execution lease expired before result persistence";
      task.failedAt = now();
      audit(task, retry ? "retry_scheduled" : "failed", { attempt: task.attempts ?? 0, reason: task.lastError });
    }
  });
}

async function blockUnsafe() {
  await locked(tasks => {
    for (const task of tasks) {
      if (task.status !== "approved" || !task.reviewedAt) continue;
      const reason = task.risk === "high"
        ? "High-risk work requires a separate reviewed flow"
        : typeof handlerFor(task) !== "function" ? "No business handler registered" : null;
      if (!reason) continue;
      task.status = "blocked";
      task.blockedAt = now();
      audit(task, "blocked", { reason });
    }
  });
}

async function claim() {
  return locked(tasks => {
    const task = tasks.find(candidate => validateClaimable(candidate));
    if (!task) return null;
    task.status = "running";
    task.startedAt = now();
    task.attempts = (task.attempts ?? 0) + 1;
    task.executionId = executionId(task);
    audit(task, "claimed", { business: task.business, executionId: task.executionId, attempt: task.attempts });
    return { ...task };
  });
}

async function markFailure(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(candidate => candidate.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) throw new Error("Execution claim changed");
    const retry = task.attempts < MAX_ATTEMPTS;
    task.status = retry ? "approved" : "failed";
    task.lastError = String(error.message ?? error).slice(0, 500);
    task.failedAt = now();
    audit(task, retry ? "retry_scheduled" : "failed", { attempt: task.attempts, error: task.lastError });
  });
}

await blockUnsafe();
await reconcile();
const claimed = await claim();
if (!claimed) {
  console.log("No approved, due, safe business tasks available.");
  process.exit(0);
}

try {
  const result = dispatchTask(claimed);
  const completedAt = now();
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt,
    result,
  };
  await mkdir(resultDir, { recursive: true });
  const resultPath = join(resultDir, `${claimed.executionId}.json`);
  await writeFile(resultPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await locked(tasks => {
    const task = tasks.find(candidate => candidate.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) throw new Error("Execution claim changed");
    task.status = "completed";
    task.completedAt = completedAt;
    task.resultPath = relative(process.cwd(), resultPath).replaceAll("\\", "/");
    audit(task, "completed", { business: task.business, executionId: task.executionId, resultPath: task.resultPath });
  });
  console.log(JSON.stringify({ taskId: claimed.id, business: claimed.business, status: "completed", resultPath }, null, 2));
} catch (error) {
  await markFailure(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
