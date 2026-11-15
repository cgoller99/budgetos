/** Select one human-approved task for the unattended, read-only executor. */
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const manifestPath = process.env.JARVIS_APPROVED_TASKS_PATH ?? "data/jarvis-approved-tasks.json";
const taskIdPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;
const maxAttempts = 3;

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest) || manifest.length > 200) {
  throw new Error("Invalid approved-task manifest");
}

const task = manifest.find(item =>
  item &&
  taskIdPattern.test(item.id ?? "") &&
  item.status === "approved" &&
  Number.isInteger(item.attempts ?? 0) &&
  item.attempts < maxAttempts,
);

if (!task) {
  console.log("No new approved tasks; no unattended execution.");
  process.exit(0);
}

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify({ taskId: task.id, status: task.status, attempts: task.attempts ?? 0 }));
  process.exit(0);
}

const env = {
  ...process.env,
  JARVIS_APPROVED_TASK_ID: task.id,
};
const run = spawnSync(process.execPath, ["scripts/jarvis-github-execute.mjs"], {
  cwd: process.cwd(),
  env,
  encoding: "utf8",
});
process.stdout.write(run.stdout ?? "");
process.stderr.write(run.stderr ?? "");
if (run.error) throw run.error;
if (run.status !== 0) {
  throw new Error(`Jarvis unattended executor failed with status ${run.status}`);
}
