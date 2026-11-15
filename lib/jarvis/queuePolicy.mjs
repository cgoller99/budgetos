export const BUSINESSES = {
  buxme: { name: "Buxme", description: "Personal finance product" },
  "website-agency": { name: "Website-building agency", description: "Website delivery and growth" },
  drivenest: { name: "DriveNest Auto Care", description: "Auto care operations" },
};

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

export function riskFor(title) {
  if (/\b(payment|bank|banking|auth|customer data|production|deploy|email customer|text customer)\b/i.test(title)) return "high";
  if (/\b(code|coding|website build|marketing|pricing|sales|booking)\b/i.test(title)) return "medium";
  return "low";
}

export function isDue(task, now = Date.now()) {
  return !task.scheduledAt || Date.parse(task.scheduledAt) <= now;
}
