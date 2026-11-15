import { classifyTask, isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;

function workProduct(task, action, nextStep) {
  return {
    business: task.business,
    businessName: task.businessName,
    taskId: task.id,
    action,
    outcome: "completed",
    details: {
      requestedWork: task.title,
      scope: task.businessName,
      nextStep,
      sideEffects: [],
    },
  };
}

const handlers = {
  buxme: {
    research: task => workProduct(task, "buxme-research-brief", "Collect cited evidence for human review."),
    business: task => workProduct(task, "buxme-growth-review", "Validate the opportunity against product analytics."),
    routine: task => workProduct(task, "buxme-operations-check", "Confirm the checklist with an operator."),
  },
  "website-agency": {
    coding: task => workProduct(task, "agency-delivery-plan", "Prepare a reviewed change plan; no files or deployments are changed."),
    business: task => workProduct(task, "agency-growth-brief", "Return a human-reviewable growth brief."),
    routine: task => workProduct(task, "agency-operations-check", "Confirm the delivery checklist with an operator."),
  },
  drivenest: {
    business: task => workProduct(task, "drivenest-operations-review", "Review the workflow without contacting customers or booking service."),
    routine: task => workProduct(task, "drivenest-operations-check", "Confirm the checklist with an operator."),
  },
};

export function handlerFor(task) {
  const kind = task.kind ?? task.model?.kind ?? classifyTask(task.title ?? "");
  return handlers[task.business]?.[kind] ?? handlers[task.business]?.routine;
}

export function validateClaimable(task, now = Date.now()) {
  return Boolean(
    task &&
    task.status === "approved" &&
    task.reviewedAt &&
    task.audit?.some(entry => entry.type === "approved") &&
    isDue(task, now) &&
    task.risk !== "high" &&
    typeof handlerFor(task) === "function" &&
    (task.attempts ?? 0) < MAX_ATTEMPTS,
  );
}

export function dispatchTask(task) {
  if (task?.status !== "running" || !task.reviewedAt || !task.audit?.some(entry => entry.type === "approved") || task.risk === "high") {
    throw new Error("Task failed the approval or safety gate");
  }
  const handler = handlerFor(task);
  if (typeof handler !== "function") throw new Error("No handler registered for business task");
  const isolatedTask = Object.freeze({
    id: task.id,
    title: task.title,
    business: task.business,
    businessName: task.businessName,
    model: task.model,
  });
  const result = handler(isolatedTask);
  if (result.business !== task.business || result.taskId !== task.id || result.details.sideEffects.length !== 0) {
    throw new Error("Handler returned an invalid or unsafe result");
  }
  return result;
}

export function isLeaseExpired(task, now = Date.now()) {
  return task?.status === "running" && now - Date.parse(task.startedAt ?? "") > LEASE_MS;
}
