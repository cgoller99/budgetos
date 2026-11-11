/** Approved, allowlisted, read-only Jarvis executor. No arbitrary commands or network calls. */
import { readFile, writeFile, rename, mkdir, open, unlink, readdir } from "node:fs/promises";
import { dirname, resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
const queuePath = resolve(process.env.JARVIS_QUEUE_PATH || "data/jarvis-queue.json");
const lockPath = queuePath + ".lock";
const resultDir = resolve(process.env.JARVIS_RESULTS_DIR || "jarvis-output/executions");
const allowed = {
  "revenue-funnel-audit": { agent: "analytics", action: "event-inventory" },
  "upgrade-conversion-review": { agent: "developer", action: "upgrade-code-inventory" },
  "organic-marketing-campaign": { agent: "marketing", action: "attribution-inventory" },
  "ci-workflow-audit": { agent: "operations", action: "workflow-inventory" },
};
const plans = {
  "event-inventory": { paths: ["lib", "app"], pattern: /posthog|capture\(|identify\(|analytics|signup|subscribe|upgrade/i },
  "upgrade-code-inventory": { paths: ["app", "components"], pattern: /upgrade|pro\+|checkout|subscribe/i },
  "attribution-inventory": { paths: ["app", "lib"], pattern: /utm_|referrer|campaign|attribution/i },
  "workflow-inventory": { paths: [".github/workflows"], pattern: /schedule:|workflow_dispatch:|permissions:|concurrency:/i },
};
async function inspect(action) {
  const plan = plans[action], hits = [];
  async function visit(dir) {
    let entries;
    try { entries = await readdir(join(root, dir), { withFileTypes: true }); }
    catch (e) { if (e.code === "ENOENT") return; throw e; }
    for (const entry of entries) {
      if (hits.length >= 100 || entry.name.startsWith(".") && entry.name !== ".github") continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) { if (!["node_modules", ".next", "dist", "build"].includes(entry.name)) await visit(p); }
      else if (entry.isFile() && /\.(ts|tsx|js|mjs|yml|yaml)$/.test(entry.name)) {
        const data = await readFile(join(root, p), "utf8");
        if (data.length > 200000) continue;
        const lines = data.split(/\r?\n/);
        for (let i = 0; i < lines.length && hits.length < 100; i++)
          if (plan.pattern.test(lines[i])) hits.push({ file: p.replaceAll("\\", "/"), line: i + 1 });
      }
    }
  }
  for (const p of plan.paths) await visit(p);
  return { action, filesExamined: [...new Set(hits.map(x => x.file))].length, matches: hits.length, evidence: hits.slice(0, 50), truncated: hits.length >= 100 };
}
async function locked(fn) {
  await mkdir(dirname(queuePath), { recursive: true });
  let handle;
  try { handle = await open(lockPath, "wx", 0o600); }
  catch (e) { if (e.code === "EEXIST") throw Error("Queue locked; retry later"); throw e; }
  try {
    let tasks;
    try { tasks = JSON.parse(await readFile(queuePath, "utf8")); }
    catch (e) { if (e.code === "ENOENT") tasks = []; else throw e; }
    if (!Array.isArray(tasks)) throw Error("Invalid queue");
    const value = await fn(tasks);
    const temp = queuePath + "." + process.pid + ".tmp";
    await writeFile(temp, JSON.stringify(tasks, null, 2) + "\n", { mode: 0o600 });
    await rename(temp, queuePath);
    return value;
  } finally { await handle.close(); await unlink(lockPath); }
}
const now = () => new Date().toISOString();
const MAX_ATTEMPTS = 3;
const claimed = await locked(tasks => {
  const t = tasks.find(t => t.status === "approved" && allowed[t.id] && (t.attempts || 0) < MAX_ATTEMPTS);
  if (!t) return null;
  t.status = "running"; t.startedAt = now(); t.attempts = (t.attempts || 0) + 1;
  t.agent = allowed[t.id].agent; t.action = allowed[t.id].action;
  t.executionId = createHash("sha256").update(t.id + ":" + t.attempts).digest("hex").slice(0, 20);
  return { ...t };
});
if (!claimed) { console.log("No approved allowlisted tasks available."); process.exit(0); }
try {
  const result = await inspect(claimed.action);
  const record = { taskId: claimed.id, executionId: claimed.executionId, agent: claimed.agent, status: "completed", startedAt: claimed.startedAt, completedAt: now(), result };
  await mkdir(resultDir, { recursive: true });
  const resultPath = join(resultDir, claimed.executionId + ".json");
  await writeFile(resultPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  await locked(tasks => {
    const t = tasks.find(t => t.id === claimed.id);
    if (!t || t.status !== "running" || t.executionId !== claimed.executionId) throw Error("Execution claim changed");
    t.status = "completed"; t.completedAt = record.completedAt; t.resultPath = relative(root, resultPath).replaceAll("\\", "/");
  });
  console.log(JSON.stringify({ taskId: claimed.id, agent: claimed.agent, status: "completed", matches: result.matches, resultPath }, null, 2));
} catch (error) {
  await locked(tasks => {
    const t = tasks.find(t => t.id === claimed.id);
    if (t && t.executionId === claimed.executionId && t.status === "running") {
      t.status = t.attempts < MAX_ATTEMPTS ? "approved" : "failed";
      t.lastError = String(error.message).slice(0, 500); t.failedAt = now();
    }
  });
  console.error(error); process.exitCode = 1;
}
