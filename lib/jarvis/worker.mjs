import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;
const MAX_AUDIT_EVENTS = 50;
const MAX_MATCHES = 100;

const HANDLER_PLANS = {
  buxme: {
    research: { id: "buxme-conversion-inventory", paths: ["app", "lib"], pattern: /signup|subscribe|upgrade|conversion|posthog|analytics/i },
    business: { id: "buxme-business-inventory", paths: ["app", "lib"], pattern: /revenue|profit|pricing|sales|customer|business/i },
    routine: { id: "buxme-routine-inventory", paths: ["app", "lib"], pattern: /health|status|config|README/i },
  },
  "website-agency": {
    coding: { id: "agency-code-inventory", paths: ["app", "components", "lib"], pattern: /typescript|website|component|route|build/i },
    business: { id: "agency-growth-inventory", paths: ["app", "components", "lib"], pattern: /conversion|marketing|sales|pricing|customer/i },
    routine: { id: "agency-routine-inventory", paths: ["app", "components", "lib"], pattern: /README|config|workflow|status/i },
  },
  drivenest: {
    business: { id: "drivenest-booking-inventory", paths: ["app", "lib", "components"], pattern: /booking|appointment|service|customer|vehicle/i },
    routine: { id: "drivenest-operations-inventory", paths: ["app", "lib", "components"], pattern: /schedule|workflow|status|config/i },
  },
};

const nowIso = () => new Date().toISOString();

function audit(task, type, details = {}, now = nowIso) {
  if (!Array.isArray(task.audit)) task.audit = [];
  task.audit.push({ type, at: now(), ...details });
  if (task.audit.length > MAX_AUDIT_EVENTS) task.audit = task.audit.slice(-MAX_AUDIT_EVENTS);
}

async function loadQueue(queuePath) {
  try {
    const tasks = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(tasks)) throw new Error("Invalid Jarvis queue");
    return tasks;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function withQueueLock(queuePath, operation) {
  const lockPath = queuePath + ".lock";
  await mkdir(dirname(queuePath), { recursive: true });
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Jarvis queue locked; retry later.");
    throw error;
  }
  try {
    const tasks = await loadQueue(queuePath);
    const result = await operation(tasks);
    const tempPath = `${queuePath}.${process.pid}.tmp`;
    await writeFile(tempPath, JSON.stringify(tasks, null, 2) + "\n", { mode: 0o600 });
    await rename(tempPath, queuePath);
    return result;
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}

async function inventory(root, plan) {
  const matches = [];
  const files = new Set();
  async function visit(pathPart) {
    let entries;
    try {
      entries = await readdir(join(root, pathPart), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (matches.length >= MAX_MATCHES || entry.name.startsWith(".")) continue;
      const child = join(pathPart, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".next", "dist", "build"].includes(entry.name)) await visit(child);
      } else if (entry.isFile() && /\.(mjs|js|ts|tsx|yml|yaml|md)$/.test(entry.name)) {
        const content = await readFile(join(root, child), "utf8");
        if (content.length > 200_000) continue;
        for (const [index, line] of content.split(/\r?\n/).entries()) {
          if (plan.pattern.test(line)) {
            files.add(child.replaceAll("\\", "/"));
            matches.push({ file: child.replaceAll("\\", "/"), line: index + 1 });
            if (matches.length >= MAX_MATCHES) break;
          }
        }
      }
    }
  }
  for (const pathPart of plan.paths) await visit(pathPart);
  return { handler: plan.id, filesExamined: files.size, matches, truncated: matches.length >= MAX_MATCHES };
}

export function handlersFor(handlers = HANDLER_PLANS) {
  return Object.fromEntries(Object.entries(handlers).flatMap(([business, kinds]) =>
    Object.entries(kinds).map(([kind, plan]) => [
      `${business}:${kind}`,
      async ({ root }) => inventory(root, plan),
    ]),
  ));
}

function approvedByHuman(task) {
  return task.status === "approved" &&
    Boolean(task.reviewedAt) &&
    Array.isArray(task.audit) &&
    task.audit.some(entry => entry.type === "approved" || entry.type === "reviewed" && entry.status === "approved");
}

function retryAt(attempt, now) {
  const delay = Math.min(15 * 60 * 1000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return new Date(now + delay).toISOString();
}

export async function runWorker({
  queuePath = resolve(process.env.JARVIS_QUEUE_PATH ?? "data/jarvis-queue.json"),
  resultDir = resolve(process.env.JARVIS_RESULTS_DIR ?? "jarvis-output/executions"),
  root = process.cwd(),
  handlers = handlersFor(),
  now = Date.now,
  leaseMs = LEASE_MS,
} = {}) {
  const reconcileAt = now();
  await withQueueLock(queuePath, async tasks => {
    for (const task of tasks.filter(item => item.status === "running")) {
      const resultPath = join(resultDir, `${task.executionId}.json`);
      let record;
      try { record = JSON.parse(await readFile(resultPath, "utf8")); } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (record?.taskId === task.id && record.executionId === task.executionId && record.status === "completed") {
        task.status = "completed";
        task.completedAt = record.completedAt;
        task.resultPath = relative(root, resultPath).replaceAll("\\", "/");
        audit(task, "reconciled_completed", { executionId: task.executionId });
      } else if (reconcileAt - Date.parse(task.startedAt ?? "") > leaseMs) {
        task.status = (task.attempts ?? 0) < MAX_ATTEMPTS ? "approved" : "failed";
        task.nextAttemptAt = task.status === "approved" ? new Date(reconcileAt).toISOString() : undefined;
        task.lastError = "Execution lease expired before result persistence";
        audit(task, "lease_expired", { status: task.status, attempts: task.attempts ?? 0 });
      }
    }
  });

  const claimed = await withQueueLock(queuePath, tasks => {
    const eligible = tasks
      .filter(task => approvedByHuman(task))
      .filter(task => task.risk !== "high")
      .filter(task => isDue(task, now()))
      .filter(task => !task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= now())
      .filter(task => handlers[`${task.business}:${task.model?.kind}`])
      .filter(task => (task.attempts ?? 0) < MAX_ATTEMPTS)
      .sort((a, b) => Date.parse(a.createdAt ?? "9999-12-31") - Date.parse(b.createdAt ?? "9999-12-31") || a.id.localeCompare(b.id))[0];
    if (!eligible) return null;
    const handlerKey = `${eligible.business}:${eligible.model.kind}`;
    eligible.status = "running";
    eligible.startedAt = nowIso();
    eligible.attempts = (eligible.attempts ?? 0) + 1;
    eligible.nextAttemptAt = undefined;
    eligible.executionId = createHash("sha256").update(`${eligible.business}:${eligible.id}:${eligible.attempts}`).digest("hex").slice(0, 20);
    audit(eligible, "claimed", { executionId: eligible.executionId, attempt: eligible.attempts, handler: handlerKey });
    return { ...eligible, handlerKey };
  });

  if (!claimed) return { status: "idle" };
  const handler = handlers[claimed.handlerKey];
  try {
    const result = await handler({ task: claimed, root });
    const completedAt = nowIso();
    const record = {
      taskId: claimed.id, business: claimed.business, executionId: claimed.executionId,
      handler: claimed.handlerKey, status: "completed", startedAt: claimed.startedAt, completedAt, result,
    };
    await mkdir(resultDir, { recursive: true });
    const resultPath = join(resultDir, `${claimed.executionId}.json`);
    try {
      await writeFile(resultPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    await withQueueLock(queuePath, tasks => {
      const task = tasks.find(item => item.id === claimed.id);
      if (!task || task.status !== "running" || task.executionId !== claimed.executionId) throw new Error("Execution claim changed");
      task.status = "completed";
      task.completedAt = completedAt;
      task.resultPath = relative(root, resultPath).replaceAll("\\", "/");
      audit(task, "completed", { executionId: task.executionId, resultPath: task.resultPath });
    });
    return { status: "completed", taskId: claimed.id, executionId: claimed.executionId, result };
  } catch (error) {
    await withQueueLock(queuePath, tasks => {
      const task = tasks.find(item => item.id === claimed.id);
      if (!task || task.executionId !== claimed.executionId || task.status !== "running") return;
      task.status = task.attempts < MAX_ATTEMPTS ? "approved" : "failed";
      task.nextAttemptAt = task.status === "approved" ? retryAt(task.attempts, now()) : undefined;
      task.lastError = String(error.message).slice(0, 500);
      audit(task, "failed", { status: task.status, attempt: task.attempts, error: task.lastError, nextAttemptAt: task.nextAttemptAt });
    });
    return { status: "failed", taskId: claimed.id, error: String(error.message) };
  }
}
