/** One bounded worker tick for approved, due, safe business tasks. */
import { readFile, writeFile, rename, mkdir, open, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import {
  dispatchTask,
  handlerFor,
  isLeaseExpired,
  MAX_ATTEMPTS,
  validateClaimable,
} from "../lib/jarvis/businessWorker.mjs";

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

const audit = (type, details = {}) => ({ type, actor, at: now(), ...details });

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
    await writeFile(temporary, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, queuePath);
    return value;
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => {});
  }
}

const executionId = task =>
  createHash("sha256").update(`${task.id}:${task.attempts}`).digest("hex").slice(0, 20);
const resultPath = id => join(resultDir, `${id}.json`);
const relativeResultPath = path => relative(process.cwd(), path).replaceAll("\\", "/");

async function reconcile() {
  await locked(async tasks => {
    for (const task of tasks) {
      if (task.status === "running" && task.executionId) {
        try {
          const record = JSON.parse(await readFile(resultPath(task.executionId), "utf8"));
          if (
            record.taskId === task.id &&
            record.executionId === task.executionId &&
            record.status === "completed" &&
            record.business === task.business
          ) {
            task.status = "completed";
            task.completedAt = record.completedAt;
            task.resultPath = relativeResultPath(resultPath(task.executionId));
            (task.audit ??= []).push(audit("completed", {
              business: task.business,
              executionId: task.executionId,
              resultPath: task.resultPath,
              reconciled: true,
            }));
            continue;
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      if (isLeaseExpired(task)) {
        const retry = (task.attempts || 0) < MAX_ATTEMPTS;
        task.status = retry ? "approved" : "failed";
        task.lastError = "Execution lease expired before result persistence";
        task.failedAt = now();
        task.nextAttemptAt = undefined;
        (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
          business: task.business,
          reason: task.lastError,
          attempts: task.attempts || 0,
        }));
      }
    }
  });
}

async function blockUnsafe() {
  await locked(tasks => {
    for (const task of tasks) {
      if (task.status !== "approved" || !task.reviewedAt) continue;
      if ((task.risk === "low" || task.risk === "medium") && handlerFor(task)) continue;
      task.status = "blocked";
      task.blockedAt = now();
      (task.audit ??= []).push(audit("blocked", {
        business: task.business,
        reason: task.risk !== "low" && task.risk !== "medium"
          ? "Risk must be explicitly low or medium"
          : "No business handler registered",
      }));
    }
  });
}

async function claim() {
  return locked(tasks => {
    const task = tasks
      .filter(candidate => validateClaimable(candidate))
      .sort((a, b) =>
        Date.parse(a.createdAt || "") - Date.parse(b.createdAt || "") ||
        a.id.localeCompare(b.id)
      )[0];
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

async function recordFailure(claimed, error) {
  await locked(tasks => {
    const task = tasks.find(candidate =>
      candidate.id === claimed.id &&
      candidate.status === "running" &&
      candidate.executionId === claimed.executionId);
    if (!task) throw new Error("Execution claim changed");
    const retry = task.attempts < MAX_ATTEMPTS;
    task.status = retry ? "approved" : "failed";
    task.lastError = String(error.message || error).slice(0, 500);
    task.failedAt = now();
    task.nextAttemptAt = retry
      ? new Date(Date.now() + Math.min(15 * 60_000, 1_000 * 2 ** (task.attempts - 1))).toISOString()
      : undefined;
    (task.audit ??= []).push(audit(retry ? "retry_scheduled" : "failed", {
      business: task.business,
      error: task.lastError,
      attempt: task.attempts,
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
  const completedAt = now();
  const record = {
    taskId: claimed.id,
    executionId: claimed.executionId,
    business: claimed.business,
    status: "completed",
    startedAt: claimed.startedAt,
    completedAt,
    result: dispatchTask(claimed),
  };
  await mkdir(resultDir, { recursive: true });
  const outputPath = resultPath(claimed.executionId);
  await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await locked(tasks => {
    const task = tasks.find(candidate =>
      candidate.id === claimed.id &&
      candidate.status === "running" &&
      candidate.executionId === claimed.executionId);
    if (!task) throw new Error("Execution claim changed");
    task.status = "completed";
    task.completedAt = completedAt;
    task.resultPath = relativeResultPath(outputPath);
    (task.audit ??= []).push(audit("completed", {
      business: task.business,
      executionId: claimed.executionId,
      resultPath: task.resultPath,
    }));
  });
  console.log(JSON.stringify({
    taskId: claimed.id,
    business: claimed.business,
    status: "completed",
    resultPath: outputPath,
  }, null, 2));
} catch (error) {
  await recordFailure(claimed, error);
  console.error(error);
  process.exitCode = 1;
}
