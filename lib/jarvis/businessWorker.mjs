import { classifyTask, isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;

function completed(task, action, deliverable) {
  return {
    taskId: task.id,
    business: task.business,
    businessName: task.businessName,
    action,
    outcome: "completed",
    details: {
      request: task.title,
      deliverable,
      sideEffects: "none",
    },
  };
}

// These handlers produce review artifacts only. They cannot contact customers,
// move money, authenticate, or change application or production state.
const handlers = {
  buxme: {
    research: task => completed(task, "buxme-research-brief", "Evidence-backed research brief for operator review"),
    business: task => completed(task, "buxme-growth-review", "Growth review for operator review"),
    routine: task => completed(task, "buxme-operations-check", "Operations checklist for operator review"),
  },
  "website-agency": {
    coding: task => completed(task, "agency-delivery-plan", "Reviewed implementation plan; no files or deployment changed"),
    business: task => completed(task, "agency-growth-review", "Growth review for operator review"),
    routine: task => completed(task, "agency-operations-check", "Delivery checklist for operator review"),
  },
  drivenest: {
    business: task => completed(task, "drivenest-operations-review", "Operations review; no customer contact or booking performed"),
    routine: task => completed(task, "drivenest-operations-check", "Operations checklist for operator review"),
  },
};

export function handlerFor(task) {
  const kind = task.kind || task.model?.kind || classifyTask(task.title || "");
  return handlers[task.business]?.[kind];
}

export function validateClaimable(task, now = Date.now()) {
  return Boolean(
    task &&
    task.status === "approved" &&
    task.reviewedAt &&
    task.audit?.some(entry => entry.type === "approved") &&
    isDue(task, now) &&
    task.risk !== "high" &&
    handlerFor(task) &&
    (task.attempts || 0) < MAX_ATTEMPTS &&
    (!task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= now),
  );
}

export function dispatchTask(task) {
  if (!validateClaimable({ ...task, status: "approved" })) {
    throw new Error("Task failed approval, safety, due-time, retry, or handler gate");
  }
  const isolated = Object.freeze({
    id: task.id,
    title: task.title,
    business: task.business,
    businessName: task.businessName,
    model: task.model,
    kind: task.kind || task.model?.kind,
  });
  const value = handlerFor(isolated)(isolated);
  if (
    value.taskId !== task.id ||
    value.business !== task.business ||
    value.businessName !== task.businessName
  ) {
    throw new Error("Handler returned an invalid or cross-business result");
  }
  return value;
}

export function leaseExpired(task, now = Date.now()) {
  return task.status === "running" &&
    Number.isFinite(Date.parse(task.startedAt)) &&
    now - Date.parse(task.startedAt) > LEASE_MS;
}
