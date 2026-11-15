/** Select at most one repository-approved task for an unattended run. */
import { readFile } from "node:fs/promises";

const manifestPath = process.env.JARVIS_APPROVED_TASKS_PATH ?? "data/jarvis-approved-tasks.json";
const idPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!Array.isArray(manifest)) throw new Error("Invalid approved-task manifest");

const approved = manifest
  .filter(task => task && task.status === "approved" && idPattern.test(task.id ?? ""))
  .sort((left, right) => String(left.id).localeCompare(String(right.id)));

const duplicateIds = approved
  .map(task => task.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`Duplicate approved task ID: ${duplicateIds[0]}`);

process.stdout.write(`${approved[0]?.id ?? "none"}\n`);
