import assert from "node:assert/strict";
import { classifyJarvisTask, selectJarvisModel } from "../lib/jarvis/modelRouting.ts";

const env = {
  JARVIS_CODING_MODEL: "anthropic/claude-sonnet-4",
  JARVIS_BUSINESS_MODEL: "openai/gpt-4o",
  JARVIS_RESEARCH_MODEL: "google/gemini-2.5-pro",
  JARVIS_ROUTINE_MODEL: "openai/gpt-4o-mini",
};
for (const [prompt, kind, model] of [
  ["Fix the TypeScript bug", "coding", env.JARVIS_CODING_MODEL],
  ["Improve subscription conversion", "business", env.JARVIS_BUSINESS_MODEL],
  ["Research and compare sources", "research", env.JARVIS_RESEARCH_MODEL],
  ["Give me a status update", "routine", env.JARVIS_ROUTINE_MODEL],
]) {
  assert.equal(classifyJarvisTask(prompt), kind, prompt);
  assert.deepEqual(selectJarvisModel(kind, env), { kind, model, configured: true });
}
assert.equal(selectJarvisModel("routine", { JARVIS_CHAT_MODEL: "openai/gpt-4o-mini" }).configured, false);
assert.throws(() => selectJarvisModel("coding", { JARVIS_CODING_MODEL: "invalid model" }), /Invalid Jarvis model/);
console.log("Jarvis model routing passed: Anthropic, OpenAI, Gemini selection; fallback and invalid-ID rejection.");
