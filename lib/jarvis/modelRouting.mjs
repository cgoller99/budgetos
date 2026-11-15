/** Shared Jarvis task classification and model selection for UI and workers. */
const MODEL_ENV_KEYS = {
  coding: "JARVIS_CODING_MODEL",
  business: "JARVIS_BUSINESS_MODEL",
  research: "JARVIS_RESEARCH_MODEL",
  routine: "JARVIS_ROUTINE_MODEL",
};

const MODEL_ID = /^[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function classifyJarvisTask(message) {
  const value = String(message).toLowerCase();
  if (/\b(code|coding|debug|bug|typescript|refactor|pull request|repository|compile|website build)\b/.test(value)) return "coding";
  if (/\b(research|compare sources|summarize documents|large document|market research|sources)\b/.test(value)) return "research";
  if (/\b(revenue|profit|conversion|pricing|marketing|business|subscription|budget|financial|strategy|sales|customer|booking)\b/.test(value)) return "business";
  return "routine";
}

export function selectJarvisModel(kind, env = process.env) {
  if (!Object.hasOwn(MODEL_ENV_KEYS, kind)) throw new Error("Unsupported Jarvis task kind");
  const configured = env[MODEL_ENV_KEYS[kind]]?.trim();
  const model = configured || env.JARVIS_CHAT_MODEL?.trim() || "openai/gpt-4o-mini";
  if (!MODEL_ID.test(model)) throw new Error("Invalid Jarvis model identifier");
  return { kind, model, configured: Boolean(configured) };
}

export function isValidJarvisModel(model) {
  return MODEL_ID.test(model);
}
