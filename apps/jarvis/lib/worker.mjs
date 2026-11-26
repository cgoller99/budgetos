import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { connectionFor } from "./brain.mjs";
import { think } from "./brain.mjs";
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
  const open = state.tasks.find(task => task.business === business && task.title === cleanTitle && ["proposed", "approved", "running", "blocked"].includes(task.status));
  if (open) return open;
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

function notesResult(task, chain, inventory) {
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
      source: "notes",
    };
  }
  if (task.kind === "coding") {
    return { chain, inventory, coding: true };
  }
  return {
    handler: "status",
    modelConsidered: chain[0],
    text: `Recorded work for ${task.businessName}: ${task.title}. ${inventory.note} No external action was performed.`,
    inventory,
    externalSideEffects: [],
    source: "notes",
  };
}

function instant(value) {
  if (typeof value === "function") return new Date(value());
  if (value instanceof Date || typeof value === "number") return new Date(value);
  return new Date();
}

export async function produceTaskResult(task, ctx) {
  const inventory = await readBusinessInventory(ctx.repoRoot, task.business);
  const chain = modelChain(task.kind, ctx.env);
  const now = instant(ctx.now);
  const connection = connectionFor(ctx.env, ctx.usage, now);
  if (connection.connected) {
    const usage = {
      day: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now),
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      errors: [],
      byModel: {},
      ...(ctx.usage ?? {}),
    };
    const prompt = [
      `Do this approved task for ${task.businessName}: ${task.title}`,
      task.detail?.trim() ? `Owner notes:\n${task.detail.trim()}` : "The owner supplied no notes.",
      inventory.note,
      "Use only these notes and this inventory. Do not invent metrics, customers, or revenue. Do not claim that a message was sent, money was spent, code was changed, or a deployment happened.",
    ].join("\n\n");
    const thought = await think({
      text: prompt,
      state: { tasks: [], messages: [], usage },
      env: ctx.env,
      fetchImpl: ctx.fetchImpl,
      now,
      kind: task.kind,
    });
    if (thought.provider !== "gateway") {
      const error = new Error(thought.error || "The model did not answer.");
      error.usage = thought.usage;
      throw error;
    }
    return {
      result: {
        handler: "model",
        source: "gateway",
        modelConsidered: thought.model,
        fallbacks: thought.attempted.filter(model => model !== thought.model),
        text: `${thought.reply}\n\nThis was not sent, published, purchased, or deployed.`,
        inventory,
        externalSideEffects: [],
      },
      usage: thought.usage,
      model: thought.model,
    };
  }
  const prepared = notesResult(task, chain, inventory);
  const reason = connection.reason;
  if (prepared.coding) {
    const artifact = await writePlan(ctx.dataDir, task, chain, inventory);
    return {
      result: {
        handler: "code-plan",
        source: "notes",
        modelConsidered: chain[0],
        fallbacks: chain.slice(1),
        text: `Prepared a coding plan. No model was called because ${reason} No application file was edited, and no branch, commit, or pull request was created.`,
        artifact,
        inventory,
        externalSideEffects: [],
        connectionError: reason,
      },
      usage: null,
      model: chain[0],
    };
  }
  return {
    result: { ...prepared, connectionError: reason },
    usage: null,
    model: chain[0],
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

export function beginWorker(state, ctx) {
  const now = ctx.now ? ctx.now() : Date.now();
  const report = { recovered: [], blocked: [], claimed: [], skipped: [], ownedLock: false };
  if (state.workerLockUntil && Date.parse(state.workerLockUntil) > now) {
    return { ...report, skipped: ["worker-already-running"] };
  }
  state.workerLockUntil = new Date(now + 60 * 1000).toISOString();
  report.ownedLock = true;
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
      task.progress = [...(task.progress ?? []), { at: new Date(now).toISOString(), message: `Selected ${route.model}` }].slice(-12);
      audit(task, "claimed", { attempt: task.attempts, model: route.model, claimId: task.claimId });
      log(state, `Claimed ${task.id} for ${route.model}.`, task.id);
      report.claimed.push({
        id: task.id,
        title: task.title,
        detail: task.detail,
        business: task.business,
        businessName: task.businessName,
        kind: task.kind,
        attempts: task.attempts,
      });
    }
  return report;
}

export function finishWorker(state, outcomes, ctx = {}) {
  const now = ctx.now ? ctx.now() : Date.now();
  const report = { completed: [], failed: [] };
  for (const outcome of outcomes) {
    const task = state.tasks.find(item => item.id === outcome.id && item.status === "running");
    if (!task) continue;
    if (!outcome.ok) {
      const retry = task.attempts < MAX_ATTEMPTS;
      task.status = retry ? "approved" : "failed";
      task.lastError = String(outcome.error ?? "The model did not answer.").slice(0, 300);
      task.nextAttemptAt = retry ? new Date(now + 1000).toISOString() : undefined;
      task.progress = [...(task.progress ?? []), { at: new Date(now).toISOString(), message: task.lastError }].slice(-12);
      audit(task, retry ? "retry_scheduled" : "failed", { error: task.lastError });
      log(state, `${retry ? "Will retry" : "Failed"} ${task.id}: ${task.lastError}`, task.id);
      report.failed.push(task.id);
      continue;
    }
    if (outcome.result?.externalSideEffects?.length) {
      task.status = "failed";
      task.lastError = "Handler tried to record an external side effect.";
      audit(task, "failed", { error: task.lastError });
      log(state, task.lastError, task.id);
      report.failed.push(task.id);
      continue;
    }
    task.status = "completed";
    task.completedAt = new Date(now).toISOString();
    task.result = outcome.result;
    task.externalSideEffects = [];
    task.lastError = "";
    if (outcome.model) task.model = { ...(task.model ?? {}), model: outcome.model, answered: outcome.result?.source === "gateway" };
    const progress = outcome.result?.source === "gateway"
      ? `Answered with ${outcome.model}.`
      : "Prepared from recorded notes. No model was called.";
    task.progress = [...(task.progress ?? []), { at: task.completedAt, message: progress }].slice(-12);
    audit(task, "completed", { handler: outcome.result?.handler, model: outcome.model, source: outcome.result?.source });
    log(state, `Completed ${task.id} with ${outcome.result?.handler}. ${progress} No external action was performed.`, task.id);
    report.completed.push(task.id);
  }
  if (ctx.ownedLock) state.workerLockUntil = null;
  return report;
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
