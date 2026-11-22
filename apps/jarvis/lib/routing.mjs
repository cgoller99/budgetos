/** Task classification and provider order. No network calls and no credentials. */
const MODEL_ENV_KEYS = {
  coding: "JARVIS_CODING_MODEL",
  business: "JARVIS_BUSINESS_MODEL",
  research: "JARVIS_RESEARCH_MODEL",
  routine: "JARVIS_ROUTINE_MODEL",
};

const MODEL_ID = /^[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const FALLBACKS = {
  coding: ["anthropic/claude-sonnet-4", "openai/gpt-4o-mini", "google/gemini-2.5-pro"],
  research: ["google/gemini-2.5-pro", "openai/gpt-4o-mini", "anthropic/claude-sonnet-4"],
  business: ["openai/gpt-4o", "openai/gpt-4o-mini", "google/gemini-2.5-pro"],
  routine: ["openai/gpt-4o-mini", "google/gemini-2.5-pro", "anthropic/claude-sonnet-4"],
};

export function classifyJarvisTask(message) {
  const value = String(message ?? "").toLowerCase();
  if (/\b(code|coding|debug|bug|typescript|refactor|pull request|repository|compile|website build)\b/.test(value)) return "coding";
  if (/\b(research|compare sources|summarize documents|large document|market research|sources)\b/.test(value)) return "research";
  if (/\b(revenue|profit|conversion|pricing|marketing|business|subscription|budget|financial|strategy|sales|customer|booking)\b/.test(value)) return "business";
  return "routine";
}

export function isValidJarvisModel(model) {
  return MODEL_ID.test(String(model ?? ""));
}

export function selectJarvisModel(kind, env = process.env) {
  if (!Object.hasOwn(MODEL_ENV_KEYS, kind)) throw new Error("Unsupported Jarvis task kind");
  const configured = env[MODEL_ENV_KEYS[kind]]?.trim();
  const model = configured || env.JARVIS_CHAT_MODEL?.trim() || "openai/gpt-4o-mini";
  if (!isValidJarvisModel(model)) throw new Error("Invalid Jarvis model identifier");
  return { kind, model, configured: Boolean(configured) };
}

export function modelChain(kind, env = process.env) {
  const primary = selectJarvisModel(kind, env).model;
  const chain = [];
  for (const model of [primary, ...(FALLBACKS[kind] ?? [])]) {
    if (isValidJarvisModel(model) && !chain.includes(model)) chain.push(model);
  }
  return chain;
}

export function spendCap(env = process.env) {
  if (env.JARVIS_DAILY_REQUEST_CAP == null || String(env.JARVIS_DAILY_REQUEST_CAP).trim() === "") {
    return { authorized: false, cap: 0, reason: "Set JARVIS_DAILY_REQUEST_CAP to an integer from 1 to 2000 before Jarvis calls a model." };
  }
  const cap = Number(env.JARVIS_DAILY_REQUEST_CAP);
  if (!Number.isInteger(cap) || cap < 1 || cap > 2000) {
    return { authorized: false, cap: 0, reason: "JARVIS_DAILY_REQUEST_CAP must be an integer from 1 to 2000." };
  }
  return { authorized: true, cap, reason: "" };
}

export function riskFor(text) {
  const value = String(text ?? "");
  if (/\b(payment|bank|banking|charge|purchase|buy|ads|advertising|ad spend|spend|deploy|production|customer data|password|secret|bulk outreach|send email|send the email|text customer)\b/i.test(value)) return "high";
  if (/\b(code|coding|website build|marketing|pricing|sales|booking|pull request|commit|publish)\b/i.test(value)) return "medium";
  return "low";
}
