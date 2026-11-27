import { randomUUID } from "node:crypto";

const EXCEPTION = /\b(percent off|%\s*off|discount|lower the price|cut the price|net \d+|for free|waive)\b/i;
const ACCEPTANCE = /\b(i accept|we accept|accepted the quote|accept the quote|accept your quote|deposit paid|paid the deposit|sent the deposit|deposit is sent)\b/i;
const PHONE = /^\+[1-9]\d{7,14}$/;
const SID = /^AC[a-f0-9]{32}$/i;
const MISSED = new Set(["no-answer", "busy", "failed", "canceled"]);

function clean(value, max) {
  return String(value ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}

export function decideCall(state, event) {
  state.calls ??= [];
  const eventId = String(event?.id ?? "");
  if (!eventId) return { call: false, reason: "A call needs a stable event id." };
  if (state.calls.some(call => call.eventId === eventId)) return { call: false, reason: "This event already has one call. A second call was not placed.", sent: false };
  if (event.kind === "interested") return { call: false, reason: "An interested reply is a lead. No call was placed.", sent: false };
  if (event.kind === "routine") return { call: false, reason: "Routine progress stays on the dashboard. No call was placed.", sent: false };
  if (event.kind === "won") {
    const record = {
      eventId,
      kind: "won",
      status: "queued",
      sent: false,
      script: `${event.client} accepted ${event.scope} for ${event.price}. Deadline ${event.deadline}. Next, ${event.next}.`.replace(/[\r\n]/g, " ").slice(0, 240),
    };
    state.calls.push(record);
    return { call: true, reason: "One call is queued for the verified number. Jarvis has not dialed.", record };
  }
  if (event.kind === "exception") {
    const record = { eventId, kind: "exception", status: "queued", sent: false, script: clean(event.question, 240) };
    state.calls.push(record);
    return { call: true, reason: "One question is queued for the verified number. Jarvis has not dialed.", record };
  }
  return { call: false, reason: "This event does not place a call.", sent: false };
}

export function markMissed(state, eventId) {
  const call = (state.calls ?? []).find(item => item.eventId === eventId);
  if (!call) return null;
  if (call.status !== "missed") {
    call.status = "missed";
    call.note = "Missed call. The update is on the dashboard. No second call was placed.";
  }
  return call;
}

export function approveQuote(state, input, now = new Date()) {
  state.quotes ??= [];
  const prospect = clean(input?.prospect, 80);
  const scope = clean(input?.scope, 120);
  const price = clean(input?.price, 40);
  const deadline = clean(input?.deadline, 80);
  const next = clean(input?.next, 120);
  if ([prospect, scope, price, deadline, next].some(value => value.length < 2)) {
    throw Object.assign(new Error("A quote needs a prospect, scope, price, deadline, and next step."), { status: 400 });
  }
  if (!/\$\s?\d/.test(price)) throw Object.assign(new Error("Enter the price you approved, including the dollar amount."), { status: 400 });
  const quote = { id: randomUUID(), prospect, scope, price, deadline, next, status: "approved", approvedAt: new Date(now).toISOString() };
  state.quotes.push(quote);
  if (state.quotes.length > 100) state.quotes.splice(0, state.quotes.length - 100);
  return quote;
}

function matchingQuote(state, from) {
  const sender = from.trim().toLowerCase();
  if (sender.length < 3) return null;
  const quotes = (state.quotes ?? []).filter(quote => quote.status === "approved");
  for (let index = quotes.length - 1; index >= 0; index -= 1) {
    const prospect = quotes[index].prospect.trim().toLowerCase();
    if (prospect.length >= 3 && (sender.includes(prospect) || prospect.includes(sender))) return quotes[index];
  }
  return null;
}

function logCall(state, message, now) {
  state.logs ??= [];
  state.logs.push({ id: randomUUID(), at: new Date(now).toISOString(), level: "info", message, taskId: null });
}

export function considerCall(state, event, now = new Date()) {
  const text = String(event?.text ?? "");
  const from = String(event?.from ?? "");
  const messageId = String(event?.messageId ?? "");
  if (EXCEPTION.test(text)) {
    const decision = decideCall(state, { id: messageId, kind: "exception", question: text });
    logCall(state, decision.call ? `Queued one question about ${from}. Nothing was emailed or dialed yet.` : decision.reason, now);
    return decision;
  }
  if (ACCEPTANCE.test(text)) {
    const quote = matchingQuote(state, from);
    if (!quote) {
      logCall(state, `Recorded acceptance language from ${from}. No approved quote matches, so no call was placed.`, now);
      return { call: false, reason: "No approved quote matches this sender. No call was placed.", sent: false };
    }
    const decision = decideCall(state, { id: messageId, kind: "won", client: quote.prospect, scope: quote.scope, price: quote.price, deadline: quote.deadline, next: quote.next });
    logCall(state, decision.call ? `Queued one call because ${quote.prospect} accepted the approved quote. Nothing was emailed or dialed yet.` : decision.reason, now);
    return decision;
  }
  return { call: false, reason: "This reply does not place a call.", sent: false };
}

export function callWindow(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now));
  return hour >= 8 && hour < 21;
}

export function callLine(env = {}) {
  const to = String(env.JARVIS_VERIFIED_PHONE_NUMBER ?? "");
  const from = String(env.TWILIO_PHONE_NUMBER ?? "");
  const sid = String(env.TWILIO_ACCOUNT_SID ?? "");
  const token = String(env.TWILIO_AUTH_TOKEN ?? "");
  const origin = String(env.JARVIS_PUBLIC_ORIGIN ?? "");
  const present = Boolean(to && from && sid && token && origin);
  const valid = PHONE.test(to) && PHONE.test(from) && SID.test(sid) && token.length >= 8 && token.length <= 200 && /^https:\/\//.test(origin);
  return { to, from, sid, token, origin, present, valid };
}

export function claimCalls(state, { env = {}, now = new Date() } = {}) {
  const line = callLine(env);
  const claimed = [];
  let held = "";
  for (const call of state.calls ?? []) {
    if (call.status !== "queued" || call.sent) continue;
    if (!line.present) {
      call.note = "The phone line is not connected. Nothing was dialed.";
      held = "unconfigured";
      continue;
    }
    if (!line.valid) {
      call.note = "The phone line configuration is invalid. Nothing was dialed.";
      held = "invalid";
      continue;
    }
    if (!callWindow(now)) {
      call.note = "Outside 8:00 AM to 9:00 PM ET. Nothing was dialed.";
      held = "quiet-hours";
      continue;
    }
    call.sent = true;
    call.status = "dialing";
    call.note = "A call was started for this event. A second call will not be placed.";
    claimed.push({ eventId: call.eventId, script: call.script });
  }
  return { claimed, held, line };
}

export async function dialClaimed(claimed, { env = {}, fetchImpl = fetch } = {}) {
  const line = callLine(env);
  const results = [];
  for (const call of claimed) {
    const callback = new URL("/api/jarvis/voice", line.origin);
    callback.searchParams.set("say", String(call.script ?? "").slice(0, 240));
    const status = new URL("/api/jarvis/voice/status", line.origin);
    status.searchParams.set("event", call.eventId);
    const body = new URLSearchParams({
      To: line.to,
      From: line.from,
      Url: callback.toString(),
      Method: "POST",
      StatusCallback: status.toString(),
      StatusCallbackMethod: "POST",
    });
    try {
      const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${line.sid}/Calls.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${line.sid}:${line.token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      const payload = response.ok ? await response.json().catch(() => ({})) : {};
      const providerId = String(payload?.sid ?? "").slice(0, 40);
      results.push(response.ok && providerId
        ? { eventId: call.eventId, status: "dialed", note: "One call was placed to the verified number.", providerId }
        : { eventId: call.eventId, status: "unconfirmed", note: "The phone line did not confirm the call. No second call was placed.", providerId: "" });
    } catch {
      results.push({ eventId: call.eventId, status: "unconfirmed", note: "The phone line did not confirm the call. No second call was placed.", providerId: "" });
    }
  }
  return results;
}

export function applyDialResults(state, results) {
  for (const result of results ?? []) {
    const call = (state.calls ?? []).find(item => item.eventId === result.eventId);
    if (!call || call.status === "missed" || call.status === "answered") continue;
    call.status = result.status;
    call.note = result.note;
    if (result.providerId) call.providerId = result.providerId;
  }
}

export function recordProviderStatus(state, eventId, providerStatus) {
  const call = (state.calls ?? []).find(item => item.eventId === eventId);
  if (!call) return null;
  const status = String(providerStatus ?? "").toLowerCase();
  if (call.status === "missed" || call.status === "answered") return call;
  if (MISSED.has(status)) return markMissed(state, eventId);
  if (status === "completed") {
    call.status = "answered";
    call.note = "Christian answered. No second call was placed.";
  }
  return call;
}
