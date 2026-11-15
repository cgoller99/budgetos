export const BUSINESSES = {
  buxme: { name: "Buxme", description: "Personal finance product" },
  "website-agency": { name: "Website-building agency", description: "Website delivery and growth" },
  drivenest: { name: "DriveNest Auto Care", description: "Auto care operations" },
};

export const MAX_SCHEDULE_AHEAD_MS = 31 * 24 * 60 * 60 * 1000;

export function validateScheduleTime(value, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Schedule time must be a valid ISO timestamp");
  if (timestamp <= now) throw new Error("Schedule time must be in the future");
  if (timestamp > now + MAX_SCHEDULE_AHEAD_MS) {
    throw new Error("Schedule time must be within 31 days");
  }
  return new Date(timestamp).toISOString();
}

const MODEL_ENV_KEYS = {
  coding: "JARVIS_CODING_MODEL",
  business: "JARVIS_BUSINESS_MODEL",
  research: "JARVIS_RESEARCH_MODEL",
  routine: "JARVIS_ROUTINE_MODEL",
};

export function classifyTask(title) {
  const value = title.toLowerCase();
  if (/\b(code|coding|bug|debug|typescript|refactor|website build|deploy)\b/.test(value)) return "coding";
  if (/\b(research|compare|sources|market research)\b/.test(value)) return "research";
  if (/\b(revenue|profit|conversion|pricing|marketing|sales|customer|booking|business)\b/.test(value)) return "business";
  return "routine";
}

export function routeModel(kind, env = process.env) {
  const configured = env[MODEL_ENV_KEYS[kind]]?.trim();
  const model = configured || env.JARVIS_CHAT_MODEL?.trim() || "openai/gpt-4o-mini";
  if (!/^[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(model)) throw new Error("Invalid Jarvis model identifier");
  return { kind, model, configured: Boolean(configured) };
}

// Resolve the route at execution time. Queue metadata is treated as untrusted
// input so a changed or hand-edited model cannot bypass the configured router.
export function routeForTask(task, env = process.env) {
  const kind = task?.model?.kind;
  if (!Object.hasOwn(MODEL_ENV_KEYS, kind)) throw new Error("Unsupported Jarvis task kind");
  const route = routeModel(kind, env);
  if (task.model.model && !/^[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(task.model.model)) {
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
