/** Local append-only Jarvis task journal. No production data or autonomous actions. */
import { mkdir, open, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
const statuses = new Set(["proposed", "started", "blocked", "verified", "failed", "completed"]);
const path = resolve(process.env.JARVIS_JOURNAL_PATH ?? "data/jarvis-journal.jsonl");
const [command, ...args] = process.argv.slice(2);
if (command === "list") {
  try {
    const rows = (await readFile(path, "utf8")).split("\n").filter(Boolean).map(x => JSON.parse(x));
    console.log(JSON.stringify(rows.slice(-30), null, 2));
  } catch (error) { if (error.code === "ENOENT") console.log("[]"); else throw error; }
} else if (command === "record") {
  const [taskId, status, ...descriptionParts] = args;
  const description = descriptionParts.join(" ").trim();
  if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(taskId ?? "") || !statuses.has(status) || !description || description.length > 500 || /[\r\n]/.test(description)) {
    throw new Error("Usage: record <safe-task-id> <proposed|started|blocked|verified|failed|completed> <description (max 500 chars)>");
  }
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "a", 0o600);
  try { await handle.appendFile(JSON.stringify({ eventId: randomUUID(), taskId, status, description, at: new Date().toISOString() }) + "\n"); }
  finally { await handle.close(); }
  console.log("Jarvis journal event recorded.");
} else { throw new Error("Usage: node scripts/jarvis-journal.mjs <list|record>"); }
