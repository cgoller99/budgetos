import { classifyJarvisTask, selectJarvisModel } from "./modelRouting.ts";

export const BUSINESS_SCOPES = [
  "buxme",
  "website_agency",
  "drivenest_auto_care",
] as const;

export type BusinessScope = (typeof BUSINESS_SCOPES)[number];
export type BusinessQueueStatus =
  | "queued"
  | "approved"
  | "rejected"
  | "running"
  | "completed";
export type BusinessRisk = "observe" | "draft" | "external" | "financial" | "customer_data";

export type BusinessAuditEvent = {
  event: string;
  at: string;
  actor?: string;
  detail?: string;
};

export type BusinessQueueTask = {
  id: string;
  business: BusinessScope;
  title: string;
  objective: string;
  kind: ReturnType<typeof classifyJarvisTask>;
  risk: BusinessRisk;
  requiresApproval: true;
  status: BusinessQueueStatus;
  scheduledFor: string;
  model: string;
  createdAt: string;
  approvedAt?: string;
  audit: BusinessAuditEvent[];
};

const ID_PATTERN = /^[a-z][a-z0-9-]{2,48}$/;
const MAX_TITLE = 180;
const MAX_OBJECTIVE = 1000;

function assertIso(value: string, field: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO date`);
  }
}

export function isBusinessScope(value: string): value is BusinessScope {
  return (BUSINESS_SCOPES as readonly string[]).includes(value);
}

export function createBusinessTask(input: {
  id: string;
  business: BusinessScope;
  title: string;
  objective: string;
  risk: BusinessRisk;
  scheduledFor: string;
  now?: string;
  env?: Record<string, string | undefined>;
}): BusinessQueueTask {
  if (!ID_PATTERN.test(input.id)) throw new Error("Invalid task id");
  if (!isBusinessScope(input.business)) throw new Error("Invalid business scope");
  if (!input.title.trim() || input.title.length > MAX_TITLE) throw new Error("Invalid task title");
  if (!input.objective.trim() || input.objective.length > MAX_OBJECTIVE) {
    throw new Error("Invalid task objective");
  }
  assertIso(input.scheduledFor, "scheduledFor");
  const createdAt = input.now ?? new Date().toISOString();
  assertIso(createdAt, "now");
  const kind = classifyJarvisTask(`${input.title}\n${input.objective}`);
  const model = selectJarvisModel(kind, input.env).model;
  const task: BusinessQueueTask = {
    id: input.id,
    business: input.business,
    title: input.title.trim(),
    objective: input.objective.trim(),
    kind,
    risk: input.risk,
    requiresApproval: true,
    status: "queued",
    scheduledFor: new Date(input.scheduledFor).toISOString(),
    model,
    createdAt,
    audit: [],
  };
  appendAudit(task, "queued", "system", `business=${task.business}; model=${task.model}`);
  return task;
}

export function appendAudit(
  task: BusinessQueueTask,
  event: string,
  actor: string,
  detail?: string,
) {
  task.audit.push({ event, actor, detail, at: new Date().toISOString() });
  if (task.audit.length > 50) task.audit.splice(0, task.audit.length - 50);
}

export function approveBusinessTask(
  task: BusinessQueueTask,
  actor: string,
  now = new Date().toISOString(),
) {
  if (task.status !== "queued") throw new Error("Only queued tasks can be approved");
  task.status = "approved";
  task.approvedAt = now;
  appendAudit(task, "approved", actor);
}

export function rejectBusinessTask(task: BusinessQueueTask, actor: string, reason: string) {
  if (task.status !== "queued") throw new Error("Only queued tasks can be rejected");
  task.status = "rejected";
  appendAudit(task, "rejected", actor, reason.slice(0, 500));
}

export function claimDueBusinessTask(
  tasks: BusinessQueueTask[],
  now = new Date().toISOString(),
): BusinessQueueTask | null {
  assertIso(now, "now");
  const due = tasks
    .filter((task) => task.status === "approved" && task.requiresApproval)
    .filter((task) => Date.parse(task.scheduledFor) <= Date.parse(now))
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor) || a.id.localeCompare(b.id));
  const task = due[0];
  if (!task) return null;
  task.status = "running";
  appendAudit(task, "claimed", "worker", `risk=${task.risk}`);
  return task;
}
