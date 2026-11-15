/** One bounded local worker for approved business queue tasks. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  dispatchTask,
  handlerFor,
  leaseExpired,
  MAX_ATTEMPTS,
  validateClaimable,
} from "../lib/jarvis/businessWorker.mjs";

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/business-results");
const lockPath = queuePath + ".lock";
const actor = process.env.JARVIS_WORKER_ID?.trim() || "jarvis-business-worker";
const now = () => new Date().toISOString();

async function load() {
  try {
    const value = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(value)) throw new Error("Invalid queue");
    return value;
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
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
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
    await handle.close();
    await unlink(lockPath).catch(() => {});
  }
}

function executionId(task) {
  return createHash("sha256").update(`${task.id}:${task.attempts}`).digest("hex").slice(0, 20);
}

function retryAt(attempts) {
  const delay = Math.min(15 * 60 * 1000, 1000 * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + delay).toISOString();
}

async function reconcile() {
  await locked(tasks => {
    for (const task of tasks) {
      if (!leaseExpired(task)) continue;
      const retry = (task.attempts || 0) < MAX_ATTEMPTS;
      task.status = retry ? "approved" : "failed";
      task.nextAttemptAt = retry ? retryAt(task.attempts || 0) : undefined;
      task.lastError = "Execution lease expired before result persistence";
      task.failedAt = now();
      (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
        executionId: task.executionId,
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
      if (task.risk !== "high" && typeof handlerFor(task) === "function") continue;
      task.status = "blocked";
      task.blockedAt = now();
      (task.audit ??= []).push(audit("blocked", {
        reason: task.risk === "high"
          ? "High-risk task requires a separate reviewed flow"
          : "No business handler registered",
      }));
    }
  });
}

async function claim() {
  return locked(tasks => {
    const task = tasks
      .filter(candidate =>
        validateClaimable(candidate) &&
        (!candidate.nextAttemptAt || Date.parse(candidate.nextAttemptAt) <= Date.now()))
      .sort((a, b) =>
        Date.parse(a.createdAt || "") - Date.parse(b.createdAt || "") ||
        a.id.localeCompare(b.id))[0];
    if (!task) return null;
    task.status = "running";
    task.startedAt = now();
    task.attempts = (task.attempts || 0) + 1;
    task.nextAttemptAt = undefined;
    task.executionId = executionId(task);
    (task.audit ??= []).push(audit("claimed", {
      business: task.business,
      executionId: task.executionId,
      attempt: task.attempts,
    }));
    return { ...task };
  });
}

async function fail(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(candidate => candidate.id === claimed.id);
    if (!task || task.status !== "running" || task.executionId !== claimed.executionId) {
      throw new Error("Execution claim changed");
    }
    const retry = task.attempts < MAX_ATTEMPTS;
    task.status = retry ? "approved" : "failed";
    task.nextAttemptAt = retry ? retryAt(task.attempts) : undefined;
    task.lastError = String(error?.message || error).slice(0, 500);
    task.failedAt = now();
    (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
      executionId: task.executionId,
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
  const taskResult = dispatchTask(claimed);
  const completedAt = now();
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt,
    result: taskResult,
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
  console.log(JSON.stringify({
    taskId: claimed.id,
    business: claimed.business,
    status: "completed",
    resultPath,
  }, null, 2));
} catch (error) {
  await fail(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
