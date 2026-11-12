/** Deterministic, configurable model routing. No new credentials or spending. */
export type JarvisTaskKind = "coding" | "business" | "research" | "routine";
export function classifyJarvisTask(message: string): JarvisTaskKind {
  const s = message.toLowerCase();
  if (/\b(code|coding|debug|bug|typescript|refactor|pull request|repository|compile)\b/.test(s)) return "coding";
  if (/\b(research|compare sources|summarize documents|large document|market research)\b/.test(s)) return "research";
  if (/\b(revenue|profit|conversion|pricing|marketing|business|subscription|budget|financial|strategy)\b/.test(s)) return "business";
  return "routine";
}
export function selectJarvisModel(kind: JarvisTaskKind, env: Record<string, string | undefined> = process.env) {
  const keys: Record<JarvisTaskKind, string> = {
    coding: "JARVIS_CODING_MODEL",
    business: "JARVIS_BUSINESS_MODEL",
    research: "JARVIS_RESEARCH_MODEL",
    routine: "JARVIS_ROUTINE_MODEL",
  };
  const configured = env[keys[kind]]?.trim();
  const fallback = env.JARVIS_CHAT_MODEL?.trim() || "openai/gpt-4o-mini";
  const model = configured || fallback;
  if (!/^[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(model)) throw new Error("Invalid Jarvis model identifier");
  return { kind, model, configured: Boolean(configured) };
}
