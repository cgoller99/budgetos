import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { think } from "../lib/brain.mjs";
import { commitApprovedSandbox } from "../lib/gitGate.mjs";
import { readBusinessInventory } from "../lib/inventory.mjs";
import { classifyJarvisTask, modelChain, selectJarvisModel, spendCap } from "../lib/routing.mjs";
import { createLimiter } from "../lib/limits.mjs";
import { startServer } from "../server.mjs";

const exec = promisify(execFile);
const password = "correct-horse";
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

function env(extra = {}) {
  return { JARVIS_OWNER_PASSWORD: password, ...extra };
}
function request(path, { method = "GET", body, cookie, origin = "http://127.0.0.1", ip = "203.0.113.10" } = {}) {
  const headers = { "content-type": "application/json", host: "127.0.0.1", origin, "x-jarvis-ip": ip };
  if (method !== "GET") headers["x-jarvis-client"] = "dashboard";
  if (cookie) headers.cookie = cookie;
  return new Request(`http://127.0.0.1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
async function read(response) {
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}
async function signIn(app) {
  const response = await read(await app.handle(request("/api/session", { method: "POST", body: { password } })));
  assert.equal(response.status, 200);
  return response.cookie;
}

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
});

test("chat and an approved task use the routed model when spending is authorized", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-model-"));
  const calls = [];
  const app = createApp({
    dataDir,
    env: env({
      AI_GATEWAY_API_KEY: "test-key",
      JARVIS_DAILY_REQUEST_CAP: "4",
      JARVIS_CODING_MODEL: "anthropic/claude-sonnet-4",
      JARVIS_ROUTINE_MODEL: "openai/gpt-4o-mini",
    }),
    fetchImpl: async (_url, options) => {
      const model = JSON.parse(options.body).model;
      calls.push(model);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: `Answer from ${model}.` } }], usage: { prompt_tokens: 2, completion_tokens: 2 } }) };
    },
  });
  const cookie = await signIn(app);
  const chat = await read(await app.handle(request("/api/chat", { method: "POST", cookie, body: { text: "What should I do next?" } })));
  assert.equal(chat.status, 200);
  assert.equal(chat.body.connected, true);
  assert.equal(chat.body.provider, "gateway");
  assert.equal(chat.body.model, "openai/gpt-4o-mini");
  assert.equal(chat.body.messages.at(-1).model, "openai/gpt-4o-mini");
  assert.match(chat.body.reply, /Answer from openai\/gpt-4o-mini/);
  const created = await read(await app.handle(request("/api/tasks", { method: "POST", cookie, body: { title: "Fix the TypeScript bug in the header", detail: "The header overlaps the menu.", business: "buxme" } })));
  await app.handle(request(`/api/tasks/${created.body.task.id}/review`, { method: "POST", cookie, body: { decision: "approved" } }));
  await app.handle(request("/api/worker/run", { method: "POST", cookie, body: {} }));
  const task = (await read(await app.handle(request("/api/tasks", { cookie })))).body.tasks.find(item => item.id === created.body.task.id);
  assert.equal(task.status, "completed");
  assert.equal(task.result.source, "gateway");
  assert.match(task.result.text, /anthropic\/claude-sonnet-4/);
  assert.match(task.result.text, /was not sent/i);
  assert.deepEqual(task.externalSideEffects, []);
  assert.equal(calls.includes("anthropic/claude-sonnet-4"), true);
  const status = await read(await app.handle(request("/api/status", { cookie })));
  assert.equal(status.body.connection.connected, true);
  assert.equal(status.body.counts.completed >= 1, true);
});

test("authentication, voice turn, tasks, and approval gates", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-app-"));
  const app = createApp({ dataDir, env: env({ JARVIS_LOGIN_LIMIT: "4" }) });
  assert.equal((await read(await app.handle(request("/api/chat", { method: "POST", body: { text: "Hello" } })))).status, 401);
  const health = await read(await app.handle(request("/api/health")));
  assert.equal(health.body.product, "jarvis");
  assert.equal(JSON.stringify(health.body).includes("correct-horse"), false);
  assert.equal((await read(await app.handle(request("/api/session", { method: "POST", body: { password }, origin: "https://evil.example" })))).status, 403);
  assert.equal((await read(await app.handle(request("/api/session", { method: "POST", body: { password: "wrong-password" } })))).status, 401);
  const cookie = await signIn(app);
  const voice = await read(await app.handle(request("/api/voice/turn", { method: "POST", cookie, body: { transcript: "What is Buxme revenue?" } })));
  assert.equal(voice.status, 200);
  assert.equal(voice.body.connected, false);
  assert.equal(voice.body.source, "unavailable");
  assert.match(voice.body.reply, /not connected/i);
  assert.match(voice.body.error, /AI_GATEWAY_API_KEY|spending cap|JARVIS_DAILY_REQUEST_CAP/i);
  assert.equal(voice.body.speak.engine, "browser");
  assert.equal(voice.body.messages.length, 2);
  assert.equal(voice.body.messages.at(-1).source, "unavailable");
  const created = await read(await app.handle(request("/api/chat", { method: "POST", cookie, body: { text: "create task Draft the spring listing" } })));
  assert.match(created.body.reply, /have not started/i);
  await app.handle(request("/api/worker/run", { method: "POST", cookie, body: {} }));
  const before = await read(await app.handle(request("/api/tasks", { cookie })));
  const task = before.body.tasks.find(item => item.title === "Draft the spring listing");
  assert.equal(task.status, "proposed");
  assert.equal((await read(await app.handle(request(`/api/tasks/${task.id}/review`, { method: "POST", cookie, body: { decision: "approved" } })))).body.performed, false);
  await app.handle(request("/api/worker/run", { method: "POST", cookie, body: {} }));
  const after = await read(await app.handle(request("/api/tasks", { cookie })));
  const done = after.body.tasks.find(item => item.id === task.id);
  assert.equal(done.status, "completed");
  assert.deepEqual(done.externalSideEffects, []);
  assert.match(done.result.text, /Nothing was sent/);
  const risky = await read(await app.handle(request("/api/tasks", { method: "POST", cookie, body: { title: "Purchase ads for DriveNest", business: "drivenest" } })));
  await app.handle(request(`/api/tasks/${risky.body.task.id}/review`, { method: "POST", cookie, body: { decision: "approved" } }));
  await app.handle(request("/api/worker/run", { method: "POST", cookie, body: {} }));
  const blocked = (await read(await app.handle(request("/api/tasks", { cookie })))).body.tasks.find(item => item.id === risky.body.task.id);
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.result.summary, /did not/i);
  const speech = await read(await app.handle(request("/api/speech", { method: "POST", cookie, body: { text: "Hello" } })));
  assert.equal(speech.status, 503);
  assert.equal(speech.body.fallback, "browser");
});

test("leads and drafts do not send, and suggestions invent no metrics", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-business-"));
  const app = createApp({ dataDir, env: env() });
  const cookie = await signIn(app);
  const lead = await read(await app.handle(request("/api/leads", { method: "POST", cookie, body: { business: "website-agency", name: "Northwind", url: "https://northwind.example", note: "Asked about a brochure site." } })));
  assert.equal(lead.status, 201);
  assert.equal(lead.body.sent, false);
  assert.equal((await read(await app.handle(request("/api/leads", { method: "POST", cookie, body: { business: "website-agency", name: "Bad", url: "javascript:alert(1)" } })))).status, 400);
  const draft = await read(await app.handle(request("/api/drafts", { method: "POST", cookie, body: { business: "website-agency", kind: "outreach", title: "Northwind note", notes: "They asked about a brochure site." } })));
  assert.match(draft.body.draft.body, /was not sent/);
  const approval = await read(await app.handle(request(`/api/drafts/${draft.body.draft.id}/approval`, { method: "POST", cookie, body: { action: "outreach" } })));
  assert.equal(approval.body.performed, false);
  const suggestions = await read(await app.handle(request("/api/suggestions", { method: "POST", cookie, body: {} })));
  assert.equal(JSON.stringify(suggestions.body).includes("$"), false);
  assert.match(JSON.stringify(suggestions.body), /Connect read-only Buxme metrics/);
});

test("interrupted work is recovered without repeating a finished claim", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-lease-"));
  const app = createApp({ dataDir, env: env() });
  const cookie = await signIn(app);
  await app.store.update(day, state => {
    state.tasks.push({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Draft a recovered note",
      detail: "Facts: the queue was interrupted.",
      business: "buxme",
      businessName: "Buxme",
      kind: "routine",
      risk: "low",
      priority: 3,
      status: "running",
      attempts: 3,
      model: { kind: "routine", model: "openai/gpt-4o-mini", configured: false },
      createdAt: new Date().toISOString(),
      claimExpiresAt: new Date(Date.now() - 5000).toISOString(),
      audit: [{ type: "approved", at: new Date().toISOString(), actor: "owner" }],
      externalSideEffects: [],
    });
  });
  await app.handle(request("/api/worker/run", { method: "POST", cookie, body: {} }));
  const task = (await read(await app.handle(request("/api/tasks", { cookie })))).body.tasks[0];
  assert.equal(task.status, "failed");
  assert.match(task.lastError, /interrupted/i);
  assert.equal(task.result, undefined);
});

test("repository inventory stays inside the root and skips secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-repo-"));
  await mkdir(join(root, "app"), { recursive: true });
  await writeFile(join(root, "app", "budget.ts"), "export const budget = 1;\n");
  await writeFile(join(root, ".env"), "SECRET=do-not-read\n");
  await writeFile(join(root, "app", "secrets.ts"), "export const token = 'hidden';\n");
  const inventory = await readBusinessInventory(root, "buxme");
  assert.equal(inventory.evidence.some(item => item.file.endsWith("budget.ts")), true);
  assert.equal(JSON.stringify(inventory).includes("do-not-read"), false);
  assert.equal(JSON.stringify(inventory).includes("secrets.ts"), false);
});

test("git execution is off by default and can commit only a marked sandbox", async () => {
  const calls = [];
  const disabled = await commitApprovedSandbox({
    repoDir: "/tmp/not-used",
    branch: "jarvis/disabled-test",
    message: "nope",
    files: ["note.txt"],
    allowGit: false,
    execFileImpl: async () => { calls.push("ran"); },
  });
  assert.equal(disabled.performed, false);
  assert.deepEqual(calls, []);
  const repo = await mkdtemp(join(tmpdir(), "jarvis-git-"));
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.email", "jarvis@example.invalid"], { cwd: repo });
  await exec("git", ["config", "user.name", "Jarvis Test"], { cwd: repo });
  await writeFile(join(repo, "README.md"), "sandbox\n");
  await exec("git", ["add", "README.md"], { cwd: repo });
  await exec("git", ["commit", "-qm", "init"], { cwd: repo });
  await writeFile(join(repo, ".jarvis-sandbox"), "dedicated-jarvis-sandbox\n");
  await writeFile(join(repo, "note.txt"), "prepared note\n");
  const committed = await commitApprovedSandbox({
    repoDir: repo,
    branch: "jarvis/sandbox-note",
    message: "Prepare sandbox note",
    files: ["note.txt"],
    allowGit: true,
  });
  assert.equal(committed.performed, true);
  assert.equal(committed.pushed, false);
  assert.equal(committed.pullRequest, false);
  const log = await exec("git", ["-C", repo, "log", "--oneline"]);
  assert.match(log.stdout, /Prepare sandbox note/);
  const child = join(repo, "nested");
  await mkdir(child);
  await writeFile(join(child, ".jarvis-sandbox"), "dedicated-jarvis-sandbox\n");
  await writeFile(join(child, "note.txt"), "nested\n");
  const nested = await commitApprovedSandbox({ repoDir: child, branch: "jarvis/nested-note", message: "Do not use parent", files: ["note.txt"], allowGit: true });
  assert.equal(nested.performed, false);
  assert.match(nested.reason, /parent git repository/);
});

test("shared limiter uses configured Redis without dropping the local limit", async () => {
  const seen = [];
  const limiter = createLimiter({
    fetchImpl: async url => {
      seen.push(url);
      return { ok: true, json: async () => ({ result: seen.filter(item => item.includes("/incr/")).length }) };
    },
  });
  const env = { UPSTASH_REDIS_REST_URL: "https://example.invalid", UPSTASH_REDIS_REST_TOKEN: "token" };
  assert.equal((await limiter.allow({ key: "login:1", limit: 1, windowMs: 1000, env })).allowed, true);
  assert.equal((await limiter.allow({ key: "login:1", limit: 1, windowMs: 1000, env })).allowed, false);
  assert.equal(seen.some(url => url.startsWith("https://example.invalid/incr/")), true);
});

test("approval gates change what the worker may prepare", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-gates-"));
  const app = createApp({ dataDir, env: env() });
  const cookie = await signIn(app);
  await app.handle(request("/api/settings", { method: "POST", cookie, body: { gates: { publish: false, bulkOutreach: true, advertising: true, purchases: true, accountChanges: true, deploy: true, codePush: true } } }));
  const created = await read(await app.handle(request("/api/tasks", { method: "POST", cookie, body: { title: "Publish the spring note", detail: "Facts: spring hours are 9 to 5.", business: "website-agency" } })));
  await app.handle(request("/api/worker/run", { method: "POST", cookie, body: {} }));
  const task = (await read(await app.handle(request("/api/tasks", { cookie })))).body.tasks.find(item => item.id === created.body.task.id);
  assert.equal(task.status, "completed");
  assert.deepEqual(task.externalSideEffects, []);
  assert.match(task.result.text, /was not sent|Nothing was sent|not sent/i);
});

test("configured Redis keeps the conversation after a new process starts", async () => {
  const db = new Map();
  const fetchImpl = async (url, options) => {
    assert.equal(String(url).includes("token"), false);
    if (!options.body) return { ok: true, json: async () => ({ result: 1 }) };
    const args = JSON.parse(options.body);
    const [command, key, value] = args;
    assert.equal(url, "https://redis.example.invalid");
    if (command === "SET" && args[3] === "NX") {
      if (db.has(key)) return { ok: true, json: async () => ({ result: null }) };
      db.set(key, value);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    if (command === "GET") return { ok: true, json: async () => ({ result: db.has(key) ? db.get(key) : null }) };
    if (command === "DEL") {
      db.delete(key);
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    if (command === "SET") {
      db.set(key, value);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    return { ok: false, status: 500, json: async () => ({ error: "unexpected" }) };
  };
  const shared = { UPSTASH_REDIS_REST_URL: "https://redis.example.invalid", UPSTASH_REDIS_REST_TOKEN: "token" };
  const first = createApp({ env: env(shared), fetchImpl });
  const cookie = await signIn(first);
  const sent = await read(await first.handle(request("/api/chat", { method: "POST", cookie, body: { text: "Remember the blue notebook" } })));
  assert.equal(sent.status, 200);
  assert.equal((await read(await first.handle(request("/api/health")))).body.persistence, "redis");
  const second = createApp({ env: env(shared), fetchImpl });
  const again = await signIn(second);
  const history = await read(await second.handle(request("/api/chat", { cookie: again })));
  assert.match(JSON.stringify(history.body.messages), /Remember the blue notebook/);
  const services = await read(await second.handle(request("/api/services", { cookie: again })));
  assert.equal(services.body.services.persistence.mode, "redis");
  assert.equal(JSON.stringify(services.body).includes("redis.example"), false);
  assert.equal(JSON.stringify(services.body).includes("Bearer"), false);
  const task = await read(await second.handle(request("/api/tasks", { method: "POST", cookie: again, body: { title: "Keep the approved note", business: "buxme" } })));
  await second.handle(request(`/api/tasks/${task.body.task.id}/review`, { method: "POST", cookie: again, body: { decision: "approved" } }));
  const third = createApp({ env: env(shared), fetchImpl });
  const kept = await read(await third.handle(request("/api/tasks", { cookie: await signIn(third) })));
  assert.equal(kept.body.tasks.find(item => item.id === task.body.task.id).status, "approved");
});

test("static files cannot escape the public directory", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-static-"));
  const app = createApp({ dataDir, env: env() });
  const escaped = await app.handle(request("/../package.json"));
  assert.equal(escaped.status, 404);
});

test("the dashboard is served with a mobile viewport and the voice pipeline", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "jarvis-http-"));
  const server = await startServer({ port: 0, host: "127.0.0.1", dataDir, env: env() });
  try {
    const html = await (await fetch(`${server.url}/`)).text();
    assert.match(html, /viewport/);
    assert.match(html, /app\.js/);
    const script = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(script, /function handleTranscript/);
    assert.match(script, /SpeechRecognition/);
    assert.match(script, /getUserMedia/);
    assert.match(script, /speechSynthesis/);
    assert.match(script, /Interrupt/);
    assert.match(script, /source === "gateway"/);
    assert.match(script, /setInterval/);
    const css = await (await fetch(`${server.url}/app.css`)).text();
    assert.match(css, /100dvh/);
    assert.match(css, /safe-area-inset-bottom/);
  } finally {
    await server.close();
  }
});
