import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  authConfigured,
  clearCookie,
  clientHeaderOk,
  issueSession,
  originAllowed,
  passwordsMatch,
  readSession,
  sessionCookie,
  sessionSecret,
} from "./auth.mjs";
import { commandFrom, connectionFor, think } from "./brain.mjs";
import { connectionChecklist, recoverCheck, saveBrief, saveFollowUp, saveOffer, saveProspect, saveSupplier } from "./close.mjs";
import { inboxConnection, pickupDelay, pullAgencyInbox } from "./inbox.mjs";
import { answerFromRecords, businessDesk, briefing, ingestAgencyReply, recordOperatorRun, rememberSkip } from "./operator.mjs";
import { previewDocument, previewForToken, sharePreview } from "./preview.mjs";
import { modelChain, spendCap, spendCeiling } from "./routing.mjs";
import { createRedisStore } from "./redisStore.mjs";
import { BUSINESSES, createStore, defaultGates } from "./store.mjs";
import { createLimiter } from "./limits.mjs";
import { commitApprovedSandbox } from "./gitGate.mjs";
import { beginWorker, createTask, finishWorker, produceTaskResult, reviewTask, suggestTasks } from "./worker.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

function dayKey(now) {
  return DAY.format(now);
}

function modelRoutes(env) {
  const routes = {};
  for (const kind of ["routine", "coding", "research", "business"]) {
    try { routes[kind] = modelChain(kind, env); }
    catch { routes[kind] = []; }
  }
  return routes;
}

function redisConfigured(env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim());
}

function speechEngine(env) {
  const cap = spendCap(env);
  return env.JARVIS_ENABLE_NEURAL_SPEECH === "1" && env.AI_GATEWAY_API_KEY?.trim() && cap.authorized ? "neural" : "browser";
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extra,
    },
  });
}

function services(env) {
  const cap = spendCap(env);
  return {
    aiGateway: {
      configured: Boolean(env.AI_GATEWAY_API_KEY?.trim()),
      spendAuthorized: cap.authorized,
      connected: Boolean(env.AI_GATEWAY_API_KEY?.trim()) && cap.authorized,
      spendNote: cap.authorized ? `Up to ${cap.cap} model requests per day.` : cap.reason,
      routes: modelRoutes(env),
      requiredEnv: ["AI_GATEWAY_API_KEY", "JARVIS_DAILY_REQUEST_CAP"],
    },
    redis: {
      configured: Boolean(env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim()),
      requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      note: "Used only when it already exists. Jarvis does not create a database.",
    },
    github: {
      configured: Boolean(env.GITHUB_TOKEN?.trim() || env.GH_TOKEN?.trim()),
      requiredEnv: ["GITHUB_TOKEN"],
      note: "Presence of a token is not a pull request. Nothing is pushed from this screen.",
    },
    speech: {
      browser: true,
      neural: Boolean(env.AI_GATEWAY_API_KEY?.trim() && cap.authorized && env.JARVIS_ENABLE_NEURAL_SPEECH === "1"),
      note: "Device speech works without a provider. Neural speech also requires JARVIS_ENABLE_NEURAL_SPEECH=1 and a daily request cap.",
    },
    repository: {
      configured: Boolean(env.JARVIS_REPO_ROOT?.trim()),
      requiredEnv: ["JARVIS_REPO_ROOT"],
      note: "Read-only file search. Buxme production is not modified.",
    },
    buxmeMetrics: {
      configured: false,
      requiredEnv: [],
      note: "No Buxme production metric connector is configured. Counts shown elsewhere are records in this Jarvis app.",
    },
    drivenestStore: {
      configured: false,
      requiredEnv: [],
      note: "DriveNest store performance is not connected. Jarvis will not invent sales.",
    },
    git: {
      localCommit: env.JARVIS_ALLOW_GIT === "1",
      push: env.JARVIS_ALLOW_GIT_PUSH === "1",
      pullRequest: env.JARVIS_ALLOW_PULL_REQUEST === "1",
      sandbox: Boolean(env.JARVIS_SANDBOX_REPO?.trim()),
      note: "Git runs only in a repository whose toplevel is JARVIS_SANDBOX_REPO, and only after confirmation.",
    },
    auth: { configured: authConfigured(env), requiredEnv: ["JARVIS_OWNER_PASSWORD", "JARVIS_SESSION_SECRET"] },
    inbox: { ...inboxConnection(env), ...pickupDelay(new Date()), requiredEnv: ["RESEND_API_KEY", "JARVIS_AGENCY_INBOX"] },
    phone: {
      configured: connectionChecklist(env).phone.configured,
      requiredEnv: connectionChecklist(env).phone.requiredEnv,
      note: connectionChecklist(env).phone.unlocks,
    },
    spendCeiling: (() => {
      const ceiling = spendCeiling(env);
      return { cents: ceiling.cents, ok: ceiling.ok, note: ceiling.ok ? `Model spend stops at $${ceiling.cents / 100} per day.` : ceiling.reason };
    })(),
    persistence: redisConfigured(env)
      ? { mode: "redis", configured: true, requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"], note: "Conversations, tasks, approvals, and logs are stored in the existing Redis database and survive a restart." }
      : { mode: "file", configured: false, requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"], note: "This server stores data on local disk. A serverless deploy loses that disk on restart until an existing Upstash Redis database is configured. Jarvis does not create a database." },
  };
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  if (text.length > 1_000_000) throw Object.assign(new Error("Request is too large."), { status: 413 });
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid JSON");
    return body;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

export function createApp(options = {}) {
  const env = options.env ?? process.env;
  const dataDir = options.dataDir ?? env.JARVIS_DATA_DIR ?? join(root, "data");
  const nowFn = options.now ?? (() => Date.now());
  const fetchImpl = options.fetchImpl ?? fetch;
  const store = options.store ?? (redisConfigured(env)
    ? createRedisStore({ url: env.UPSTASH_REDIS_REST_URL.trim(), token: env.UPSTASH_REDIS_REST_TOKEN.trim(), fetchImpl })
    : createStore(dataDir));
  const limiter = options.limiter ?? createLimiter({ fetchImpl, now: nowFn });
  const execFileImpl = options.execFileImpl;
  let failOnce = options.failOnce ?? null;

  function secure(request) {
    return request.url.startsWith("https:") || env.VERCEL === "1";
  }

  function session(request) {
    const password = env.JARVIS_OWNER_PASSWORD?.trim() ?? "";
    const secret = sessionSecret(env, password);
    return readSession(request.headers.get("cookie"), secret, nowFn());
  }

  function actorFor(request, access) {
    if (access?.buxme === "required") {
      return typeof access.userId === "string" && access.userId ? { role: "owner", userId: access.userId, source: "buxme" } : null;
    }
    return session(request);
  }

  async function guard(request, { auth = true, mutate = false, bucket = "api", limit = 60, windowMs = 60_000, access = null } = {}) {
    if (mutate && (!originAllowed(request) || !clientHeaderOk(request))) {
      return json({ error: "This action must come from the Jarvis dashboard." }, 403);
    }
    const decision = await limiter.allow({
      key: `${bucket}:${request.headers.get("x-jarvis-ip") || "local"}`,
      limit: Number(env[`JARVIS_${bucket.toUpperCase()}_LIMIT`] ?? limit),
      windowMs,
      env,
    });
    if (!decision.allowed) return json({ error: "Too many requests. Wait and try again." }, 429);
    if (auth && !actorFor(request, access)) return json({ error: "Sign in to Jarvis first." }, 401);
    return null;
  }

  function remember(state, content, meta) {
    state.messages.push({
      id: randomUUID(),
      role: "assistant",
      content,
      at: new Date(nowFn()).toISOString(),
      source: meta.source,
      provider: meta.provider ?? "",
      model: meta.model ?? "",
      kind: meta.kind ?? "",
      error: meta.error ?? "",
      attempted: meta.attempted ?? [],
    });
    if (state.messages.length > 80) state.messages.splice(0, state.messages.length - 80);
  }

  async function executeWorker() {
    const day = dayKey(new Date(nowFn()));
    let begun = { claimed: [], ownedLock: false, skipped: [], blocked: [], recovered: [] };
    await store.update(day, state => {
      begun = beginWorker(state, { env, now: nowFn });
    });
    const outcomes = [];
    let usage = (await store.read(day)).usage;
    for (const task of begun.claimed) {
      try {
        if (failOnce === `${task.id}:${task.attempts}`) throw new Error("Injected failure before completion.");
        const produced = await produceTaskResult(task, {
          env,
          repoRoot: env.JARVIS_REPO_ROOT,
          dataDir,
          fetchImpl,
          usage,
          now: new Date(nowFn()),
        });
        if (produced.usage) usage = produced.usage;
        outcomes.push({ id: task.id, ok: true, result: produced.result, model: produced.model, usage: produced.usage });
      } catch (error) {
        if (error.usage) usage = error.usage;
        outcomes.push({ id: task.id, ok: false, error: String(error.message ?? error).slice(0, 300), usage: error.usage });
      }
    }
    failOnce = null;
    let finished = { completed: [], failed: [] };
    await store.update(day, current => {
      finished = finishWorker(current, outcomes, { now: nowFn, ownedLock: begun.ownedLock });
      if (usage) current.usage = usage;
    });
    return { ...finished, blocked: begun.blocked, recovered: begun.recovered, skipped: begun.skipped };
  }

  async function converse(state, text) {
    const clean = String(text ?? "").trim();
    if (!clean || clean.length > 2000) throw Object.assign(new Error("Message must be 1 to 2000 characters."), { status: 400 });
    state.messages.push({ id: randomUUID(), role: "user", content: clean, at: new Date(nowFn()).toISOString() });
    const command = commandFrom(clean);
    if (command?.type === "worker") throw Object.assign(new Error("Run the worker from the worker route."), { status: 400 });
    if (command?.type === "task") {
      const task = createTask(state, { title: command.title }, env);
      remember(state, `I saved “${task.title}” as proposal ${task.id}. I have not started it. Approve it before I work on it.`, { source: "queue" });
    } else if (command?.type === "approve" || command?.type === "reject") {
      const task = reviewTask(state, command.id, command.type === "approve" ? "approved" : "rejected");
      const reply = command.type === "approve"
        ? `Approved ${task.id}. I still have not executed it. Say “run worker” when you want the next safe step.`
        : `Rejected ${task.id}. Nothing was executed.`;
      remember(state, reply, { source: "queue" });
    } else {
      const recorded = answerFromRecords(clean, state, new Date(nowFn()));
      if (recorded) {
        remember(state, recorded, { source: "records" });
        return state.messages.at(-1);
      }
      const thought = await think({ text: clean, state, env, fetchImpl, now: new Date(nowFn()) });
      state.usage = thought.usage;
      remember(state, thought.reply, {
        source: thought.source,
        provider: thought.provider,
        model: thought.model,
        kind: thought.kind,
        error: thought.error ?? "",
        attempted: thought.attempted,
      });
    }
    return state.messages.at(-1);
  }

  function spoken(messages) {
    const last = messages.at(-1) ?? {};
    return {
      reply: last.content ?? "",
      provider: last.provider ?? "",
      model: last.model ?? "",
      kind: last.kind ?? "",
      source: last.source ?? "",
      error: last.error || null,
      attempted: last.attempted ?? [],
      connected: last.source === "gateway",
      messages,
      speak: { text: last.content ?? "", engine: speechEngine(env) },
    };
  }

  /**
   * @param {Request} request
   * @param {{ buxme?: string, userId?: string } | null} [access]
   */
  async function handle(request, access = null) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const buxme = access?.buxme === "required";
    function visibleServices() {
      const body = services(env);
      if (buxme && access.userId) body.auth = { configured: true, source: "buxme", requiredEnv: [] };
      return body;
    }
    try {
      if (typeof access?.shareToken === "string") {
        const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Not found.", { status: 404, headers });
        if (path !== `/share/${access.shareToken}`) return new Response("Not found.", { status: 404, headers });
        const sharedState = await store.read(dayKey(new Date(nowFn())));
        const shared = previewForToken(sharedState.previews, access.shareToken);
        if (!shared) return new Response("That preview is not available.", { status: 404, headers });
        return new Response(request.method === "HEAD" ? null : previewDocument(shared), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
          },
        });
      }
      if (path === "/api/health" && request.method === "GET") {
        return json({
          ok: true,
          product: "jarvis",
          separateFrom: "buxme",
          time: new Date(nowFn()).toISOString(),
          authConfigured: authConfigured(env),
          persistence: store.mode,
        });
      }
      if (path === "/api/session" && request.method === "GET") {
        return json({ authenticated: Boolean(actorFor(request, access)), product: "jarvis", buxme });
      }
      if (path === "/api/session" && request.method === "POST") {
        const blocked = await guard(request, { auth: false, mutate: true, bucket: "login", limit: 8, windowMs: 15 * 60_000, access });
        if (blocked) return blocked;
        if (buxme) return json({ error: "Jarvis uses your Buxme admin session." }, 403);
        if (!authConfigured(env)) {
          return json({ error: "Set JARVIS_OWNER_PASSWORD to at least 10 characters, and JARVIS_SESSION_SECRET to at least 16 characters in production." }, 503);
        }
        const body = await readJson(request);
        const password = String(body.password ?? "");
        if (!passwordsMatch(password, env.JARVIS_OWNER_PASSWORD.trim())) return json({ error: "Incorrect password." }, 401);
        const secret = sessionSecret(env, password);
        if (!secret) return json({ error: "Set JARVIS_SESSION_SECRET to at least 16 characters before production sign-in." }, 503);
        return json({ authenticated: true }, 200, { "Set-Cookie": sessionCookie(issueSession(secret, nowFn()), secure(request)) });
      }
      if (path === "/api/session" && request.method === "DELETE") {
        const blocked = await guard(request, { auth: false, mutate: true, bucket: "login", limit: 20, windowMs: 60_000, access });
        if (blocked) return blocked;
        if (buxme) return json({ authenticated: Boolean(actorFor(request, access)), buxme: true });
        return json({ authenticated: false }, 200, { "Set-Cookie": clearCookie(secure(request)) });
      }
      const previewPath = path.match(/^\/preview\/([0-9a-f-]{36})$/);
      if (previewPath && (request.method === "GET" || request.method === "HEAD")) {
        if (!actorFor(request, access)) return new Response("Sign in to Buxme first.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
        const current = await store.read(dayKey(new Date(nowFn())));
        const preview = (current.previews ?? []).find(item => item.id === previewPath[1]);
        if (!preview) return new Response("That preview is not on this server.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
        return new Response(request.method === "HEAD" ? null : previewDocument(preview), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
          },
        });
      }
      if (!path.startsWith("/api/")) return serveStatic(path);

      const read = request.method === "GET" || request.method === "HEAD";
      const blocked = await guard(request, { mutate: !read, bucket: read ? "read" : "write", limit: read ? 300 : 60, access });
      if (blocked) return blocked;
      if (request.method === "GET" && path === "/api/services") return json({ services: visibleServices() });
      if (request.method === "GET" && path === "/api/status") {
        const state = await store.read(dayKey(new Date(nowFn())));
        return json({
          services: visibleServices(),
          counts: {
            tasks: state.tasks.length,
            proposed: state.tasks.filter(task => task.status === "proposed").length,
            approved: state.tasks.filter(task => task.status === "approved").length,
            running: state.tasks.filter(task => task.status === "running").length,
            completed: state.tasks.filter(task => task.status === "completed").length,
            failed: state.tasks.filter(task => task.status === "failed").length,
            blocked: state.tasks.filter(task => task.status === "blocked").length,
            rejected: state.tasks.filter(task => task.status === "rejected").length,
            leads: state.leads.length,
            drafts: state.drafts.length,
            messages: state.messages.length,
          },
          connection: connectionFor(env, state.usage, new Date(nowFn())),
          usage: state.usage,
          gates: state.settings.gates,
          lastError: state.usage?.errors?.at(-1) ?? null,
        });
      }
      if (request.method === "GET" && path === "/api/chat") {
        const state = await store.read(dayKey(new Date(nowFn())));
        return json({ messages: state.messages, connection: connectionFor(env, state.usage, new Date(nowFn())) });
      }
      if (request.method === "POST" && (path === "/api/chat" || path === "/api/voice/turn")) {
        const body = await readJson(request);
        const text = path === "/api/voice/turn" ? body.transcript : body.text;
        const clean = String(text ?? "").trim();
        if (commandFrom(clean)?.type === "worker") {
          if (!clean || clean.length > 2000) return json({ error: "Message must be 1 to 2000 characters." }, 400);
          await store.update(dayKey(new Date(nowFn())), state => {
            state.messages.push({ id: randomUUID(), role: "user", content: clean, at: new Date(nowFn()).toISOString() });
          });
          const report = await executeWorker();
          const reply = `Worker finished. Completed ${report.completed.length}, blocked ${report.blocked.length}, failed ${report.failed.length}. No external account was changed.`;
          const result = await store.update(dayKey(new Date(nowFn())), state => {
            remember(state, reply, { source: "queue" });
          });
          return json(spoken(result.messages));
        }
        const result = await store.update(dayKey(new Date(nowFn())), state => converse(state, text));
        return json(spoken(result.messages));
      }
      if (request.method === "POST" && path === "/api/speech") {
        const cap = spendCap(env);
        const enabled = env.JARVIS_ENABLE_NEURAL_SPEECH === "1" && Boolean(env.AI_GATEWAY_API_KEY?.trim()) && cap.authorized;
        if (!enabled) {
          return json({ error: "Neural voice is off. Set AI_GATEWAY_API_KEY, JARVIS_DAILY_REQUEST_CAP, and JARVIS_ENABLE_NEURAL_SPEECH=1. This device can still speak the reply.", fallback: "browser" }, 503);
        }
        const body = await readJson(request);
        const transcript = String(body.text ?? "").trim();
        if (!transcript || transcript.length > 2400) return json({ error: "Speech text must be 1 to 2400 characters.", fallback: "browser" }, 400);
        const state = await store.read(dayKey(new Date(nowFn())));
        const usage = state.usage?.day === dayKey(new Date(nowFn())) ? state.usage : { day: dayKey(new Date(nowFn())), requests: 0, promptTokens: 0, completionTokens: 0, errors: [], byModel: {} };
        if (usage.requests >= cap.cap) return json({ error: "Daily model cap is used, so neural voice is paused. Device speech still works.", fallback: "browser" }, 429);
        const response = await fetchImpl("https://ai-gateway.vercel.sh/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.AI_GATEWAY_API_KEY.trim()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: env.JARVIS_SPEECH_MODEL?.trim() || "openai/gpt-4o-mini-tts", voice: "onyx", input: transcript, response_format: "mp3" }),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) return json({ error: "Neural voice did not answer. Device speech will be used.", fallback: "browser" }, 502);
        await store.update(dayKey(new Date(nowFn())), current => {
          current.usage = usage;
          current.usage.requests += 1;
        });
        return new Response(await response.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
      }
      if (request.method === "GET" && path === "/api/tasks") {
        const state = await store.read(dayKey(new Date(nowFn())));
        return json({ tasks: state.tasks });
      }
      if (request.method === "POST" && path === "/api/tasks") {
        const body = await readJson(request);
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          createTask(current, body, env);
        });
        return json({ task: state.tasks.at(-1) }, 201);
      }
      const retry = path.match(/^\/api\/tasks\/([0-9a-f-]{36})\/retry$/);
      if (retry && request.method === "POST") {
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          const task = current.tasks.find(item => item.id === retry[1]);
          if (!task || !["failed", "blocked"].includes(task.status)) throw Object.assign(new Error("Only a failed or blocked task can be retried."), { status: 400 });
          task.ownerRetries = (task.ownerRetries ?? 0) + 1;
          if (task.ownerRetries > 3) throw Object.assign(new Error("Retry limit reached for this task."), { status: 400 });
          task.status = "proposed";
          task.attempts = 0;
          task.audit.push({ type: "retry_requested", at: new Date(nowFn()).toISOString(), actor: "owner" });
        });
        return json({ task: state.tasks.find(item => item.id === retry[1]), performed: false });
      }
      const review = path.match(/^\/api\/tasks\/([0-9a-f-]{36})\/review$/);
      if (review && request.method === "POST") {
        const body = await readJson(request);
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          reviewTask(current, review[1], body.decision);
        });
        return json({ task: state.tasks.find(task => task.id === review[1]), performed: false });
      }
      if (request.method === "POST" && path === "/api/worker/run") {
        const report = await executeWorker();
        const state = await store.read(dayKey(new Date(nowFn())));
        return json({
          tasks: state.tasks,
          logs: state.logs.slice(-20),
          report,
          note: "The worker finished this pass. External publishing, spending, and deploys were not performed.",
        });
      }
      if (request.method === "POST" && path === "/api/suggestions") {
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          suggestTasks(current, env);
        });
        return json({ tasks: state.tasks.filter(task => task.status === "proposed") });
      }
      if (request.method === "GET" && path === "/api/logs") {
        const state = await store.read(dayKey(new Date(nowFn())));
        return json({ logs: state.logs.slice(-100) });
      }
      if (request.method === "GET" && path === "/api/desk") {
        const current = await store.read(dayKey(new Date(nowFn())));
        return json({ ...briefing(current, new Date(nowFn())), businesses: businessDesk(current), connection: connectionFor(env, current.usage, new Date(nowFn())) });
      }
      if (request.method === "GET" && path === "/api/businesses") {
        const state = await store.read(dayKey(new Date(nowFn())));
        return json({
          businesses: Object.values(BUSINESSES).map(business => ({
            ...business,
            metricsConnected: false,
            leads: state.leads.filter(lead => lead.business === business.id),
            drafts: state.drafts.filter(draft => draft.business === business.id),
          })),
        });
      }
      if (request.method === "POST" && path === "/api/leads") {
        const body = await readJson(request);
        const name = String(body.name ?? "").trim();
        const urlValue = safeUrl(body.url);
        if (!BUSINESSES[body.business]) return json({ error: "Unknown business." }, 400);
        if (name.length < 2 || name.length > 80 || /[\r\n]/.test(name)) return json({ error: "Lead name must be 2 to 80 characters." }, 400);
        if (body.url && !urlValue) return json({ error: "Lead URL must start with http:// or https://." }, 400);
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          if (current.leads.length >= 200) throw Object.assign(new Error("Lead list is full."), { status: 400 });
          current.leads.push({
            id: randomUUID(),
            business: body.business,
            name,
            url: urlValue || "",
            note: String(body.note ?? "").slice(0, 1000),
            stage: "new",
            createdAt: new Date(nowFn()).toISOString(),
          });
          current.logs.push({ id: randomUUID(), at: new Date(nowFn()).toISOString(), level: "info", message: `Recorded lead ${name}. No outreach was sent.`, taskId: null });
        });
        return json({ lead: state.leads.at(-1), sent: false }, 201);
      }
      const stage = path.match(/^\/api\/leads\/([0-9a-f-]{36})\/stage$/);
      if (stage && request.method === "POST") {
        const body = await readJson(request);
        if (!["new", "drafted", "responded", "closed"].includes(body.stage)) return json({ error: "Unknown stage." }, 400);
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          const lead = current.leads.find(item => item.id === stage[1]);
          if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
          lead.stage = body.stage;
          lead.stageRecordedAt = new Date(nowFn()).toISOString();
          current.logs.push({ id: randomUUID(), at: lead.stageRecordedAt, level: "info", message: `You recorded ${lead.name} as ${lead.stage}. Jarvis did not contact them.`, taskId: null });
        });
        return json({ lead: state.leads.find(item => item.id === stage[1]), contacted: false });
      }
      if (request.method === "POST" && path === "/api/drafts") {
        const body = await readJson(request);
        const notes = String(body.notes ?? "").trim();
        if (!BUSINESSES[body.business]) return json({ error: "Unknown business." }, 400);
        if (notes.length < 3) return json({ error: "Add the facts to include. Jarvis will not invent them." }, 400);
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          current.drafts.push({
            id: randomUUID(),
            business: body.business,
            leadId: body.leadId ?? null,
            kind: ["outreach", "listing", "campaign", "marketing", "development"].includes(body.kind) ? body.kind : "marketing",
            title: String(body.title ?? "Untitled draft").trim().slice(0, 120) || "Untitled draft",
            body: `Draft for ${BUSINESSES[body.business].name}\n\n${notes.slice(0, 4000)}\n\nSource: the note you entered. This was not sent, published, or purchased.`,
            status: "draft",
            externalAction: "not_performed",
            createdAt: new Date(nowFn()).toISOString(),
          });
        });
        return json({ draft: state.drafts.at(-1), sent: false }, 201);
      }
      if (request.method === "POST" && path === "/api/prospects") return await respondSaved(saveProspect, request);
      if (request.method === "POST" && path === "/api/offers") return await respondSaved(saveOffer, request);
      if (request.method === "POST" && path === "/api/follow-ups") return await respondSaved(saveFollowUp, request);
      if (request.method === "POST" && path === "/api/briefs") return await respondSaved(saveBrief, request);
      if (request.method === "POST" && path === "/api/suppliers") return await respondSaved(saveSupplier, request);
      const approval = path.match(/^\/api\/drafts\/([0-9a-f-]{36})\/approval$/);
      if (approval && request.method === "POST") {
        const body = await readJson(request);
        const action = String(body.action ?? "");
        if (!["publish", "outreach", "ads", "purchase", "account"].includes(action)) return json({ error: "Unknown approval action." }, 400);
        let shared = null;
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          const draft = current.drafts.find(item => item.id === approval[1]);
          if (!draft) throw Object.assign(new Error("Draft not found."), { status: 404 });
          createTask(current, {
            title: `Approval required before ${action}: ${draft.title}`.slice(0, 180),
            detail: draft.body,
            business: draft.business,
            priority: 5,
          }, env);
          shared = sharePreview(current, draft.id, new Date(nowFn()));
        });
        return json({
          task: state.tasks.at(-1),
          performed: false,
          externalAction: "not_performed",
          previewPath: shared?.shareToken ? `/jarvis/share/${shared.shareToken}` : null,
        }, 202);
      }
      if (request.method === "GET" && path === "/api/settings") {
        const state = await store.read(dayKey(new Date(nowFn())));
        return json({ gates: state.settings.gates });
      }
      if (request.method === "POST" && path === "/api/settings") {
        const body = await readJson(request);
        const state = await store.update(dayKey(new Date(nowFn())), current => {
          const next = { ...defaultGates() };
          for (const key of Object.keys(defaultGates())) next[key] = Boolean(body.gates?.[key]);
          current.settings.gates = next;
          current.logs.push({ id: randomUUID(), at: new Date(nowFn()).toISOString(), level: "info", message: "Approval gates updated by the owner.", taskId: null });
        });
        return json({ gates: state.settings.gates, saved: true });
      }
      if (request.method === "POST" && path === "/api/git") {
        const body = await readJson(request);
        if (body.confirm !== "commit-local" && body.confirm !== "open-pull-request") {
          return json({ performed: false, reason: "Confirmation was missing, so no git command ran." }, 400);
        }
        const sandbox = env.JARVIS_SANDBOX_REPO?.trim();
        if (!sandbox) {
          return json({ performed: false, pushed: false, pullRequest: false, reason: "Set JARVIS_SANDBOX_REPO to a dedicated repository. Jarvis will not use the Buxme checkout." });
        }
        try {
          const result = await commitApprovedSandbox({
            repoDir: sandbox,
            branch: `jarvis/${String(body.taskId ?? "").slice(0, 36)}`.replace(/[^a-z0-9/-]/g, "").slice(0, 48),
            message: "Prepare Jarvis sandbox note",
            files: Array.isArray(body.files) ? body.files : [],
            allowGit: env.JARVIS_ALLOW_GIT === "1" && body.confirm === "commit-local" || (env.JARVIS_ALLOW_GIT === "1" && body.confirm === "open-pull-request"),
            allowPush: env.JARVIS_ALLOW_GIT_PUSH === "1",
            allowPullRequest: env.JARVIS_ALLOW_PULL_REQUEST === "1",
            pushApproved: body.confirm === "open-pull-request",
            pullRequestApproved: body.confirm === "open-pull-request",
            remoteRepo: env.JARVIS_GIT_REMOTE ?? "",
            execFileImpl,
          });
          return json(result);
        } catch (error) {
          return json({ performed: false, pushed: false, pullRequest: false, reason: String(error.message ?? error).slice(0, 300) });
        }
      }
      return json({ error: "Unknown Jarvis route." }, 404);
    } catch (error) {
      const message = String(error.message ?? "Request failed.").slice(0, 300);
      const status = error.status || (/must be|Unknown|full|not found|too long|Invalid|Only a|Retry limit|Confirmation/i.test(message) ? 400 : 500);
      const safe = status === 500 ? "Jarvis could not complete that request." : message;
      if (status === 500) console.error("Jarvis request failed", { name: error.name ?? "Error" });
      return json({ error: safe }, status);
    }
  }

  async function saveRecord(save, body) {
    let result = null;
    await store.update(dayKey(new Date(nowFn())), current => {
      result = save(current, body, new Date(nowFn()));
    });
    return { ...result, sent: false, published: false, purchased: false };
  }

  async function respondSaved(save, request) {
    const result = await saveRecord(save, await readJson(request));
    return json(result, result.created ? 201 : 200);
  }

  async function ingest(event) {
    let result = null;
    await store.update(dayKey(new Date(nowFn())), current => {
      result = ingestAgencyReply(current, event, new Date(nowFn()));
    });
    return result;
  }

  async function applyEvents(events) {
    let created = 0;
    let duplicates = 0;
    const drafts = [];
    for (const event of events) {
      try {
        const result = await ingest(event);
        if (result?.duplicate) duplicates += 1;
        if (result?.created && result.draft) {
          created += 1;
          drafts.push({ id: result.draft.id, title: result.draft.title });
        }
      } catch {
        continue;
      }
    }
    return { created, duplicates, drafts };
  }

  async function collectInbox(trigger = "schedule") {
    const current = await store.read(dayKey(new Date(nowFn())));
    const seen = new Set((current.inbox ?? []).map(item => item.messageId));
    const pulled = await pullAgencyInbox({ env, fetchImpl, seen });
    const durable = redisConfigured(env);
    const once = pulled.connected ? await applyEvents(pulled.events) : { created: 0, duplicates: 0, drafts: [] };
    const twice = pulled.connected ? await applyEvents(pulled.events) : { duplicates: 0 };
    if (pulled.skipIds?.length) {
      await store.update(dayKey(new Date(nowFn())), state => {
        for (const id of pulled.skipIds) rememberSkip(state, id, new Date(nowFn()));
      });
    }
    const saved = await store.update(dayKey(new Date(nowFn())), state => {
      recordOperatorRun(state, { trigger, connected: pulled.connected, created: once.created, now: new Date(nowFn()) });
    });
    const run = saved.runs.at(-1);
    const approved = (saved.tasks ?? []).some(task => task.status === "approved");
    let worker = { completed: [], blocked: [], failed: [], skipped: [] };
    try {
      worker = run?.action === "reply" || !approved
        ? { completed: [], blocked: [], failed: [], skipped: run?.action === "reply" ? ["reply-first"] : [] }
        : await executeWorker();
    } catch (error) {
      await store.update(dayKey(new Date(nowFn())), state => recoverCheck(state, error, new Date(nowFn())));
      worker = { completed: [], blocked: [], failed: ["check"], skipped: [] };
    }
    const report = { sent: false, performedExternal: false, durable, delay: pulled.delay, run, worker };
    if (!pulled.connected) return { connected: false, reason: pulled.reason, created: 0, duplicates: 0, drafts: [], remaining: 0, ...report };
    return {
      connected: true,
      reason: durable ? "Saved. Sending still requires your approval." : "Saved on this server only. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN or the phone will not see this draft.",
      created: once.created,
      duplicates: twice.duplicates,
      drafts: once.drafts,
      remaining: pulled.remaining ?? 0,
      ...report,
    };
  }

  return { handle, ingest, collectInbox, store, env, setFailOnce(value) { failOnce = value; } };
}

async function serveStatic(path) {
  const requested = path === "/" ? "/index.html" : path;
  const file = resolve(publicDir, normalize(`.${requested}`));
  if (file !== publicDir && !file.startsWith(`${publicDir}/`)) return json({ error: "Not found." }, 404);
  try {
    const body = await readFile(file);
    const type = file.endsWith(".css") ? "text/css; charset=utf-8" : file.endsWith(".js") || file.endsWith(".mjs") ? "text/javascript; charset=utf-8" : file.endsWith(".webmanifest") ? "application/manifest+json" : file.endsWith(".wav") ? "audio/wav" : file.endsWith(".ico") ? "image/x-icon" : "text/html; charset=utf-8";
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; base-uri 'none'; form-action 'self'",
      },
    });
  } catch {
    return json({ error: "Not found." }, 404);
  }
}
