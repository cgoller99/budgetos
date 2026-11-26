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
      script: `${event.client} accepted ${event.scope} for ${event.price}. Deadline ${event.deadline}. Next, ${event.next}.`,
    };
    state.calls.push(record);
    return { call: true, reason: "One call is queued for the verified number. Jarvis has not dialed.", record };
  }
  if (event.kind === "exception") {
    const record = { eventId, kind: "exception", status: "queued", sent: false, script: String(event.question ?? "").slice(0, 280) };
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
