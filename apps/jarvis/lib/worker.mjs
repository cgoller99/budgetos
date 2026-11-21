import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { classifyJarvisTask, modelChain, riskFor, selectJarvisModel } from "./routing.mjs";
import { readBusinessInventory } from "./inventory.mjs";
import { BUSINESSES } from "./store.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;
const MAX_AUDIT = 50;

function audit(task, type, details = {}) {
  task.audit ??= [];
  task.audit.push({ type, at: new Date().toISOString(), actor: "jarvis", ...details });
  if (task.audit.length > MAX_AUDIT) task.audit = task.audit.slice(-MAX_AUDIT);
}

function approvedByOwner(task) {
  return task.status === "approved" && task.audit?.some(event => event.type === "approved" && event.actor === "owner");
}

function requiredGate(task) {
  const text = `${task.title}\n${task.detail}`;
  if (/\bpublish\b/i.test(text)) return "publish";
  if (/\b(outreach|email)\b/i.test(text)) return "bulkOutreach";
  if (/\b(ads|advertising)\b/i.test(text)) return "advertising";
  if (/\b(purchase|buy|spend)\b/i.test(text)) return "purchases";
  if (/\bdeploy\b/i.test(text)) return "deploy";
  if (/\b(commit|pull request|git push)\b/i.test(text)) return "codePush";
  if (/\b(password|account change|customer data)\b/i.test(text)) return "accountChanges";
  return null;
}

function canRun(task, gates) {
  if (task.status !== "proposed" && task.status !== "approved") return false;
  const gate = requiredGate(task);
  const needsApproval = gate ? gates?.[gate] !== false : true;
  return needsApproval ? approvedByOwner(task) : true;
}

function log(state, message, taskId) {
  state.logs.push({ id: randomUUID(), at: new Date().toISOString(), level: "info", message, taskId: taskId ?? null });
  if (state.logs.length > 300) state.logs.splice(0, state.logs.length - 300);
}

export function createTask(state, { title, detail = "", business = "buxme", priority }, env = process.env) {
  const cleanTitle = String(title ?? "").trim().replace(/\s+/g, " ");
  if (cleanTitle.length < 3 || cleanTitle.length > 180 || /[\r\n]/.test(cleanTitle)) throw new Error("Task title must be 3 to 180 characters.");
  if (!BUSINESSES[business]) throw new Error("Unknown business.");
  if (String(detail).length > 4000) throw new Error("Task detail is too long.");
  if (state.tasks.length >= 200) throw new Error("Task queue is full.");
  const kind = classifyJarvisTask(`${cleanTitle}\n${detail}`);
  const risk = riskFor(`${cleanTitle}\n${detail}`);
  const model = selectJarvisModel(kind, env);
  const task = {
    id: randomUUID(),
    title: cleanTitle,
    detail: String(detail ?? "").slice(0, 4000),
    business,
    businessName: BUSINESSES[business].name,
    kind,
    risk,
    priority: Number.isInteger(priority) && priority >= 1 && priority <= 5 ? priority : risk === "high" ? 5 : 3,
    status: "proposed",
    attempts: 0,
    model,
    createdAt: new Date().toISOString(),
    audit: [{ type: "proposed", at: new Date().toISOString(), actor: "owner" }],
    externalSideEffects: [],
  };
  state.tasks.push(task);
  log(state, `Proposed task ${task.id}: ${task.title}`, task.id);
  return task;
}

export function reviewTask(state, id, decision) {
  const task = state.tasks.find(item => item.id === id);
  if (!task || task.status !== "proposed") throw new Error("Only a proposed task can be reviewed.");
  if (decision !== "approved" && decision !== "rejected") throw new Error("Review must approve or reject.");
  task.status = decision;
  task.reviewedAt = new Date().toISOString();
  audit(task, decision, { actor: "owner", risk: task.risk });
  log(state, `${decision === "approved" ? "Approved" : "Rejected"} task ${task.id}. No external action was taken.`, task.id);
  return task;
}

function preparation(task) {
  return {
    summary: `Prepared only. Jarvis did not publish, send, spend, deploy, or change an account for “${task.title}”.`,
    checklist: [
      "Confirm the exact account and environment.",
      "Review the draft or diff yourself.",
      "Run the external action from that service after you approve it there.",
    ],
    externalSideEffects: [],
  };
}

async function safeResult(task, ctx) {
  const inventory = await readBusinessInventory(ctx.repoRoot, task.business);
  const chain = modelChain(task.kind, ctx.env);
  if (/\b(draft|outreach|listing|campaign|research|email|publish)\b/i.test(`${task.title}\n${task.detail}`)) {
    const facts = task.detail.trim();
    return {
      handler: "draft",
      modelConsidered: chain[0],
      fallbacks: chain.slice(1),
      text: facts
        ? `Draft from your notes only:\n\n${facts}\n\nSource: the task detail you entered. This was not sent.`
        : "No notes were supplied, so there is no personalized draft. Add the facts and run this task again. Nothing was sent.",
      inventory,
      externalSideEffects: [],
    };
  }
  if (task.kind === "coding") {
    const artifact = await writePlan(ctx.dataDir, task, chain, inventory);
    return {
      handler: "code-plan",
      modelConsidered: chain[0],
      fallbacks: chain.slice(1),
      text: "Prepared a coding plan. No application file was edited, and no branch, commit, or pull request was created.",
      artifact,
      inventory,
      externalSideEffects: [],
    };
  }
  return {
    handler: "status",
    modelConsidered: chain[0],
    text: `Recorded work for ${task.businessName}: ${task.title}. ${inventory.note} No external action was performed.`,
    inventory,
    externalSideEffects: [],
  };
}

async function writePlan(dataDir, task, chain, inventory) {
  if (!dataDir) return null;
  const directory = join(dataDir, "sandbox");
  await mkdir(directory, { recursive: true });
  const filename = `${task.id}.md`;
  const body = [
    `# ${task.title}`,
    "",
    "This plan was written by Jarvis. It did not edit the product repository.",
    "",
    `Preferred model: ${chain[0]}`,
    `Fallbacks: ${chain.slice(1).join(", ") || "none"}`,
    "",
    task.detail || "No extra detail was supplied.",
    "",
    inventory.note,
    "",
  ].join("\n");
  await writeFile(join(directory, filename), body, { mode: 0o600 });
  return relative(resolve(dataDir), join(directory, filename)).replaceAll("\\", "/");
}

export async function runWorker(state, ctx) {
  const now = ctx.now ? ctx.now() : Date.now();
  const report = { recovered: [], blocked: [], completed: [], failed: [], skipped: [] };
  if (state.workerLockUntil && Date.parse(state.workerLockUntil) > now) {
    return { ...report, skipped: ["worker-already-running"] };
  }
  state.workerLockUntil = new Date(now + 60 * 1000).toISOString();
  try {
    for (const task of state.tasks) {
      if (task.status !== "running") continue;
      const expired = !task.claimExpiresAt || Date.parse(task.claimExpiresAt) <= now;
      if (!expired) continue;
      if ((task.attempts ?? 0) >= MAX_ATTEMPTS) {
        task.status = "failed";
        task.lastError = "The previous attempt was interrupted and the retry limit was reached.";
        audit(task, "failed", { reason: task.lastError });
        log(state, task.lastError, task.id);
        report.recovered.push(task.id);
      } else {
        task.status = "approved";
        task.lastError = "Recovered an interrupted attempt.";
        audit(task, "recovered", { reason: task.lastError });
        log(state, task.lastError, task.id);
        report.recovered.push(task.id);
      }
    }
    const ready = state.tasks
      .filter(task => canRun(task, state.settings?.gates))
      .filter(task => !task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= now)
      .filter(task => (task.attempts ?? 0) < MAX_ATTEMPTS)
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
    for (const task of ready.slice(0, 3)) {
      if (task.risk === "high") {
        task.status = "blocked";
        task.result = preparation(task);
        task.externalSideEffects = [];
        audit(task, "blocked", { reason: "High-risk work stays inside a prepared checklist." });
        log(state, `Blocked high-risk task ${task.id}. Nothing external was executed.`, task.id);
        report.blocked.push(task.id);
        continue;
      }
      let route;
      try {
        route = selectJarvisModel(task.kind, ctx.env);
      } catch (error) {
        task.status = "blocked";
        task.lastError = error.message;
        audit(task, "blocked", { reason: error.message });
        report.blocked.push(task.id);
        continue;
      }
      task.model = route;
      task.status = "running";
      task.attempts += 1;
      task.claimId = randomUUID();
      task.claimExpiresAt = new Date(now + LEASE_MS).toISOString();
      audit(task, "claimed", { attempt: task.attempts, model: route.model, claimId: task.claimId });
      try {
        if (ctx.failOnce === `${task.id}:${task.attempts}`) throw new Error("Injected failure before completion.");
        const result = await safeResult(task, ctx);
        if (result.externalSideEffects?.length) throw new Error("Handler tried to record an external side effect.");
        task.status = "completed";
        task.completedAt = new Date().toISOString();
        task.result = result;
        task.externalSideEffects = [];
        audit(task, "completed", { handler: result.handler, model: route.model });
        log(state, `Completed ${task.id} with ${result.handler}. No external action was performed.`, task.id);
        report.completed.push(task.id);
      } catch (error) {
        const retry = task.attempts < MAX_ATTEMPTS;
        task.status = retry ? "approved" : "failed";
        task.lastError = String(error.message ?? error).slice(0, 300);
        task.nextAttemptAt = retry ? new Date(now + 1000).toISOString() : undefined;
        audit(task, retry ? "retry_scheduled" : "failed", { error: task.lastError });
        log(state, `${retry ? "Will retry" : "Failed"} ${task.id}: ${task.lastError}`, task.id);
        report.failed.push(task.id);
      }
    }
    return report;
  } finally {
    state.workerLockUntil = null;
  }
}

export function suggestTasks(state, env = process.env) {
  const created = [];
  const proposals = [];
  if (!state.leads.some(lead => lead.business === "website-agency")) {
    proposals.push({ business: "website-agency", title: "Add the first agency lead from a source you choose" });
  }
  const leadWithoutDraft = state.leads.find(lead => !state.drafts.some(draft => draft.leadId === lead.id));
  if (leadWithoutDraft) {
    proposals.push({ business: leadWithoutDraft.business, title: `Draft outreach notes for ${leadWithoutDraft.name}`.slice(0, 180) });
  }
  if (!state.drafts.some(draft => draft.business === "drivenest")) {
    proposals.push({ business: "drivenest", title: "Draft a DriveNest listing from product notes you supply" });
  }
  proposals.push({ business: "buxme", title: "Connect read-only Buxme metrics before asking for growth numbers" });
  for (const proposal of proposals) {
    if (created.length >= 3) break;
    if (state.tasks.some(task => task.title === proposal.title && task.status !== "rejected")) continue;
    created.push(createTask(state, proposal, env));
  }
  return created;
}
