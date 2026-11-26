import assert from "node:assert/strict";
import test from "node:test";
import { think } from "../lib/brain.mjs";
import { classifyJarvisTask, estimateSpendCents, modelChain, selectJarvisModel, spendCap } from "../lib/routing.mjs";

const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

test("model routing selects providers and rejects an unauthorized spend cap", () => {
  const routed = {
    JARVIS_CODING_MODEL: "anthropic/claude-sonnet-4",
    JARVIS_RESEARCH_MODEL: "google/gemini-2.5-pro",
    JARVIS_ROUTINE_MODEL: "openai/gpt-4o-mini",
  };
  assert.equal(classifyJarvisTask("Fix the TypeScript bug"), "coding");
  assert.equal(classifyJarvisTask("Research and compare sources"), "research");
  assert.equal(selectJarvisModel("coding", routed).model, "anthropic/claude-sonnet-4");
  assert.equal(modelChain("research", routed)[0], "google/gemini-2.5-pro");
  assert.equal(modelChain("routine", {}).at(-1) !== "", true);
  assert.equal(spendCap({}).authorized, false);
  assert.equal(spendCap({ JARVIS_DAILY_REQUEST_CAP: "0" }).authorized, false);
  assert.throws(() => selectJarvisModel("coding", { JARVIS_CODING_MODEL: "not a model" }), /Invalid Jarvis model/);
});

test("chat refuses invented revenue and does not call a provider without a cap", async () => {
  let called = false;
  const result = await think({
    text: "What is Buxme revenue this month?",
    state: { tasks: [], messages: [], usage: { day, requests: 0, errors: [], byModel: {} } },
    env: { AI_GATEWAY_API_KEY: "test-key", JARVIS_DAILY_REQUEST_CAP: "0" },
    fetchImpl: async () => { called = true; throw new Error("should not spend"); },
    now: new Date(),
  });
  assert.equal(called, false);
  assert.match(result.reply, /not connected/i);
  assert.equal(result.reply.includes("$"), false);
});

test("provider errors fall back and are recorded", async () => {
  const calls = [];
  const result = await think({
    text: "Give me a status update",
    state: { tasks: [], messages: [], usage: { day, requests: 0, promptTokens: 0, completionTokens: 0, errors: [], byModel: {} } },
    env: { AI_GATEWAY_API_KEY: "test-key", JARVIS_DAILY_REQUEST_CAP: "3", JARVIS_ROUTINE_MODEL: "openai/gpt-4o-mini" },
    now: new Date(),
    fetchImpl: async (_url, options) => {
      const model = JSON.parse(options.body).model;
      calls.push(model);
      if (calls.length === 1) return { ok: false, status: 503, statusText: "unavailable", json: async () => ({ error: { message: "busy" } }) };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Queue is quiet." } }], usage: { prompt_tokens: 4, completion_tokens: 3 } }) };
    },
  });
  assert.equal(result.provider, "gateway");
  assert.equal(result.reply, "Queue is quiet.");
  assert.equal(calls.length, 2);
  assert.equal(result.usage.errors.length, 1);
  assert.equal(result.usage.byModel[calls[0]].errors, 1);
  assert.equal(result.usage.spendCents, 1);
});

test("the five dollar ceiling stops the next model call", async () => {
  let called = false;
  const blocked = await think({
    text: "Give me a status update",
    state: { tasks: [], messages: [], usage: { day, requests: 1, spendCents: 480, errors: [], byModel: {} } },
    env: { AI_GATEWAY_API_KEY: "test-key", JARVIS_DAILY_REQUEST_CAP: "20" },
    fetchImpl: async () => { called = true; throw new Error("should not spend"); },
    now: new Date(),
  });
  assert.equal(called, false);
  assert.match(blocked.reply, /\$5 daily spending ceiling/);
  assert.equal(estimateSpendCents({ prompt: 4, completion: 3 }), 1);
  assert.equal(estimateSpendCents({ prompt: 0, completion: 0 }), 1);
});
