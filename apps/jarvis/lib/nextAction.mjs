import { randomUUID } from "node:crypto";
import { decideCall, reconcileCalls } from "./calls.mjs";

const WORK_ID = /^[A-Za-z0-9:._-]{6,80}$/;
const RANK = { won: 1, exception: 2, reply: 3, commitment: 4, fulfillment: 5, sourcing: 6, growth: 7 };
const RETAIL_CENTS = 2999;
const TARGET_DELIVERED_CENTS = 1000;
const PRICE = /\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/;
const SPECIFIC_SCOPE = /\b(five-page site|three-page site|one-page site|\d+-page site|landing page|website redesign)\b/i;
const GENERAL_SCOPE = /\b(website|site)\b/i;
const DEADLINE = /\b(?:by|deadline|due)\s+([A-Z][a-z]+ \d{1,2}|\d{4}-\d{2}-\d{2})/i;

function clean(value, max = 160) {
  return String(value ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}

function cents(value) {
  if (value == null || value === "") return null;
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) return undefined;
  return value;
}

export function classifyAgencyText(text) {
  const value = String(text ?? "");
  const price = value.match(PRICE);
  const scope = value.match(SPECIFIC_SCOPE) || value.match(GENERAL_SCOPE);
  const deadline = value.match(DEADLINE);
  const deposit = /\b(deposit paid|paid the deposit)\b/i.test(value);
  const accepted = /\b(i accept|we accept|accepted)\b/i.test(value);
  if ((accepted || deposit) && price && scope) {
    return {
      kind: "won",
      price: price[0].replace(/\s/g, ""),
      scope: scope[0],
      deadline: deadline?.[1] ?? "not stated",
      payment: deposit ? "deposit paid" : "acceptance recorded, deposit not stated",
    };
  }
  if (accepted || deposit) return { kind: "exception", question: "A reply sounds like an acceptance, but the scope or price is missing. Confirm both before any work starts." };
  if (/\b(interested|how much|quote|available)\b/i.test(value)) return { kind: "interested" };
  return { kind: "reply" };
}

export function scannerMargin(input = {}) {
  const cost = cents(input.supplierCostCents);
  const ship = cents(input.shippingCents);
  const missing = [];
  if (cost == null) missing.push("supplier cost");
  if (ship == null) missing.push("shipping");
  if (!Number.isInteger(input.inventory) || input.inventory < 0) missing.push("inventory");
  if (!clean(input.features, 400)) missing.push("features");
  if (!Number.isInteger(input.transitDays) || input.transitDays < 0) missing.push("US transit time");
  if (missing.length) return { known: false, blocker: `DriveNest cannot price the red V410 scanner. Missing verified ${missing.join(", ")}. Margin was not calculated.` };
  const delivered = cost + ship;
  const margin = RETAIL_CENTS - delivered;
  const money = cents => `$${(cents / 100).toFixed(2)}`;
  const within = delivered <= TARGET_DELIVERED_CENTS;
  return {
    known: true,
    deliveredCents: delivered,
    marginCents: margin,
    meetsTarget: within,
    note: within
      ? `Delivered cost is ${money(delivered)}, within the $10 target. Margin is ${money(margin)} at $29.99 before payment fees.`
      : `Delivered cost is ${money(delivered)}, above the $10 target. The listing stays a draft.`,
  };
}

export function acceptWork(state, item, now = new Date()) {
  state.work ??= [];
  const id = clean(item?.id, 80);
  if (!WORK_ID.test(id)) throw Object.assign(new Error("Work needs a stable id."), { status: 400 });
  const prior = state.work.find(row => row.id === id);
  if (prior) return { created: false, duplicate: true, item: prior };
  if (!Object.hasOwn(RANK, item?.kind)) throw Object.assign(new Error("Unknown work kind."), { status: 400 });
  if (state.work.length >= 200) throw Object.assign(new Error("The work list is full."), { status: 400 });
  const row = {
    id,
    business: clean(item.business, 40) || "website-agency",
    kind: item.kind,
    client: clean(item.client, 120),
    scope: clean(item.scope, 80),
    price: clean(item.price, 32),
    deadline: clean(item.deadline, 40),
    next: clean(item.next, 120) || "confirm the start date",
    payment: clean(item.payment, 80),
    question: clean(item.question, 280),
    title: clean(item.title, 120),
    orderId: clean(item.orderId, 40),
    issue: clean(item.issue, 240),
    assetId: clean(item.assetId, 80),
    postUrl: /^https:\/\//.test(String(item.postUrl ?? "")) ? clean(item.postUrl, 300) : "",
    providerError: clean(item.providerError, 180),
    signups: Number.isInteger(item.signups) ? item.signups : null,
    appleSubscriptions: Number.isInteger(item.appleSubscriptions) ? item.appleSubscriptions : null,
    stripeSubscriptions: Number.isInteger(item.stripeSubscriptions) ? item.stripeSubscriptions : null,
    attributed: item.attributed === true,
    attributionSource: item.attributed === true ? clean(item.attributionSource, 80) : "",
    supplierCostCents: cents(item.supplierCostCents) ?? null,
    shippingCents: cents(item.shippingCents) ?? null,
    inventory: Number.isInteger(item.inventory) ? item.inventory : null,
    features: clean(item.features, 400),
    transitDays: Number.isInteger(item.transitDays) ? item.transitDays : null,
    dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : null,
    createdAt: new Date(now).toISOString(),
    handledAt: null,
  };
  state.work.push(row);
  return { created: true, duplicate: false, item: row };
}

export function noteAgencyReply(state, item, now = new Date()) {
  if (!item || item.skipped || item.excluded) return null;
  const text = String(item.text ?? "");
  if (/\b(unsubscribe|stop emailing|remove me|do not contact|opt out)\b/i.test(text)) return null;
  const classified = classifyAgencyText(text);
  if (classified.kind === "reply") return null;
  return acceptWork(state, {
    id: `mail:${item.messageId}`,
    business: "website-agency",
    client: item.from,
    ...classified,
    kind: classified.kind === "interested" ? "reply" : classified.kind,
  }, now);
}

function log(state, message, now) {
  state.logs ??= [];
  state.logs.push({ id: randomUUID(), at: new Date(now).toISOString(), level: "info", message, taskId: null });
  if (state.logs.length > 300) state.logs.splice(0, state.logs.length - 300);
}

function scheduleFollowUps(state, now) {
  state.followUps ??= [];
  for (const draft of state.drafts ?? []) {
    if (draft.status !== "needs-christian" || state.followUps.some(item => item.draftId === draft.id)) continue;
    const dueAt = new Date(new Date(draft.createdAt).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    state.followUps.push({ id: `follow:${draft.id}`, draftId: draft.id, dueAt, reminded: false });
    acceptWork(state, { id: `follow:${draft.id}`, business: draft.business, kind: "commitment", title: draft.title, dueAt }, now);
  }
}

function measured(item) {
  const parts = [];
  if (Number.isInteger(item.signups)) parts.push(`${item.signups} signups`);
  if (Number.isInteger(item.appleSubscriptions)) parts.push(`${item.appleSubscriptions} Apple subscriptions`);
  if (Number.isInteger(item.stripeSubscriptions)) parts.push(`${item.stripeSubscriptions} Stripe subscriptions`);
  parts.push(item.attributed && item.attributionSource ? `attributed to ${item.attributionSource}` : "attribution was not measured");
  return parts.join(", ");
}

function listing(state, item, note, now) {
  state.drafts ??= [];
  if (state.drafts.some(draft => draft.workId === item.id)) return;
  state.drafts.push({
    id: randomUUID(),
    business: "drivenest",
    workId: item.id,
    kind: "listing",
    title: "Red V410 scanner listing draft",
    body: `${note}\n\nRetail $29.99. This listing was not published, inventory was not purchased, and no ad spend was made.`,
    status: "needs-christian",
    externalAction: "not_performed",
    createdAt: new Date(now).toISOString(),
  });
}

function handle(state, item, now) {
  if (item.kind === "won") {
    const decision = decideCall(state, { id: item.id, kind: "won", client: item.client, scope: item.scope, price: item.price, deadline: item.deadline, next: item.next, payment: item.payment });
    return { queuedCall: decision.call, detail: decision.call ? `${decision.record.script} The call is queued.` : decision.reason };
  }
  if (item.kind === "exception") {
    const decision = decideCall(state, { id: item.id, kind: "exception", question: item.question });
    return { queuedCall: decision.call, detail: decision.call ? `Exception queued: ${decision.record.script}` : decision.reason };
  }
  if (item.kind === "reply") return { queuedCall: false, detail: `${item.client || "The sender"} is a lead. No call was placed and nothing was sent.` };
  if (item.kind === "commitment") return { queuedCall: false, detail: `Follow-up is due for ${item.title || "a saved draft"}. Nothing was sent.` };
  if (item.kind === "fulfillment") return { queuedCall: false, detail: `Fulfillment issue ${item.orderId || "without an order id"}: ${item.issue || "needs review"}. No refund, purchase, or subscription change was made.` };
  if (item.kind === "sourcing") {
    const margin = scannerMargin(item);
    if (!margin.known) return { queuedCall: false, detail: `${margin.blocker} Nothing was published or purchased.` };
    listing(state, item, margin.note, now);
    return { queuedCall: false, detail: `${margin.note} Nothing was published or purchased.` };
  }
  const prior = (state.work ?? []).find(row => row !== item && row.assetId && row.assetId === item.assetId && row.postUrl);
  if (prior) return { queuedCall: false, detail: `Buxme already recorded ${prior.postUrl} for this video. It was not posted again.` };
  if (item.providerError) return { queuedCall: false, detail: `Buxme publishing returned an error: ${item.providerError}. Nothing else was posted.` };
  if (item.postUrl) return { queuedCall: false, detail: `Recorded Buxme post ${item.postUrl}. ${measured(item)}. No second post was created.` };
  return { queuedCall: false, detail: "Buxme publishing is not connected. No post was created and no signup count was invented." };
}

export function applyHostedPass(state, now = new Date()) {
  reconcileCalls(state);
  scheduleFollowUps(state, now);
  const due = (state.work ?? [])
    .filter(item => !item.handledAt && (item.kind !== "commitment" || new Date(item.dueAt).getTime() <= new Date(now).getTime()))
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || String(a.createdAt).localeCompare(String(b.createdAt)));
  const notes = [];
  let pickupMinutes = null;
  let callsQueued = (state.calls ?? []).filter(call => call.status === "queued" && !call.attempted).length;
  for (const item of due) {
    if ((item.kind === "won" || item.kind === "exception") && callsQueued >= 1) continue;
    const result = handle(state, item, now);
    item.handledAt = new Date(now).toISOString();
    if (result.queuedCall) callsQueued += 1;
    const waited = Math.max(0, Math.round((new Date(now) - new Date(item.createdAt)) / 60000));
    pickupMinutes = pickupMinutes == null ? waited : Math.max(pickupMinutes, waited);
    notes.push(result.detail);
    log(state, result.detail, now);
  }
  const detail = notes.length
    ? `${notes.slice(0, 2).join(" ")}${notes.length > 2 ? ` ${notes.length - 2} more items were recorded. Nothing was sent, posted, or charged.` : ""}`
    : "Nothing permitted is waiting. Nothing was sent, posted, dialed, or charged.";
  const backlog = (state.drafts ?? []).filter(draft => draft.status === "needs-christian").length
    + (state.work ?? []).filter(item => !item.handledAt).length;
  state.decisions ??= [];
  const decision = { id: randomUUID(), at: new Date(now).toISOString(), detail, backlog, pickupMinutes };
  state.decisions.push(decision);
  if (state.decisions.length > 40) state.decisions.splice(0, state.decisions.length - 40);
  return decision;
}

export function hostedView(state) {
  const decision = state.decisions?.at(-1) ?? null;
  return {
    decision: decision?.detail ?? "The hosted pass has not chosen work on this server yet.",
    backlog: decision?.backlog ?? 0,
    pickupMinutes: decision?.pickupMinutes ?? null,
    calls: (state.calls ?? []).slice(-6).map(call => ({ status: call.status, script: call.script, note: call.note ?? "", sent: Boolean(call.sent) })),
  };
}
