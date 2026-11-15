/** Bounded unattended trigger for the approval-gated, read-only Jarvis worker. */
import { appendFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_TASKS_PER_RUN = 3;
const maxTasks = Math.min(
  MAX_TASKS_PER_RUN,
  Math.max(1, Number.parseInt(process.env.JARVIS_MAX_TASKS ?? "1", 10) || 1),
);
const auditPath = resolve(process.env.JARVIS_RUN_AUDIT_PATH ?? "jarvis-output/scheduler-runs.jsonl");
const actor = process.env.JARVIS_ACTOR?.trim() || "jarvis-autonomous-trigger";
const runId = randomUUID();
const startedAt = new Date().toISOString();

function runWorker() {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, JARVIS_ACTOR: actor },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeoutMs = Math.min(
      15 * 60 * 1000,
      Math.max(1_000, Number(process.env.JARVIS_WORKER_TIMEOUT_MS ?? 10 * 60 * 1000)),
    );
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Jarvis worker exceeded ${timeoutMs}ms timeout`));
    }, timeoutMs);
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Jarvis worker exited with code ${code}`));
        return;
      }
      const line = stdout.trim().split(/\r?\n/).at(-1) ?? "";
      resolveRun(line === "No approved, due, safe business tasks available."
        ? { status: "idle" }
        : { status: "completed", output: JSON.parse(line) });
    });
  });
}

async function writeAudit(record) {
  await mkdir(dirname(auditPath), { recursive: true });
  await appendFile(auditPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
}

const tasks = [];
let failure;
try {
  for (let attempt = 0; attempt < maxTasks; attempt += 1) {
    const result = await runWorker();
    tasks.push(result);
    if (result.status === "idle") break;
  }
} catch (error) {
  failure = String(error.message ?? error).slice(0, 500);
}

const record = {
  runId,
  actor,
  startedAt,
  completedAt: new Date().toISOString(),
  maxTasks,
  tasks,
  status: failure ? "failed" : "completed",
  ...(failure ? { error: failure } : {}),
};
await writeAudit(record);
console.log(JSON.stringify({
  runId,
  status: record.status,
  executed: tasks.filter(task => task.status === "completed").length,
  maxTasks,
}));
if (failure) process.exitCode = 1;
