import { classifyJarvisTask, modelChain, spendCap, spendCeiling } from "./routing.mjs";

const SYSTEM = [
  "You are Jarvis, a calm operations assistant for three separate businesses: Buxme, a website-building agency, and DriveNest Auto Care.",
  "Speak in short sentences that can be read aloud.",
  "Use only the context supplied in this request.",
  "Never invent metrics, customers, revenue, or claim that an email, purchase, deployment, or account change was completed.",
  "If a source is not connected, say it is not connected.",
  "Jarvis and Buxme are different products. Do not claim you changed Buxme production.",
].join(" ");

export function redact(value) {
  return String(value ?? "")
    .replace(/bearer\s+[a-z0-9._~+/-]+=*/gi, "bearer [redacted]")
    .replace(/sk-[a-z0-9_-]{8,}/gi, "[redacted]")
    .slice(0, 300);
}

function dayKey(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function connectionFor(env, usage, now = new Date()) {
  const cap = spendCap(env);
  const day = dayKey(now);
  const requests = usage?.day === day ? Number(usage.requests) || 0 : 0;
  if (!env.AI_GATEWAY_API_KEY?.trim()) {
    return { connected: false, reason: "Model calls are off because AI_GATEWAY_API_KEY is not configured.", cap, requests };
  }
  const ceiling = spendCeiling(env);
  const spent = usage?.day === day ? Number(usage.spendCents) || 0 : 0;
  if (!cap.authorized) return { connected: false, reason: cap.reason, cap, requests, ceiling, spent };
  if (!ceiling.ok) return { connected: false, reason: ceiling.reason, cap, requests, ceiling, spent };
  if (requests >= cap.cap) return { connected: false, reason: `The daily model cap of ${cap.cap} is already used.`, cap, requests, ceiling, spent };
  if (spent >= ceiling.cents) return { connected: false, reason: "The $5 daily spending ceiling is reached. Model calls are paused until tomorrow.", cap, requests, ceiling, spent };
  return { connected: true, reason: "", cap, requests, ceiling, spent };
}

function contextFrom(text, state, env, now) {
  const day = dayKey(now);
  const usage = state.usage?.day === day
    ? state.usage
    : { day, requests: 0, promptTokens: 0, completionTokens: 0, errors: [], byModel: {} };
  const connection = connectionFor(env, usage, now);
  return {
    modelNote: connection.connected ? `Model calls are authorized for up to ${connection.cap.cap} requests today.` : connection.reason,
    connection,
    taskCount: state.tasks?.length ?? 0,
    tasks: (state.tasks ?? []).slice(-6).map(task => `${task.status}: ${task.title}`).join("; ") || "none",
    day,
    kind: classifyJarvisTask(text),
    usage,
  };
}

async function callGateway({ model, messages, env, fetchImpl, signal }) {
  const response = await fetchImpl("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AI_GATEWAY_API_KEY.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, temperature: 0.4, max_tokens: 450, messages }),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(redact(body?.error?.message || response.statusText || "Model request failed"));
    error.status = response.status;
    throw error;
  }
  const reply = body?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new Error("Model returned an empty reply");
  return {
    reply: reply.trim().slice(0, 4000),
    tokens: {
      prompt: Number(body?.usage?.prompt_tokens ?? 0) || 0,
      completion: Number(body?.usage?.completion_tokens ?? 0) || 0,
    },
  };
}

export async function think({ text, state, env, fetchImpl = fetch, now = new Date(), kind }) {
  const context = contextFrom(text, state, env, now);
  if (kind && ["coding", "business", "research", "routine"].includes(kind)) context.kind = kind;
  const usage = context.usage;
  const base = {
    kind: context.kind,
    provider: "unavailable",
    model: "",
    usage,
    attempted: [],
    connected: context.connection.connected,
    source: "unavailable",
    error: context.connection.reason || null,
  };
  if (!context.connection.connected) {
    const metric = /\b(revenue|mrr|profit|sales|conversion rate|store performance)\b/i.test(text);
    return {
      ...base,
      reply: metric
        ? "I cannot answer that with a number. Buxme metrics and DriveNest store performance are not connected, and I will not estimate them."
        : context.connection.reason,
    };
  }
  const history = (state.messages ?? []).slice(-8)
    .filter(message => message.role === "user" || message.role === "assistant")
    .map(message => ({ role: message.role, content: message.content }));
  if (history.at(-1)?.role === "user" && history.at(-1).content === text) history.pop();
  const messages = [
    { role: "system", content: `${SYSTEM}\n\nConnected context: ${context.modelNote} Recorded tasks: ${context.taskCount}. Queue: ${context.tasks}.` },
    ...history,
    { role: "user", content: text },
  ];
  let lastError = "No model responded.";
  for (const model of modelChain(context.kind, env)) {
    if (usage.requests >= context.connection.cap.cap) break;
    usage.requests += 1;
    usage.byModel[model] ??= { requests: 0, errors: 0 };
    usage.byModel[model].requests += 1;
    base.attempted.push(model);
    try {
      const result = await callGateway({
        model,
        messages,
        env,
        fetchImpl,
        signal: AbortSignal.timeout(20000),
      });
      usage.promptTokens += result.tokens.prompt;
      usage.completionTokens += result.tokens.completion;
      usage.spendCents = (Number(usage.spendCents) || 0) + 1;
      return { ...base, provider: "gateway", source: "gateway", model, reply: result.reply, usage, connected: true, error: null };
    } catch (error) {
      usage.byModel[model].errors += 1;
      usage.errors.push({ at: now.toISOString(), model, status: error.status ?? 0, message: redact(error.message) });
      usage.errors = usage.errors.slice(-20);
      lastError = redact(error.message);
      const retry = !error.status || error.status === 404 || error.status === 408 || error.status === 429 || error.status >= 500;
      if (!retry) break;
    }
  }
  return {
    ...base,
    provider: "unavailable",
    source: "unavailable",
    connected: false,
    error: lastError,
    reply: `The configured models did not answer (${lastError}).`,
    usage,
  };
}

export function commandFrom(text) {
  const task = text.trim().match(/^(?:please\s+)?(?:create|add|queue|save)\s+(?:a\s+)?task[:,\s]+(.{3,180})$/i);
  if (task) return { type: "task", title: task[1].trim() };
  const review = text.trim().match(/^(approve|reject)\s+([a-z0-9-]{8,40})$/i);
  if (review) return { type: review[1].toLowerCase(), id: review[2] };
  if (/^run worker$/i.test(text.trim())) return { type: "worker" };
  return null;
}
