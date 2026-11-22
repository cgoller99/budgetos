import { randomUUID } from "node:crypto";
import { classifyJarvisTask, riskFor, selectJarvisModel } from "./routing.mjs";
import { BUSINESSES } from "./store.mjs";

const MAX_AUDIT = 50;

function audit(task, type, details = {}) {
  task.audit ??= [];
  task.audit.push({ type, at: new Date().toISOString(), actor: "jarvis", ...details });
  if (task.audit.length > MAX_AUDIT) task.audit = task.audit.slice(-MAX_AUDIT);
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
