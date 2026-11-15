/** Shared contract for the bounded, proposal-only multi-business Jarvis slice. */
export const BUSINESSES = Object.freeze({
  buxme: { id: "buxme", name: "Buxme", defaultModelKind: "business" },
  website_agency: { id: "website_agency", name: "Website-building agency", defaultModelKind: "business" },
  drivenest_auto_care: { id: "drivenest_auto_care", name: "DriveNest Auto Care", defaultModelKind: "business" },
});

const BUSINESS_IDS = new Set(Object.keys(BUSINESSES));
const TASK_KINDS = new Set(["coding", "business", "research", "routine"]);
const BLOCKED_SCOPE = /(?:\b(deploy|send|charge|refund|move|transfer|update|write|delete|export|change)\b.{0,50}\b(production|payment|billing|bank|banking|auth|customer[- ]data|customer records|money movement)\b|\b(production|payment|billing|bank|banking|auth|customer[- ]data|customer records|money movement)\b.{0,50}\b(deploy|send|charge|refund|move|transfer|update|write|delete|export|change)\b)/i;

export function validateBusinessId(businessId) {
  if (!BUSINESS_IDS.has(businessId)) throw new Error(`Unknown business scope: ${businessId}`);
  return businessId;
}

export function createBusinessTask({ id, title, businessId, taskKind = "business", scheduledFor = null, now = new Date().toISOString() }) {
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(id ?? "")) throw new Error("Invalid task ID");
  if (!title || title.length > 180 || /[\r\n]/.test(title)) throw new Error("Invalid task title");
  validateBusinessId(businessId);
  if (!TASK_KINDS.has(taskKind)) throw new Error(`Unknown task kind: ${taskKind}`);
  if (scheduledFor !== null && (!Number.isFinite(Date.parse(scheduledFor)))) throw new Error("Invalid schedule");
  const requiresApproval = true;
  const safety = BLOCKED_SCOPE.test(title) ? "blocked" : "proposal_only";
  return {
    id,
    title,
    businessId,
    businessName: BUSINESSES[businessId].name,
    taskKind,
    status: safety === "blocked" ? "blocked" : "proposed",
    safety,
    approvalRequired: requiresApproval,
    approvalStatus: "pending",
    scheduledFor,
    attempts: 0,
    audit: [{ event: "created", at: now, businessId, safety }],
    createdAt: now,
  };
}

export function routeBusinessTask(task, modelRouter) {
  validateBusinessId(task.businessId);
  if (!TASK_KINDS.has(task.taskKind)) throw new Error("Task kind is not routable");
  return modelRouter(task.taskKind);
}

export function reviewBusinessTask(task, decision, now = new Date().toISOString()) {
  if (task.status !== "proposed" || task.approvalStatus !== "pending") throw new Error("Task is not awaiting approval");
  if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid approval decision");
  task.approvalStatus = decision;
  task.status = decision;
  task.reviewedAt = now;
  task.audit.push({ event: "approval_reviewed", at: now, decision, businessId: task.businessId });
  return task;
}

export function isDue(task, now = Date.now()) {
  return !task.scheduledFor || Date.parse(task.scheduledFor) <= now;
}
