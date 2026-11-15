/** Claims one approved, due, safe business task and writes a durable local result. */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  MAX_ATTEMPTS,
  RETRY_BASE_MS,
  dispatchTask,
  handlerFor,
  leaseExpired,
  validateClaimable,
} from "../lib/jarvis/businessWorker.mjs";

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultsDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-results");
const lockPath = `${queuePath}.lock`;
const actor = process.env.JARVIS_WORKER_ID?.trim() || "jarvis-business-worker";
const timestamp = () => new Date().toISOString();

async function load() {
  try {
    const value = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(value)) throw new Error("Invalid Jarvis queue");
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const audit = (type, details = {}) => ({ type, actor, at: timestamp(), ...details });

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

function executionId(task) {
  return createHash("sha256").update(`${task.id}:${task.attempts}`).digest("hex").slice(0, 20);
}

function retryAt(attempts) {
  const delay = Math.min(15 * 60 * 1000, RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + delay).toISOString();
}

async function reconcile() {
  await locked(async tasks => {
    for (const task of tasks) {
      if (task.status === "running" && task.executionId) {
        const path = join(resultsDir, `${task.executionId}.json`);
        try {
          const result = JSON.parse(await readFile(path, "utf8"));
          if (result.taskId !== task.id || result.executionId !== task.executionId) continue;
          task.status = "completed";
          task.completedAt = result.completedAt;
          task.resultPath = relative(process.cwd(), path).replaceAll("\\", "/");
          (task.audit ??= []).push(audit("reconciled_completed", { executionId: task.executionId }));
          continue;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      if (!leaseExpired(task)) continue;
      const retry = (task.attempts || 0) < MAX_ATTEMPTS;
      task.status = retry ? "approved" : "failed";
      task.lastError = "Execution lease expired before result persistence";
      task.failedAt = timestamp();
      if (retry) task.nextAttemptAt = retryAt(task.attempts);
      (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
        attempt: task.attempts || 0,
        reason: task.lastError,
        nextAttemptAt: task.nextAttemptAt,
      }));
    }
  });
}

async function blockUnsafe() {
  await locked(tasks => {
    for (const task of tasks) {
      if (task.status !== "approved" || !task.reviewedAt) continue;
      if (task.risk !== "high" && handlerFor(task)) continue;
      task.status = "blocked";
      task.blockedAt = timestamp();
      (task.audit ??= []).push(audit("blocked", {
        reason: task.risk === "high" ? "High-risk work requires a separate reviewed flow" : "No business handler registered",
      }));
    }
  });
}

async function claim() {
  return locked(tasks => {
    const task = tasks.find(candidate => validateClaimable(candidate));
    if (!task) return null;
    task.status = "running";
    task.startedAt = timestamp();
    task.attempts = (task.attempts || 0) + 1;
    task.nextAttemptAt = undefined;
    task.executionId = executionId(task);
    (task.audit ??= []).push(audit("claimed", {
      attempt: task.attempts,
      business: task.business,
      executionId: task.executionId,
    }));
    return { ...task };
  });
}

async function failClaim(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(candidate =>
      candidate.id === claimed.id &&
      candidate.executionId === claimed.executionId &&
      candidate.status === "running");
    if (!task) throw new Error("Execution claim changed");
    const retry = task.attempts < MAX_ATTEMPTS;
    task.status = retry ? "approved" : "failed";
    task.lastError = String(error.message || error).slice(0, 500);
    task.failedAt = timestamp();
    if (retry) task.nextAttemptAt = retryAt(task.attempts);
    (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
      attempt: task.attempts,
      error: task.lastError,
      nextAttemptAt: task.nextAttemptAt,
    }));
  });
}

await reconcile();
await blockUnsafe();
const claimed = await claim();
if (!claimed) {
  console.log("No approved, due, safe business tasks available.");
  process.exit(0);
}

try {
  const result = dispatchTask(claimed);
  const completedAt = timestamp();
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt,
    result,
  };
  await mkdir(resultsDir, { recursive: true });
  const resultPath = join(resultsDir, `${claimed.executionId}.json`);
  await writeFile(resultPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await locked(tasks => {
    const task = tasks.find(candidate =>
      candidate.id === claimed.id &&
      candidate.executionId === claimed.executionId &&
      candidate.status === "running");
    if (!task) throw new Error("Execution claim changed");
    task.status = "completed";
    task.completedAt = completedAt;
    task.resultPath = relative(process.cwd(), resultPath).replaceAll("\\", "/");
    (task.audit ??= []).push(audit("completed", {
      business: task.business,
      executionId: task.executionId,
      resultPath: task.resultPath,
    }));
  });
  console.log(JSON.stringify({ taskId: claimed.id, business: claimed.business, status: "completed" }));
} catch (error) {
  await failClaim(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
