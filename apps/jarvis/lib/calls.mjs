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
      attempted: false,
      script: `${event.client} accepted ${event.scope} for ${event.price}. Payment ${event.payment || "not stated"}. Deadline ${event.deadline}. Next, ${event.next}.`,
    };
    state.calls.push(record);
    return { call: true, reason: "One call is queued for the verified number. Jarvis has not dialed.", record };
  }
  if (event.kind === "exception") {
    const record = { eventId, kind: "exception", status: "queued", sent: false, attempted: false, script: String(event.question ?? "").slice(0, 280) };
    state.calls.push(record);
    return { call: true, reason: "One question is queued for the verified number. Jarvis has not dialed.", record };
  }
  return { call: false, reason: "This event does not place a call.", sent: false };
}

export function markMissed(state, eventId) {
  const call = (state.calls ?? []).find(item => item.eventId === eventId);
  if (!call || call.status === "connected") return call ?? null;
  if (call.status !== "missed") {
    call.status = "missed";
    call.note = "Missed call. The update is on the dashboard. No second call was placed.";
  }
  return call;
}

const E164 = /^\+[1-9]\d{7,14}$/;

export function callConnection(env = process.env) {
  const to = String(env.JARVIS_VERIFIED_PHONE_NUMBER ?? "").trim();
  const from = String(env.TWILIO_PHONE_NUMBER ?? "").trim();
  const sid = String(env.TWILIO_ACCOUNT_SID ?? "").trim();
  const token = String(env.TWILIO_AUTH_TOKEN ?? "").trim();
  const origin = String(env.JARVIS_PUBLIC_ORIGIN ?? "").trim().replace(/\/$/, "");
  const ready = E164.test(to) && E164.test(from) && /^AC[a-f0-9]{32}$/i.test(sid) && token.length >= 16 && origin.startsWith("https://");
  return { ready, to: ready ? to : "", from: ready ? from : "", origin: ready ? origin : "", reason: ready ? "" : "The verified phone line is not configured. The call stays queued and nothing was dialed." };
}

export function reconcileCalls(state) {
  for (const call of state.calls ?? []) {
    if (call.attempted && call.status === "queued") {
      call.status = "uncertain";
      call.note = "A restart left this call unconfirmed. Jarvis will not dial it again.";
    }
  }
}

export function claimForDial(state, now = new Date()) {
  reconcileCalls(state);
  const call = (state.calls ?? []).find(item => item.status === "queued" && !item.attempted);
  if (!call) return null;
  call.attempted = true;
  call.attemptedAt = new Date(now).toISOString();
  return { eventId: call.eventId, script: call.script };
}

export function recordCallReceipt(state, eventId, receipt = {}) {
  const call = (state.calls ?? []).find(item => item.eventId === eventId);
  if (!call || ["connected", "missed", "uncertain", "failed", "dialed"].includes(call.status)) return call ?? null;
  if (receipt.ok && receipt.sid) {
    const connected = ["in-progress", "completed", "answered"].includes(String(receipt.status ?? ""));
    call.status = connected ? "connected" : "dialed";
    call.sent = true;
    call.providerId = String(receipt.sid).slice(0, 64);
    call.providerStatus = String(receipt.status || "queued").slice(0, 40);
    call.note = connected ? "Connected once. No second call was placed." : "The verified line accepted one call. A second call was not placed.";
  } else if (receipt.uncertain) {
    call.status = "uncertain";
    call.sent = false;
    call.note = "The phone provider did not confirm the call. Jarvis will not dial again.";
  } else {
    call.status = "failed";
    call.sent = false;
    call.note = "The phone provider refused the call. Jarvis will not dial again.";
  }
  return call;
}

export async function placeVerifiedCall(request, env = process.env, fetchImpl = fetch) {
  const line = callConnection(env);
  if (!line.ready) throw Object.assign(new Error(line.reason), { configured: false });
  if (request?.to !== line.to || !request.approvedByUser || !String(request.reason ?? "").trim()) {
    throw Object.assign(new Error("Jarvis only dials the verified number for a won job or an exception."), { status: 400 });
  }
  const callback = new URL(String(request.callbackUrl ?? ""));
  if (callback.protocol !== "https:") throw Object.assign(new Error("Call callback must use HTTPS."), { status: 400 });
  const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID.trim()}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID.trim()}:${env.TWILIO_AUTH_TOKEN.trim()}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: request.to, From: line.from, Url: callback.toString(), Method: "POST" }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Call provider returned HTTP ${response.status}.`), { status: response.status });
  if (!body.sid) throw Object.assign(new Error("Call provider did not return a call identifier."), { uncertain: true });
  return { sid: body.sid, status: body.status ?? "queued" };
}
