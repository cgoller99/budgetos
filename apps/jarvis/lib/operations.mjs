import { randomUUID } from "node:crypto";

const BLOCKED = [/atlanta auto diesel/i, /reynolds(?: and sons| & sons)/i];

function clean(value, max) {
  return String(value ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}

function blocked(value) {
  return BLOCKED.some(pattern => pattern.test(String(value ?? "")));
}

function count(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100000000) return null;
  return number;
}

function cents(value) {
  const text = String(value ?? "").trim().replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

export function money(centsValue) {
  const sign = centsValue < 0 ? "-" : "";
  const absolute = Math.abs(centsValue);
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function log(state, at, message) {
  state.logs ??= [];
  state.logs.push({ id: randomUUID(), at, level: "info", message: message.slice(0, 300), taskId: null });
}

function draftFor(state, lead) {
  return {
    id: randomUUID(),
    business: lead.business,
    leadId: lead.id,
    kind: lead.business === "buxme" ? "campaign" : "outreach",
    title: `${lead.business === "buxme" ? "Buxme note" : "Follow up"}: ${lead.name}`.slice(0, 120),
    body: `${clean(lead.note, 800)}\n\nSource: the note you saved. This was not sent or published.`,
    status: "draft",
    externalAction: "not_performed",
    createdAt: lead.preparedAt,
  };
}

function prepareLead(state, lead, at, message) {
  lead.preparedAt = at;
  lead.followUpId = randomUUID();
  const draft = draftFor(state, lead);
  draft.id = lead.followUpId;
  draft.createdAt = at;
  state.drafts ??= [];
  state.drafts.push(draft);
  if (lead.stage === "new") lead.stage = "drafted";
  log(state, at, message);
  return { action: "draft", id: draft.id };
}

export function advanceBusinesses(state, now = new Date()) {
  const at = new Date(now).toISOString();
  return {
    agency: advanceAgency(state, at),
    buxme: advanceBuxme(state, at),
    drivenest: advanceDriveNest(state, at),
  };
}

function advanceAgency(state, at) {
  const leads = state.leads ?? [];
  const responded = leads.find(lead => lead.business === "website-agency" && lead.stage === "responded" && !lead.followUpId && !blocked(lead.name));
  if (responded && clean(responded.note, 800).length >= 3) {
    return prepareLead(state, responded, at, `Prepared one follow-up for ${responded.name}. They are the closest to a paying customer. Nothing was sent.`);
  }
  const quote = (state.inbox ?? []).find(item => {
    const draft = (state.drafts ?? []).find(entry => entry.id === item.draftId);
    return item.interested && !item.excluded && draft && !draft.quoteReady && !blocked(item.from);
  });
  if (quote) {
    const draft = state.drafts.find(entry => entry.id === quote.draftId);
    draft.quoteReady = true;
    draft.quote = { prospect: clean(quote.from, 80), scope: "", price: "", deadline: "", next: "Christian enters the approved price." };
    draft.body += "\n\nQuote checklist: prospect recorded. Scope, price, deadline, and next step are waiting on Christian. Nothing was priced or sent.";
    log(state, at, `Prepared a quote checklist for ${clean(quote.from, 80)}. The price is blank. Nothing was sent.`);
    return { action: "quote", id: draft.id };
  }
  const fresh = leads.find(lead => lead.business === "website-agency" && lead.stage === "new" && !lead.followUpId && clean(lead.note, 800).length >= 8 && !blocked(lead.name));
  if (fresh) return prepareLead(state, fresh, at, `Qualified ${fresh.name} from the note you saved and prepared one follow-up. Nobody was contacted.`);
  return { action: "none" };
}

function advanceBuxme(state, at) {
  const lead = (state.leads ?? []).find(item => item.business === "buxme" && !item.followUpId && clean(item.note, 800).length >= 8 && !blocked(item.name));
  if (!lead) return { action: state.buxmeReading ? "recorded" : "waiting" };
  return prepareLead(state, lead, at, `Prepared one Buxme draft from the note you saved for ${lead.name}. It was not published.`);
}

function advanceDriveNest(state) {
  const product = (state.products ?? []).find(item => item.deliveredCents != null);
  if (!product) return { action: "waiting" };
  if (product.priceCents == null) return { action: "needs-price", id: product.id };
  return { action: product.priceCents > product.deliveredCents ? "profitable" : "not-profitable", id: product.id };
}

export function saveBuxmeReading(state, reading, now = new Date()) {
  const next = {
    users: count(reading?.users),
    activeUsers7d: count(reading?.activeUsers7d),
    paidUsers: count(reading?.paidUsers),
    applePaid: count(reading?.applePaid),
    stripePaid: count(reading?.stripePaid),
    failedPayments: count(reading?.failedPayments),
    mrrCents: reading?.stripeReported === true ? cents(reading?.mrr) : null,
    stripeReported: reading?.stripeReported === true,
  };
  if ([next.users, next.activeUsers7d, next.paidUsers, next.applePaid, next.stripePaid].every(value => value == null)) {
    return { recorded: false };
  }
  const signature = JSON.stringify(next);
  if (state.buxmeReading?.signature === signature) return { recorded: false, duplicate: true };
  const at = new Date(now).toISOString();
  state.buxmeReading = { ...next, at, signature, source: "admin-metrics" };
  const parts = [];
  if (next.users != null) parts.push(`${next.users} users`);
  if (next.activeUsers7d != null) parts.push(`${next.activeUsers7d} active in 7 days`);
  if (next.paidUsers != null) parts.push(`${next.paidUsers} paid profiles`);
  if (next.applePaid != null) parts.push(`${next.applePaid} Apple`);
  if (next.stripePaid != null) parts.push(`${next.stripePaid} Stripe`);
  log(state, at, `Recorded Buxme counts: ${parts.join(", ")}. Nothing was published.`);
  return { recorded: true, duplicate: false };
}

export function saveProductCost(state, input, now = new Date()) {
  const name = clean(input?.name, 80);
  const deliveredCents = cents(input?.deliveredCost);
  const priceCents = input?.price == null || String(input.price).trim() === "" ? null : cents(input.price);
  if (name.length < 2) throw Object.assign(new Error("Name the product you verified."), { status: 400 });
  if (deliveredCents == null) throw Object.assign(new Error("Enter the delivered cost you verified. Jarvis will not estimate supplier price or shipping."), { status: 400 });
  if (input?.price != null && String(input.price).trim() !== "" && priceCents == null) {
    throw Object.assign(new Error("Enter the selling price as a dollar amount, or leave it blank."), { status: 400 });
  }
  const sku = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const at = new Date(now).toISOString();
  state.products ??= [];
  state.drafts ??= [];
  let product = state.products.find(item => item.sku === sku);
  if (!product) {
    product = { id: randomUUID(), sku, name, createdAt: at };
    state.products.push(product);
  }
  product.name = name;
  product.deliveredCents = deliveredCents;
  product.priceCents = priceCents;
  product.marginCents = priceCents == null ? null : priceCents - deliveredCents;
  product.updatedAt = at;
  const signature = `${deliveredCents}:${priceCents ?? ""}`;
  let listing = state.drafts.find(item => item.productId === product.id && item.kind === "listing");
  const body = listingBody(product);
  if (!listing) {
    listing = {
      id: randomUUID(),
      business: "drivenest",
      productId: product.id,
      kind: "listing",
      title: `Listing draft: ${name}`.slice(0, 120),
      body,
      status: "draft",
      externalAction: "not_performed",
      createdAt: at,
      costSignature: signature,
    };
    state.drafts.push(listing);
    log(state, at, `Prepared one listing draft for ${name}. Nothing was published or purchased.`);
  } else if (listing.costSignature !== signature) {
    listing.body = body;
    listing.costSignature = signature;
    log(state, at, `Updated the listing draft for ${name} from the cost you entered. Nothing was published or purchased.`);
  }
  return { product, listing, purchased: false, published: false };
}

function listingBody(product) {
  const cost = money(product.deliveredCents);
  const price = product.priceCents == null ? "not recorded" : money(product.priceCents);
  const margin = product.marginCents == null ? "unknown until the selling price is recorded" : money(product.marginCents);
  return `${product.name}\nDelivered cost: ${cost}\nSelling price: ${price}\nMargin: ${margin}\n\nSource: the cost you verified. This was not published or purchased.`;
}

export function describeBusinesses(state) {
  const waiting = (state.drafts ?? []).filter(draft => draft.status === "needs-christian");
  const reading = state.buxmeReading;
  const product = (state.products ?? []).find(item => item.deliveredCents != null) ?? null;
  return {
    buxme: describeBuxme(reading),
    agency: {
      question: "Did anybody reply, and who needs me?",
      connected: true,
      answer: waiting.length ? `${waiting.length} draft${waiting.length === 1 ? "" : "s"} waiting on you.` : "No reply is waiting.",
      recovery: "The hosted check prepares one follow-up or quote checklist from facts already saved. Sending still requires your approval.",
      next: agencyNext(state),
      records: waiting,
    },
    drivenest: describeDriveNest(product),
  };
}

function describeBuxme(reading) {
  if (!reading) {
    return {
      question: "Did yesterday’s video go out, and did anyone sign up?",
      connected: false,
      answer: "Publishing, signups, and subscriptions are not connected.",
      recovery: "The hosted check stores admin counts when the budgetos database responds. Until a reading is saved, Jarvis will not invent a count or publish a post.",
      records: [],
    };
  }
  const parts = [];
  if (reading.users != null) parts.push(`${reading.users} users`);
  if (reading.activeUsers7d != null) parts.push(`${reading.activeUsers7d} active in 7 days`);
  if (reading.paidUsers != null) parts.push(`${reading.paidUsers} paid profiles`);
  if (reading.applePaid != null) parts.push(`${reading.applePaid} paid through Apple`);
  if (reading.stripePaid != null) parts.push(`${reading.stripePaid} paid through Stripe`);
  let answer = `${parts.join(", ")}.`;
  if (reading.stripeReported && reading.mrrCents != null) answer += ` Stripe MRR is ${money(reading.mrrCents)}.`;
  else answer += " Stripe MRR was not read on this check.";
  answer += " Nothing was published.";
  return {
    question: "Did yesterday’s video go out, and did anyone sign up?",
    connected: true,
    answer,
    recovery: "Publishing is not connected, so Jarvis recorded the counts and did not post.",
    records: [reading],
  };
}

function agencyNext(state) {
  const responded = (state.leads ?? []).find(lead => lead.business === "website-agency" && lead.stage === "responded" && !lead.followUpId);
  if (responded) return `Next: follow up with ${responded.name}. Nothing will be sent.`;
  const quote = (state.inbox ?? []).find(item => item.interested && !item.excluded && (state.drafts ?? []).some(draft => draft.id === item.draftId && !draft.quoteReady));
  if (quote) return `Next: prepare a quote checklist for ${clean(quote.from, 80)}. The price stays blank.`;
  return "No new agency follow-up is waiting.";
}

function describeDriveNest(product) {
  const base = {
    question: "What’s holding up the scanner launch?",
    recovery: "Enter the delivered cost you verified. Jarvis will not estimate supplier price or shipping, and it will not purchase inventory.",
  };
  if (!product) {
    return { ...base, connected: false, answer: "Supplier cost is unknown, so margin is unknown.", blocker: "Supplier cost is not connected.", records: [] };
  }
  if (product.priceCents == null) {
    return {
      ...base,
      connected: true,
      answer: `${product.name} delivered cost is ${money(product.deliveredCents)}. The selling price is not recorded, so margin is unknown.`,
      blocker: "Selling price is not recorded.",
      records: [product],
    };
  }
  const profitable = product.marginCents > 0;
  return {
    ...base,
    connected: true,
    answer: `${product.name} delivered cost is ${money(product.deliveredCents)}. Selling price is ${money(product.priceCents)}. Margin is ${money(product.marginCents)}.`,
    blocker: profitable ? "" : "Margin is not positive.",
    records: [product],
  };
}
