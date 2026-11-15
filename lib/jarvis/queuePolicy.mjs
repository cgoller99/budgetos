import { classifyJarvisTask, isValidJarvisModel, selectJarvisModel } from "./modelRouting.mjs";

export const BUSINESSES = {
  buxme: { name: "Buxme", description: "Personal finance product" },
  "website-agency": { name: "Website-building agency", description: "Website delivery and growth" },
  drivenest: { name: "DriveNest Auto Care", description: "Auto care operations" },
};

export function classifyTask(title) {
  return classifyJarvisTask(title);
}

export function routeModel(kind, env = process.env) {
  return selectJarvisModel(kind, env);
}

// Resolve the route at execution time. Queue metadata is treated as untrusted
// input so a changed or hand-edited model cannot bypass the configured router.
export function routeForTask(task, env = process.env) {
  const kind = task?.model?.kind;
  const route = routeModel(kind, env);
  if (task.model.model && !isValidJarvisModel(task.model.model)) {
    throw new Error("Invalid queued Jarvis model identifier");
  }
  return route;
}

export function riskFor(title) {
  if (/\b(payment|bank|banking|auth|customer data|production|deploy|email customer|text customer)\b/i.test(title)) return "high";
  if (/\b(code|coding|website build|marketing|pricing|sales|booking)\b/i.test(title)) return "medium";
  return "low";
}

export function isDue(task, now = Date.now()) {
  return !task.scheduledAt || Date.parse(task.scheduledAt) <= now;
}
