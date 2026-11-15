/** Persistent worker for approved, due, low/medium-risk business tasks only. */
import { readFile, writeFile, rename, mkdir, open, unlink } from "node:fs/promises";
import { resolve, dirname, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { handlerFor, dispatchTask, isLeaseExpired, MAX_ATTEMPTS } from "../lib/jarvis/businessWorker.mjs";

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-results");
const lockPath = queuePath + ".lock";
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

function audit(type, details = {}) {
  return { type, actor, at: now(), ...details };
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
    const value = await operation(tasks);
    const temporary = `${queuePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(tasks, null, 2) + "\n", { mode: 0o600 });
    await rename(temporary, queuePath);
    return value;
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}

function executionId(task) {
  return createHash("sha256").update(`${task.id}:${task.attempts}`).digest("hex").slice(0, 20);
}

async function reconcileExpired() {
  return locked(tasks => {
    for (const task of tasks) {
      if (!isLeaseExpired(task)) continue;
      const retry = (task.attempts || 0) < MAX_ATTEMPTS;
      task.status = retry ? "approved" : "failed";
      task.lastError = "Execution lease expired before result persistence";
      task.failedAt = now();
      (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
        reason: task.lastError,
        attempts: task.attempts || 0,
      }));
    }
  });
}

async function claim() {
  return locked(tasks => {
    const task = tasks.find(candidate => {
      if (candidate.status !== "approved" || !candidate.reviewedAt) return false;
      if (candidate.risk === "high" || typeof handlerFor(candidate) !== "function") return false;
      return (candidate.attempts || 0) < MAX_ATTEMPTS && (!candidate.scheduledAt || Date.parse(candidate.scheduledAt) <= Date.now());
    });
    if (!task) return null;
    task.status = "running";
    task.startedAt = now();
    task.attempts = (task.attempts || 0) + 1;
    task.executionId = executionId(task);
    (task.audit ??= []).push(audit("claimed", {
      business: task.business,
      executionId: task.executionId,
      attempt: task.attempts,
    }));
    return { ...task };
  });
}

async function recordFailure(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(candidate => candidate.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) {
      throw new Error("Execution claim changed");
    }
    const retry = task.attempts < MAX_ATTEMPTS;
    task.status = retry ? "approved" : "failed";
    task.lastError = String(error.message || error).slice(0, 500);
    task.failedAt = now();
    (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
      error: task.lastError,
      attempt: task.attempts,
    }));
  });
}

async function blockUnsafe() {
  return locked(tasks => {
    for (const task of tasks) {
      if (task.status !== "approved" || !task.reviewedAt) continue;
      const unsafe = task.risk === "high" || typeof handlerFor(task) !== "function";
      if (!unsafe) continue;
      task.status = "blocked";
      task.blockedAt = now();
      (task.audit ??= []).push(audit("blocked", {
        reason: task.risk === "high" ? "High-risk work requires a separate reviewed flow" : "No business handler registered",
      }));
    }
  });
}

await blockUnsafe();
await reconcileExpired();
const claimed = await claim();
if (!claimed) {
  console.log("No approved, due, safe business tasks available.");
  process.exit(0);
}

try {
  const value = dispatchTask(claimed);
  const completedAt = now();
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt,
    result: value,
  };
  await mkdir(resultDir, { recursive: true });
  const resultPath = join(resultDir, `${claimed.executionId}.json`);
  await writeFile(resultPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  await locked(tasks => {
    const task = tasks.find(candidate => candidate.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) {
      throw new Error("Execution claim changed");
    }
    task.status = "completed";
    task.completedAt = completedAt;
    task.resultPath = relative(process.cwd(), resultPath).replaceAll("\\", "/");
    (task.audit ??= []).push(audit("completed", {
      business: task.business,
      executionId: task.executionId,
      resultPath: task.resultPath,
    }));
  });
  console.log(JSON.stringify({ taskId: claimed.id, business: claimed.business, status: "completed", resultPath }, null, 2));
} catch (error) {
  await recordFailure(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
