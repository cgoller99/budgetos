/**
 * Bounded orchestration for the durable business worker.
 *
 * This process only starts the existing approval-gated worker. It does not
 * create proposals, alter approvals, or provide a path to external side
 * effects. The queue and result directory remain controlled by the worker.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MAX_TASKS_PER_RUN = 10;

function configuredLimit(value = process.env.JARVIS_SCHEDULER_MAX_TASKS) {
  const parsed = Number(value ?? MAX_TASKS_PER_RUN);
  if (!Number.isInteger(parsed) || parsed < 1) return MAX_TASKS_PER_RUN;
  return Math.min(parsed, MAX_TASKS_PER_RUN);
}

const limit = configuredLimit();
const worker = fileURLToPath(new URL("./jarvis-business-worker.mjs", import.meta.url));
const results = [];

for (let index = 0; index < limit; index += 1) {
  const run = spawnSync(process.execPath, [worker], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
  if (run.error) throw run.error;
  if (run.status !== 0) {
    process.stderr.write(run.stderr || `Business worker exited with ${run.status}\n`);
    process.exitCode = run.status ?? 1;
    break;
  }

  const output = (run.stdout ?? "").trim();
  if (output === "No approved, due, safe business tasks available.") break;
  if (output) {
    try {
      results.push(JSON.parse(output));
    } catch {
      throw new Error("Business worker returned non-JSON output.");
    }
  }
}

console.log(JSON.stringify({
  status: "completed",
  maxTasks: limit,
  executed: results.length,
  tasks: results,
}));
