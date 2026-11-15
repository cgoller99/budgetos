import { classifyTask, isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;

function completed(task, action, details) {
  return {
    business: task.business,
    businessName: task.businessName,
    taskId: task.id,
    action,
    outcome: "completed",
    details,
  };
}

// These are bounded local work products. They do not send messages, move money,
// authenticate, deploy, or mutate customer or production systems.
const handlers = {
  buxme: {
    research: task => completed(task, "buxme-research-brief", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Collect cited evidence and return it for human review.",
    }),
    business: task => completed(task, "buxme-business-review", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Review the proposal against product analytics before taking action.",
    }),
    coding: task => completed(task, "buxme-change-plan", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Prepare a reviewed change plan; no files or deployments are changed.",
    }),
    routine: task => completed(task, "buxme-routine-check", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Confirm the checklist with an operator.",
    }),
  },
  "website-agency": {
    research: task => completed(task, "agency-research-brief", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Return a human-reviewable evidence brief.",
    }),
    business: task => completed(task, "agency-growth-brief", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Return a human-reviewable growth brief.",
    }),
    coding: task => completed(task, "agency-delivery-checklist", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Prepare a reviewed change plan; no files or deployments are changed.",
    }),
    routine: task => completed(task, "agency-operations-check", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Confirm the delivery checklist with an operator.",
    }),
  },
  drivenest: {
    research: task => completed(task, "drivenest-research-brief", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Return an internal operations brief without contacting customers.",
    }),
    business: task => completed(task, "drivenest-operations-review", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Review the proposed workflow without contacting customers or booking service.",
    }),
    coding: task => completed(task, "drivenest-process-plan", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Prepare an internal process plan; no production systems are changed.",
    }),
    routine: task => completed(task, "drivenest-routine-check", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Confirm the operations checklist with an operator.",
    }),
  },
};

export function handlerFor(task) {
  const kind = task.kind || classifyTask(task.title || "");
  return handlers[task.business]?.[kind];
}

export function validateClaimable(task, now = Date.now()) {
  return Boolean(
    task &&
      task.status === "approved" &&
      task.reviewedAt &&
      task.audit?.some(event => event.type === "approved") &&
      isDue(task, now) &&
      (!task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= now) &&
      task.risk !== "high" &&
      handlerFor(task) &&
      (task.attempts || 0) < MAX_ATTEMPTS,
  );
}

export function dispatchTask(task) {
  if (
    task?.status !== "running" ||
    !task.reviewedAt ||
    !task.audit?.some(event => event.type === "approved") ||
    task.risk === "high" ||
    (task.attempts || 0) > MAX_ATTEMPTS
  ) {
    throw new Error("Task failed the approval, safety, or retry gate");
  }
  const handler = handlerFor(task);
  if (!handler) throw new Error("No handler registered for task business and kind");
  // The handler receives a frozen, business-scoped view, never the queue.
  const result = handler(Object.freeze({
    id: task.id,
    title: task.title,
    business: task.business,
    businessName: task.businessName,
    risk: task.risk,
    model: task.model,
  }));
  if (!result || result.business !== task.business || result.taskId !== task.id) {
    throw new Error("Handler returned a cross-business or invalid result");
  }
  return result;
}

export function isLeaseExpired(task, now = Date.now()) {
  return task?.status === "running" && now - Date.parse(task.startedAt || "") > LEASE_MS;
}
