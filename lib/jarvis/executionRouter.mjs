import { routeModel } from "./queuePolicy.mjs";
import { handlerFor } from "./businessHandlers.mjs";

const KINDS = new Set(["coding", "business", "research", "routine"]);

/**
 * Resolve only the model that was persisted when the task was proposed.
 * Runtime configuration must not silently replace a human-approved route.
 */
export function approvedRouteFor(task) {
  const kind = task?.model?.kind;
  const model = task?.model?.model;
  if (!KINDS.has(kind) || typeof model !== "string") {
    throw new Error("Task has no valid approved model route");
  }

  const validated = routeModel(kind, {
    [`JARVIS_${kind.toUpperCase()}_MODEL`]: model,
  });
  return {
    kind: validated.kind,
    model: validated.model,
    configured: task.model.configured === true,
  };
}

export function dispatchPlan(task) {
  const model = approvedRouteFor(task);
  const handler = handlerFor(task.business, model.kind, task);
  if (!handler) throw new Error("No business handler registered for task route");
  return { model, handler };
}
