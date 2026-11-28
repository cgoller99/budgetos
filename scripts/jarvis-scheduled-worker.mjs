/** Run a bounded batch of due tasks through the claim-aware read-only worker. */
import { open, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

export const DEFAULT_MAX_TASKS = 3;
export const MAX_TASKS = 10;
export const DEFAULT_LOCK_MS = 15 * 60 * 1000;
export const DEFAULT_WORKER_TIMEOUT_MS = 5 * 60 * 1000;

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const lockPath = `${queuePath}.scheduler.lock`;
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-scheduled-worker";

function boundedNumber(value, fallback, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

const maxTasks = boundedNumber(process.env.JARVIS_SCHEDULE_MAX_TASKS, DEFAULT_MAX_TASKS, MAX_TASKS);
const lockMs = boundedNumber(process.env.JARVIS_SCHEDULER_LOCK_MS, DEFAULT_LOCK_MS, 60 * 60 * 1000);
const workerTimeoutMs = boundedNumber(
  process.env.JARVIS_WORKER_TIMEOUT_MS,
  DEFAULT_WORKER_TIMEOUT_MS,
  15 * 60 * 1000,
);

async function acquireSchedulerLease() {
  await mkdir(dirname(queuePath), { recursive: true });
  try {
    const handle = await open(lockPath, "wx", 0o600);
    await writeFile(handle, JSON.stringify({ actor, pid: process.pid, acquiredAt: new Date().toISOString() }));
    return handle;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      const age = Date.now() - (await stat(lockPath)).mtimeMs;
      if (age <= lockMs) return null;
      await unlink(lockPath);
    } catch (staleError) {
      if (staleError.code !== "ENOENT") throw staleError;
    }
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await writeFile(handle, JSON.stringify({ actor, pid: process.pid, acquiredAt: new Date().toISOString() }));
      return handle;
    } catch (retryError) {
      if (retryError.code === "EEXIST") return null;
      throw retryError;
    }
  }
}

function runWorker() {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, JARVIS_ACTOR: actor },
      stdio: "inherit",
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Jarvis business worker exceeded ${workerTimeoutMs}ms`));
    }, workerTimeoutMs);
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (signal) reject(new Error(`Jarvis business worker stopped by ${signal}`));
      else resolveRun(code ?? 1);
    });
  });
}

let lease;
try {
  lease = await acquireSchedulerLease();
  if (!lease) {
    console.log("Jarvis scheduler already running; skipped overlapping trigger.");
  } else {
    for (let index = 0; index < maxTasks; index += 1) {
      const code = await runWorker();
      if (code !== 0) {
        process.exitCode = code;
        break;
      }
    }
  }
} catch (error) {
  console.error("Jarvis scheduler failed:", error.message);
  process.exitCode = 1;
} finally {
  if (lease) {
    await lease.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
  }
}
