import { classifyTask, isDue } from "./queuePolicy.mjs";

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60 * 1000;

const result = (task, action, details) => ({
  business: task.business,
  businessName: task.businessName,
  taskId: task.id,
  action,
  outcome: "completed",
  details,
});

// Handlers only create local, human-reviewable work products. They never send
// messages, move money, authenticate, deploy, or mutate customer/production data.
const handlers = {
  buxme: {
    research: task => result(task, "buxme-research-brief", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Collect cited evidence and return it for human review.",
    }),
    business: task => result(task, "buxme-business-review", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Review the proposal against product analytics before action.",
    }),
    coding: task => result(task, "buxme-change-plan", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Prepare a reviewed change plan; no files or deployments change.",
    }),
    routine: task => result(task, "buxme-routine-check", {
      scope: "Buxme personal finance product",
      requestedWork: task.title,
      nextStep: "Confirm the checklist with an operator.",
    }),
  },
  "website-agency": {
    research: task => result(task, "agency-research-brief", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Return a human-reviewable evidence brief.",
    }),
    business: task => result(task, "agency-growth-brief", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Return a human-reviewable growth brief.",
    }),
    coding: task => result(task, "agency-delivery-checklist", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Prepare a reviewed change plan; no files or deployments change.",
    }),
    routine: task => result(task, "agency-operations-check", {
      scope: "Website-building agency",
      requestedWork: task.title,
      nextStep: "Confirm the delivery checklist with an operator.",
    }),
  },
  drivenest: {
    research: task => result(task, "drivenest-research-brief", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Return an internal operations brief without contacting customers.",
    }),
    business: task => result(task, "drivenest-operations-review", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Review the workflow without contacting customers or booking service.",
    }),
    coding: task => result(task, "drivenest-process-plan", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Prepare an internal process plan; no production systems change.",
    }),
    routine: task => result(task, "drivenest-routine-check", {
      scope: "DriveNest Auto Care",
      requestedWork: task.title,
      nextStep: "Confirm the operations checklist with an operator.",
    }),
  },
};

export function handlerFor(task) {
  return handlers[task?.business]?.[task?.kind || classifyTask(task?.title || "")];
}

function hasApproval(task) {
  return Boolean(
    task?.reviewedAt &&
    !Number.isNaN(Date.parse(task.reviewedAt)) &&
    task.audit?.some(event => event.type === "approved"),
  );
}

export function validateClaimable(task, now = Date.now()) {
  return Boolean(
    task?.status === "approved" &&
    hasApproval(task) &&
    isDue(task, now) &&
    (!task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= now) &&
    (task.risk === "low" || task.risk === "medium") &&
    handlerFor(task) &&
    (task.attempts || 0) < MAX_ATTEMPTS
  );
}

export function dispatchTask(task, now = Date.now()) {
  if (
    task?.status !== "running" ||
    !hasApproval(task) ||
    !isDue(task, now) ||
    (task.risk !== "low" && task.risk !== "medium") ||
    (task.attempts || 0) > MAX_ATTEMPTS
  ) {
    throw new Error("Task failed the approval, due, safety, or retry gate");
  }
  const handler = handlerFor(task);
  if (!handler) throw new Error("No business handler registered");
  const output = handler(Object.freeze({
    id: task.id,
    title: task.title,
    business: task.business,
    businessName: task.businessName,
    risk: task.risk,
    model: task.model,
  }));
  if (!output || output.business !== task.business || output.taskId !== task.id) {
    throw new Error("Handler returned an invalid or cross-business result");
  }
  return output;
}

export function isLeaseExpired(task, now = Date.now()) {
  return task?.status === "running" &&
    Number.isFinite(Date.parse(task.startedAt || "")) &&
    now - Date.parse(task.startedAt) > LEASE_MS;
}
