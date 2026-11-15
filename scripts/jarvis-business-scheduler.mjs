/** Bounded orchestration for the existing approval-gated business worker. */
import { mkdir, open, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const lockPath = `${queuePath}.scheduler.lock`;
const maxTasks = boundedNumber(process.env.JARVIS_SCHEDULER_MAX_TASKS, 10, 1, 20);
const timeoutMs = boundedNumber(process.env.JARVIS_WORKER_TIMEOUT_MS, 60_000, 1_000, 300_000);
const staleLockMs = 15 * 60 * 1000;
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-business-scheduler";

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

async function acquireSchedulerLease() {
  await mkdir(dirname(queuePath), { recursive: true });
  try {
    return await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      const age = Date.now() - (await stat(lockPath)).mtimeMs;
      if (age > staleLockMs) {
        await unlink(lockPath);
        return await open(lockPath, "wx", 0o600);
      }
    } catch (staleError) {
      if (staleError.code !== "ENOENT") throw staleError;
    }
    throw new Error("Scheduler already running; retry later.");
  }
}

function runWorker(env) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("close", code => {
      clearTimeout(timeout);
      resolveRun({ code: code ?? 1, stdout, stderr, timedOut: code === null });
    });
  });
}

const lease = await acquireSchedulerLease();
const summary = { actor, maxTasks, attempted: 0, completed: 0, idle: false, failures: [] };
try {
  for (; summary.attempted < maxTasks; summary.attempted += 1) {
    const result = await runWorker({
      ...process.env,
      JARVIS_ACTOR: `${actor}/worker`,
    });
    if (result.code !== 0) {
      summary.failures.push({
        code: result.code,
        timedOut: result.timedOut,
        error: result.stderr.trim().slice(0, 500),
      });
      break;
    }
    if (!/"status":"completed"/.test(result.stdout)) {
      summary.idle = true;
      break;
    }
    summary.completed += 1;
  }
  console.log(JSON.stringify(summary));
  if (summary.failures.length) process.exitCode = 1;
} finally {
  await lease.close();
  await unlink(lockPath).catch(() => {});
}
