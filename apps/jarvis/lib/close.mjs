import { randomUUID } from "node:crypto";

const BLOCKED = [/atlanta auto diesel/i, /reynolds(?: and sons| & sons)/i];

function clean(value, max) {
  return String(value ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}

function blocked(value) {
  return BLOCKED.some(pattern => pattern.test(String(value ?? "")));
}

function fail(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function cents(value) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim().replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

function money(centsValue) {
  const sign = centsValue < 0 ? "-" : "";
  const absolute = Math.abs(centsValue);
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function log(state, at, message) {
  state.logs ??= [];
  state.logs.push({ id: randomUUID(), at, level: "info", message: message.slice(0, 300), taskId: null });
}

function remember(state, key, summary, at) {
  state.decisions ??= [];
  if (state.decisions.some(item => item.key === key)) return false;
  state.decisions.push({ id: randomUUID(), key, summary: summary.slice(0, 240), at });
  if (state.decisions.length > 100) state.decisions.splice(0, state.decisions.length - 100);
  return true;
}

function draft(state, fields) {
  state.drafts ??= [];
  state.drafts.push(fields);
  return fields;
}

export function saveProspect(state, input, now = new Date()) {
  const name = clean(input?.name, 80);
  const note = clean(input?.note, 800);
  const url = clean(input?.url, 200);
  const at = new Date(now).toISOString();
  if (name.length < 2) fail("Name the prospect.");
  if (blocked(name) || blocked(note)) fail("That name is on the exclusion list. Nothing was saved.");
  if (note.length < 8) fail("Add the qualification note. Jarvis will not invent why they are a fit.");
  if (url && !/^https?:\/\//i.test(url)) fail("The page must start with http:// or https://.");
  state.leads ??= [];
  if (state.leads.length >= 200) fail("Lead list is full.");
  const key = `prospect:${name.toLowerCase()}`;
  if (!remember(state, key, `Qualified ${name}`, at)) return { created: false, duplicate: true, contacted: false };
  const lead = { id: randomUUID(), business: "website-agency", name, url, note, stage: "drafted", createdAt: at, decisionKey: key, qualified: true };
  state.leads.push(lead);
  log(state, at, `Qualified ${name} from the note you wrote. Nobody was contacted.`);
  return { created: true, duplicate: false, lead, contacted: false };
}

export function saveOffer(state, input, now = new Date()) {
  const prospect = clean(input?.prospect, 80);
  const scope = clean(input?.scope, 160);
  const price = clean(input?.price, 40);
  const deadline = clean(input?.deadline, 80);
  const next = clean(input?.next, 160);
  const at = new Date(now).toISOString();
  if ([prospect, scope, deadline, next].some(value => value.length < 2)) fail("An offer needs a prospect, scope, deadline, and next step.");
  if (blocked(prospect)) fail("That prospect is on the exclusion list. Nothing was saved.");
  if (!/\$\s?\d/.test(price)) fail("Enter the price you approve, including the dollar amount. Jarvis will not price the job.");
  const key = `offer:${prospect.toLowerCase()}:${scope.toLowerCase()}:${price}`;
  if (!remember(state, key, `Offer for ${prospect}`, at)) return { created: false, duplicate: true, sent: false };
  const saved = draft(state, {
    id: randomUUID(),
    business: "website-agency",
    kind: "outreach",
    title: `Offer for ${prospect}`.slice(0, 120),
    body: `Prospect: ${prospect}\nScope: ${scope}\nPrice: ${price}\nDeadline: ${deadline}\nNext: ${next}\n\nSource: the terms you entered. This was not sent.`,
    status: "needs-christian",
    externalAction: "not_performed",
    createdAt: at,
    decisionKey: key,
  });
  log(state, at, `Prepared an offer for ${prospect} at ${price}. It is waiting on you. Nothing was sent.`);
  return { created: true, duplicate: false, draft: saved, sent: false };
}

export function saveFollowUp(state, input, now = new Date()) {
  const prospect = clean(input?.prospect, 80);
  const note = clean(input?.note, 800);
  const at = new Date(now).toISOString();
  if (prospect.length < 2 || note.length < 8) fail("Name the prospect and write the follow-up from facts you have.");
  if (blocked(prospect) || blocked(note)) fail("That name is on the exclusion list. Nothing was saved.");
  const key = `follow:${prospect.toLowerCase()}:${note.toLowerCase()}`;
  if (!remember(state, key, `Follow up ${prospect}`, at)) return { created: false, duplicate: true, sent: false };
  const saved = draft(state, {
    id: randomUUID(),
    business: "website-agency",
    kind: "outreach",
    title: `Follow up: ${prospect}`.slice(0, 120),
    body: `${note}\n\nSource: the note you wrote. This was not sent.`,
    status: "draft",
    externalAction: "not_performed",
    createdAt: at,
    decisionKey: key,
  });
  log(state, at, `Saved one follow-up for ${prospect}. Nothing was sent.`);
  return { created: true, duplicate: false, draft: saved, sent: false };
}

export function saveBrief(state, input, now = new Date()) {
  const title = clean(input?.title, 120);
  const outline = clean(input?.outline, 800);
  const at = new Date(now).toISOString();
  if (title.length < 3 || outline.length < 8) fail("Add the content title and the outline you want used. Jarvis will not invent a post.");
  const key = `brief:${title.toLowerCase()}`;
  if (!remember(state, key, `Brief ${title}`, at)) return { created: false, duplicate: true, published: false };
  const saved = draft(state, {
    id: randomUUID(),
    business: "buxme",
    kind: "campaign",
    title,
    body: `${outline}\n\nSource: the outline you wrote. This was not published. No signup or revenue number was added.`,
    status: "draft",
    externalAction: "not_performed",
    createdAt: at,
    decisionKey: key,
  });
  log(state, at, `Prepared a Buxme draft titled ${title}. It was not published.`);
  return { created: true, duplicate: false, draft: saved, published: false };
}

export function saveSupplier(state, input, now = new Date()) {
  const supplier = clean(input?.supplier, 80);
  const product = clean(input?.product, 80);
  const shipping = clean(input?.shipping, 200);
  const url = clean(input?.url, 200);
  const at = new Date(now).toISOString();
  if (input?.verified !== true) fail("Confirm that you verified this supplier. Jarvis will not mark a supplier verified.");
  if (supplier.length < 2 || product.length < 2 || shipping.length < 3) fail("Enter the supplier, product, and the shipping fact you verified.");
  if (url && !/^https?:\/\//i.test(url)) fail("The supplier page must start with http:// or https://.");
  const priceBlank = input?.price == null || String(input.price).trim() === "";
  const costBlank = input?.deliveredCost == null || String(input.deliveredCost).trim() === "";
  const price = priceBlank ? null : cents(input.price);
  const delivered = costBlank ? null : cents(input.deliveredCost);
  if (!priceBlank && price == null) fail("Enter the selling price as a dollar amount, or leave it blank.");
  if (!costBlank && delivered == null) fail("Enter the delivered cost you verified, or leave it blank. Jarvis will not estimate it.");
  const margin = price != null && delivered != null ? price - delivered : null;
  const key = `supplier:${supplier.toLowerCase()}:${product.toLowerCase()}:${delivered ?? "unknown"}:${price ?? "unknown"}`;
  if (!remember(state, key, `Supplier ${supplier}`, at)) return { created: false, duplicate: true, purchased: false, published: false };
  const marginText = margin == null ? "unknown until both the selling price and delivered cost are entered" : money(margin);
  const saved = draft(state, {
    id: randomUUID(),
    business: "drivenest",
    kind: "listing",
    title: `Listing draft: ${product}`.slice(0, 120),
    body: `Product: ${product}\nSupplier: ${supplier}\nSupplier page: ${url || "not provided"}\nShipping: ${shipping}\nSelling price: ${price == null ? "not recorded" : money(price)}\nDelivered cost: ${delivered == null ? "not recorded" : money(delivered)}\nMargin: ${marginText}\n\nSource: the supplier facts you verified. This was not published or purchased.`,
    status: "draft",
    externalAction: "not_performed",
    createdAt: at,
    decisionKey: key,
  });
  log(state, at, `Prepared a listing draft for ${product} from ${supplier}. Margin is ${marginText}. Nothing was purchased.`);
  return { created: true, duplicate: false, draft: saved, marginCents: margin, purchased: false, published: false };
}

export function recordClose(state, input, now = new Date()) {
  const prospect = clean(input?.prospect, 80);
  const basis = input?.basis === "deposit" ? "deposit" : input?.basis === "accepted" ? "accepted" : "";
  const at = new Date(now).toISOString();
  if (prospect.length < 2) fail("Name the prospect.");
  if (!basis) fail("Record a close only when the quote was accepted or a deposit was paid.");
  if (blocked(prospect)) fail("That prospect is on the exclusion list. Nothing was saved.");
  const offer = (state.drafts ?? []).find(item => item.business === "website-agency" && item.title === `Offer for ${prospect}`.slice(0, 120));
  if (!offer) fail("Save the offer first. Jarvis will not close a job that has no price you approved.");
  const paid = basis === "deposit" ? cents(input?.amount) : null;
  if (basis === "deposit" && paid == null) fail("Enter the deposit amount you received. Jarvis will not guess it.");
  const key = `won:${prospect.toLowerCase()}`;
  if (!remember(state, key, `Won ${prospect}`, at)) return { created: false, duplicate: true, called: false, sent: false };
  state.leads ??= [];
  const lead = state.leads.find(item => item.business === "website-agency" && item.name.toLowerCase() === prospect.toLowerCase());
  if (lead) lead.stage = "won";
  else if (state.leads.length < 200) {
    state.leads.push({ id: randomUUID(), business: "website-agency", name: prospect, url: "", note: "Closed from the offer you priced.", stage: "won", createdAt: at, decisionKey: key, qualified: false });
  }
  offer.status = "recorded";
  const reason = basis === "deposit" ? `a deposit of ${money(paid)} was paid` : "you marked the quote accepted";
  log(state, at, `Recorded ${prospect} as won because ${reason}. Nothing was sent and nobody was called.`);
  return { created: true, duplicate: false, won: true, called: false, sent: false, amountCents: paid };
}

export function connectionChecklist(env = process.env) {
  const present = name => Boolean(String(env?.[name] ?? "").trim());
  return {
    inbox: {
      configured: present("RESEND_API_KEY") && present("JARVIS_AGENCY_INBOX"),
      requiredEnv: ["RESEND_API_KEY", "JARVIS_AGENCY_INBOX"],
      unlocks: "Reading one agency inbox. Jarvis still does not send mail.",
    },
    memory: {
      configured: present("UPSTASH_REDIS_REST_URL") && present("UPSTASH_REDIS_REST_TOKEN"),
      requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      unlocks: "Keeping tasks, drafts, and decisions after a restart.",
    },
    phone: {
      configured: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "JARVIS_VERIFIED_PHONE_NUMBER", "JARVIS_PUBLIC_ORIGIN"].every(present),
      requiredEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "JARVIS_VERIFIED_PHONE_NUMBER", "JARVIS_PUBLIC_ORIGIN"],
      unlocks: "Calling only the verified number, from 8:00 AM to 9:00 PM ET, after you approve that call.",
    },
  };
}

export function recoverCheck(state, error, now = new Date()) {
  const at = new Date(now).toISOString();
  const detail = clean(error?.message, 160) || "unknown error";
  log(state, at, `The check stopped: ${detail}. Saved work was kept. Nothing was sent, published, or purchased.`);
  return { recovered: true, sent: false };
}
