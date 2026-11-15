/** Run exactly one bounded business-worker tick and persist an operational report. */
import { spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json");
const reportPath = resolve(process.env.JARVIS_SCHEDULER_REPORT_PATH ?? "jarvis-output/business-scheduler.json");
const workerPath = resolve(root, "scripts/jarvis-business-worker.mjs");
const timeoutMs = Math.min(Math.max(Number(process.env.JARVIS_SCHEDULER_TIMEOUT_MS ?? 15 * 60 * 1000), 1_000), 20 * 60 * 1000);
const startedAt = new Date().toISOString();
const runId = `${Date.now()}-${process.pid}`;

async function queueSummary() {
  try {
    const tasks = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(tasks)) throw new Error("Invalid queue");
    return Object.fromEntries(["proposed", "approved", "running", "completed", "failed", "blocked", "rejected"]
      .map(status => [status, tasks.filter(task => task.status === status).length]));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function persist(report) {
  await mkdir(dirname(reportPath), { recursive: true });
  const temporary = `${reportPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, reportPath);
}

const output = [];
const child = spawn(process.execPath, [workerPath], {
  cwd: root,
  env: { ...process.env, JARVIS_ACTOR: process.env.JARVIS_ACTOR?.trim() || "jarvis-business-scheduler" },
});
child.stdout.on("data", chunk => output.push(chunk.toString()));
child.stderr.on("data", chunk => output.push(chunk.toString()));

const exitCode = await new Promise(resolveExit => {
  const timer = setTimeout(() => {
    child.kill();
    resolveExit(124);
  }, timeoutMs);
  child.on("close", code => {
    clearTimeout(timer);
    resolveExit(code ?? 1);
  });
});

const finishedAt = new Date().toISOString();
const workerOutput = output.join("").slice(-4_000);
const report = {
  runId,
  status: exitCode === 0 ? "completed" : exitCode === 124 ? "timed_out" : "worker_failed",
  exitCode,
  startedAt,
  finishedAt,
  queuePath,
  queue: await queueSummary(),
  workerOutput,
  executionContract: "one approved, due, safe, read-only task at most; proposal queue is never created or consumed as approval",
};
await persist(report);
console.log(JSON.stringify(report));
if (exitCode !== 0) process.exitCode = exitCode;
