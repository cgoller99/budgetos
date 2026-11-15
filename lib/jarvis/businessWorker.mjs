import { classifyTask, isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;
export const RETRY_BASE_MS = 1_000;

const scopes = {
  buxme: {
    research: ["buxme-research-brief", "Return cited findings for founder review."],
    routine: ["buxme-operations-check", "Confirm the checklist with an operator."],
    business: ["buxme-business-brief", "Review the proposal against product evidence."],
    coding: ["buxme-delivery-plan", "Prepare a reviewed change plan; do not change files."],
  },
  "website-agency": {
    research: ["agency-research-brief", "Return cited findings for client-work review."],
    routine: ["agency-operations-check", "Confirm the delivery checklist with an operator."],
    business: ["agency-growth-brief", "Return a human-reviewable growth brief."],
    coding: ["agency-delivery-plan", "Prepare a reviewed change plan; do not deploy."],
  },
  drivenest: {
    research: ["drivenest-research-brief", "Return cited findings for operator review."],
    routine: ["drivenest-operations-check", "Confirm the operations checklist with an operator."],
    business: ["drivenest-business-brief", "Review the proposed workflow without contacting customers."],
    coding: ["drivenest-delivery-plan", "Prepare a reviewed change plan; do not change production."],
  },
};

export function handlerFor(task) {
  const kind = task.kind || classifyTask(task.title || "");
  return scopes[task.business]?.[kind]
    ? input => {
        const [action, nextStep] = scopes[input.business][kind];
        return {
          taskId: input.id,
          business: input.business,
          businessName: input.businessName,
          action,
          outcome: "completed",
          details: { requestedWork: input.title, nextStep },
        };
      }
    : null;
}

export function validateClaimable(task, now = Date.now()) {
  return Boolean(
    task &&
      task.status === "approved" &&
      task.reviewedAt &&
      task.audit?.some(entry => entry.type === "approved") &&
      isDue(task, now) &&
      task.risk !== "high" &&
      (!task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= now) &&
      (task.attempts || 0) < MAX_ATTEMPTS &&
      handlerFor(task),
  );
}

export function dispatchTask(task) {
  if (
    task?.status !== "running" ||
    !task.reviewedAt ||
    !task.audit?.some(entry => entry.type === "approved") ||
    task.risk === "high" ||
    (task.attempts || 0) > MAX_ATTEMPTS
  ) {
    throw new Error("Task failed the approval or safety gate");
  }
  const handler = handlerFor(task);
  if (!handler) throw new Error("No handler registered for this business and task kind");
  const value = handler(Object.freeze({
    id: task.id,
    title: task.title,
    business: task.business,
    businessName: task.businessName,
    model: task.model,
  }));
  if (value?.taskId !== task.id || value?.business !== task.business) {
    throw new Error("Handler returned an invalid or cross-business result");
  }
  return value;
}

export function leaseExpired(task, now = Date.now()) {
  return task.status === "running" && now - Date.parse(task.startedAt || "") > LEASE_MS;
}
