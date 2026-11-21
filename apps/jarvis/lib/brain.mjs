import { classifyJarvisTask, modelChain, spendCap } from "./routing.mjs";

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

export function localReply({ text, context }) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (/\b(revenue|mrr|profit|sales|conversion rate|store performance)\b/i.test(lower)) {
    return "I cannot answer that with a number. Buxme metrics and DriveNest store performance are not connected, and I will not estimate them.";
  }
  if (/^(hi|hello|hey|good morning|good evening)\b/i.test(lower)) {
    return `I'm here. ${context.modelNote} You have ${context.taskCount} recorded task${context.taskCount === 1 ? "" : "s"}. I have not contacted anyone or changed an external account.`;
  }
  if (/\b(status|health|what can you do|capabilities)\b/i.test(lower)) {
    return `Chat and device voice are available. ${context.modelNote} Approval is still required for publishing, outreach, advertising, purchases, deploys, and account changes. Nothing external has been sent.`;
  }
  if (/\b(draft|outreach|listing|campaign)\b/i.test(lower)) {
    return `I can draft that from notes you supply. I will not invent a customer or a result, and I will not send it. Add the business, the recipient or product, and the facts you want included.`;
  }
  return `${context.modelNote} I can take a task, draft from your notes, or report what is actually connected. I do not have an answer beyond that for this message, and I have not taken an external action.`;
}

function contextFrom(text, state, env, now) {
  const cap = spendCap(env);
  const key = Boolean(env.AI_GATEWAY_API_KEY?.trim());
  let modelNote = "Model calls are off because no spending cap is authorized.";
  if (!key) modelNote = "Model calls are off because AI_GATEWAY_API_KEY is not configured.";
  else if (!cap.authorized) modelNote = cap.reason;
  else modelNote = `Model calls are authorized for up to ${cap.cap} requests today.`;
  return {
    modelNote,
    taskCount: state.tasks.length,
    day: dayKey(now),
    kind: classifyJarvisTask(text),
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

export async function think({ text, state, env, fetchImpl = fetch, now = new Date() }) {
  const context = contextFrom(text, state, env, now);
  const cap = spendCap(env);
  const usage = state.usage?.day === context.day ? state.usage : { day: context.day, requests: 0, promptTokens: 0, completionTokens: 0, errors: [], byModel: {} };
  const base = {
    kind: context.kind,
    provider: "local",
    model: "",
    usage,
    attempted: [],
  };
  if (!env.AI_GATEWAY_API_KEY?.trim() || !cap.authorized || usage.requests >= cap.cap) {
    const reason = !env.AI_GATEWAY_API_KEY?.trim() || !cap.authorized
      ? context.modelNote
      : `The daily model cap of ${cap.cap} is already used.`;
    const reply = localReply({ text, context });
    return { ...base, reply: reply.includes(reason) ? reply : `${reply} ${reason}`.trim() };
  }
  const history = state.messages.slice(-8).map(message => ({ role: message.role, content: message.content }));
  const messages = [
    { role: "system", content: `${SYSTEM}\n\nConnected context: ${context.modelNote} Recorded tasks: ${context.taskCount}.` },
    ...history,
    { role: "user", content: text },
  ];
  let lastError = "No model responded.";
  for (const model of modelChain(context.kind, env)) {
    if (usage.requests >= cap.cap) break;
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
      return { ...base, provider: "gateway", model, reply: result.reply, usage };
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
    reply: `${localReply({ text, context })} The configured models did not answer (${lastError}).`,
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
