import { classifyTask, isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;

function result(task, action, details) {
  return {
    taskId: task.id,
    business: task.business,
    businessName: task.businessName,
    action,
    outcome: "completed",
    details,
  };
}

// Handlers create local review artifacts only. They cannot contact customers,
// move money, authenticate, or change application or production state.
const handlers = {
  buxme: {
    research: task => result(task, "buxme-research-brief", {
      scope: "Buxme personal finance product",
      request: task.title,
      deliverable: "Evidence-backed research brief for operator review",
    }),
    business: task => result(task, "buxme-growth-review", {
      scope: "Buxme personal finance product",
      request: task.title,
      deliverable: "Growth review for operator review",
    }),
    routine: task => result(task, "buxme-operations-check", {
      scope: "Buxme personal finance product",
      request: task.title,
      deliverable: "Operations checklist for operator review",
    }),
  },
  "website-agency": {
    coding: task => result(task, "agency-delivery-plan", {
      scope: "Website-building agency",
      request: task.title,
      deliverable: "Reviewed implementation plan; no files or deployment changed",
    }),
    business: task => result(task, "agency-growth-review", {
      scope: "Website-building agency",
      request: task.title,
      deliverable: "Growth review for operator review",
    }),
    routine: task => result(task, "agency-operations-check", {
      scope: "Website-building agency",
      request: task.title,
      deliverable: "Delivery checklist for operator review",
    }),
  },
  drivenest: {
    business: task => result(task, "drivenest-operations-review", {
      scope: "DriveNest Auto Care",
      request: task.title,
      deliverable: "Operations review; no customer contact or booking performed",
    }),
    routine: task => result(task, "drivenest-operations-check", {
      scope: "DriveNest Auto Care",
      request: task.title,
      deliverable: "Operations checklist for operator review",
    }),
  },
};

export function handlerFor(task) {
  const kind = task.kind || task.model?.kind || classifyTask(task.title || "");
  return handlers[task.business]?.[kind] || handlers[task.business]?.routine;
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
    (task.attempts || 0) < MAX_ATTEMPTS,
  );
}

export function dispatchTask(task) {
  if (!validateClaimable({ ...task, status: "approved" })) {
    throw new Error("Task failed the approval, safety, due-time, or handler gate");
  }
  const isolated = Object.freeze({
    id: task.id,
    title: task.title,
    business: task.business,
    businessName: task.businessName,
    model: task.model,
  });
  const value = handlerFor(isolated)(isolated);
  if (value.taskId !== task.id || value.business !== task.business) {
    throw new Error("Handler returned an invalid or cross-business result");
  }
  return value;
}

export function leaseExpired(task, now = Date.now()) {
  return task.status === "running" &&
    now - Date.parse(task.startedAt || "") > LEASE_MS;
}
