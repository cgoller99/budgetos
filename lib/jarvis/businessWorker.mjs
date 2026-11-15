import { classifyTask, isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;
export const RETRY_BASE_MS = 1_000;

function result(task, action, details) {
  return {
    business: task.business,
    businessName: task.businessName,
    taskId: task.id,
    action,
    outcome: "completed",
    details,
  };
}

// These handlers are deliberately local and deterministic. They produce bounded
// work products; none can send, pay, authenticate, deploy, or mutate production.
const handlers = {
  buxme: {
    business: task => result(task, "buxme-business-review", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Review the proposal against product analytics before taking action.",
    }),
    research: task => result(task, "buxme-research-brief", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Collect cited evidence and return it for human review.",
    }),
    routine: task => result(task, "buxme-routine-check", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Confirm the checklist with an operator.",
    }),
  },
  "website-agency": {
    coding: task => result(task, "agency-delivery-checklist", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Prepare a reviewed change plan; no files or deployments are changed.",
    }),
    business: task => result(task, "agency-growth-brief", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Return a human-reviewable growth brief.",
    }),
    routine: task => result(task, "agency-operations-check", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Confirm the delivery checklist with an operator.",
    }),
  },
  drivenest: {
    business: task => result(task, "drivenest-operations-review", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Review the proposed workflow without contacting customers or booking service.",
    }),
    routine: task => result(task, "drivenest-routine-check", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Confirm the operations checklist with an operator.",
    }),
  },
};

export function handlerFor(task) {
  const kind = task.kind || classifyTask(task.title || "");
  return handlers[task.business]?.[kind] || handlers[task.business]?.routine;
}

export function validateClaimable(task, now = Date.now()) {
  if (!task || task.status !== "approved") return false;
  if (!task.reviewedAt || !task.audit?.some(event => event.type === "approved")) return false;
  if (!isDue(task, now) || task.risk === "high") return false;
  if (task.nextAttemptAt && Date.parse(task.nextAttemptAt) > now) return false;
  return typeof handlerFor(task) === "function" && (task.attempts || 0) < MAX_ATTEMPTS;
}

export function dispatchTask(task) {
  if (
    task?.status !== "running" ||
    !task.reviewedAt ||
    !task.audit?.some(event => event.type === "approved") ||
    task.risk === "high" ||
    typeof handlerFor(task) !== "function" ||
    (task.attempts || 0) > MAX_ATTEMPTS
  ) {
    throw new Error("Task failed the approval, safety, due-time, or handler gate");
  }
  const handler = handlerFor(task);
  // Do not pass the queue or another business into a handler.
  const isolatedTask = Object.freeze({
    id: task.id,
    title: task.title,
    business: task.business,
    businessName: task.businessName,
    risk: task.risk,
    model: task.model,
  });
  const value = handler(isolatedTask);
  if (!value || value.business !== task.business || value.taskId !== task.id) {
    throw new Error("Handler returned a cross-business or invalid result");
  }
  return value;
}

export function isLeaseExpired(task, now = Date.now()) {
  return task.status === "running" && now - Date.parse(task.startedAt || "") > LEASE_MS;
}
