import { randomUUID } from "node:crypto";

export const INDUSTRIES = ["dental", "legal", "home services", "restaurant", "fitness", "retail", "professional", "automotive", "other"];
const BLOCKED = [/atlanta auto diesel/i, /reynolds(?: and sons| & sons)/i];
const IDEAS = [
  ["Payday check", "Show the paycheck screen, then one bill moved before payday."],
  ["Over one category", "Show one category past its number and the next tap."],
  ["Sunday setup", "Show a short Sunday check of what is due this week."],
  ["Looking versus subscribing", "Show the screen where someone can subscribe. Do not claim a signup count."],
];

function clean(value, max) {
  return String(value ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}
function fail(message) {
  throw Object.assign(new Error(message), { status: 400 });
}
function blocked(value) {
  return BLOCKED.some(pattern => pattern.test(String(value ?? "")));
}
function cents(value) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim().replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}
export function formatMoney(centsValue) {
  const sign = centsValue < 0 ? "-" : "";
  const absolute = Math.abs(centsValue);
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
function dayKey(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(now));
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
function prospect(state, name) {
  return (state.leads ?? []).find(item => item.business === "website-agency" && item.name.toLowerCase() === name.toLowerCase());
}

export function scoreProspect(input) {
  const signals = [];
  let score = 0;
  if (input.noWebsite === true) { score += 3; signals.push("no website"); }
  if (input.asked === true) { score += 3; signals.push("they asked"); }
  if (Number.isInteger(input.budgetCents)) { score += 2; signals.push("they named a budget"); }
  if (input.url) { score += 1; signals.push("page recorded"); }
  if (String(input.note ?? "").length >= 40) { score += 1; signals.push("specific note"); }
  const band = score >= 8 ? "more of the recorded buying signals" : score >= 4 ? "some recorded signals" : "few recorded signals";
  return { score, note: `Score ${score} of 10 from the facts you entered (${band}). ${signals.join(", ") || "No buying signal was entered."} This is not a revenue prediction.` };
}

export function saveMoney(state, input, now = new Date()) {
  const kind = String(input?.kind ?? "");
  if (kind === "prospect") return saveProspect(state, input, now);
  if (kind === "offer") return saveOffer(state, input, now);
  if (kind === "follow-up") return saveFollowUp(state, input, now);
  if (kind === "payment") return savePayment(state, input, now);
  if (kind === "brief") return saveBrief(state, input, now);
  if (kind === "product") return saveProduct(state, input, now);
  fail("Unknown money step.");
}

function saveProspect(state, input, now) {
  const name = clean(input?.name, 80);
  const note = clean(input?.note, 800);
  const url = clean(input?.url, 200);
  const industry = clean(input?.industry, 40).toLowerCase();
  const at = new Date(now).toISOString();
  if (name.length < 2) fail("Name the prospect.");
  if (!INDUSTRIES.includes(industry)) fail("Choose an industry. Jarvis will not invent the business.");
  if (blocked(name) || blocked(note)) fail("That name is on the exclusion list. Nothing was saved.");
  if (note.length < 8) fail("Add why this business may need a website. Jarvis will not invent the reason.");
  if (url && !/^https?:\/\//i.test(url)) fail("The page must start with http:// or https://.");
  const budgetBlank = input?.budget == null || String(input.budget).trim() === "";
  const budgetCents = budgetBlank ? null : cents(input.budget);
  if (!budgetBlank && budgetCents == null) fail("Enter the budget they named, including the dollar amount, or leave it blank.");
  state.leads ??= [];
  if (state.leads.length >= 200) fail("Lead list is full.");
  const key = `prospect:${name.toLowerCase()}`;
  if (!remember(state, key, `Prospect ${name}`, at)) return { created: false, duplicate: true };
  const scored = scoreProspect({ noWebsite: input?.noWebsite === true, asked: input?.asked === true, budgetCents, url, note });
  const lead = { id: randomUUID(), business: "website-agency", name, url, note, industry, stage: "discovered", score: scored.score, scoreNote: scored.note, noWebsite: input?.noWebsite === true, asked: input?.asked === true, budgetCents, createdAt: at, decisionKey: key };
  state.leads.push(lead);
  log(state, at, `Recorded ${name} (${industry}). ${scored.note} Nobody was contacted.`);
  return { created: true, duplicate: false, lead };
}

function saveOffer(state, input, now) {
  const name = clean(input?.prospect, 80);
  const scope = clean(input?.scope, 160);
  const price = clean(input?.price, 40);
  const concept = clean(input?.concept, 400);
  const deadline = clean(input?.deadline, 80);
  const next = clean(input?.next, 160);
  const at = new Date(now).toISOString();
  const lead = prospect(state, name);
  if (!lead) fail("Record the prospect first. Jarvis will not offer a business it has not qualified.");
  if ([scope, deadline, next].some(value => value.length < 2) || concept.length < 8) fail("An offer needs scope, a concept you wrote, a deadline, and a next step.");
  if (!/\$\s?\d/.test(price)) fail("Enter the price you approve, including the dollar amount. Jarvis will not price the job.");
  const key = `offer:${name.toLowerCase()}:${price}`;
  if (!remember(state, key, `Offer ${name}`, at)) return { created: false, duplicate: true };
  lead.stage = "offered";
  const draft = { id: randomUUID(), business: "website-agency", kind: "outreach", title: `Offer for ${name}`.slice(0, 120), body: `Prospect: ${name}\nIndustry: ${lead.industry}\nScope: ${scope}\nConcept: ${concept}\nPrice: ${price}\nDeadline: ${deadline}\nNext: ${next}\n\nSource: the terms you entered. This was not sent.`, status: "needs-christian", externalAction: "not_performed", createdAt: at, decisionKey: key };
  state.drafts ??= [];
  state.drafts.push(draft);
  log(state, at, `Prepared an offer for ${name} at ${price}. It is waiting on you. Nothing was sent.`);
  return { created: true, duplicate: false, draft };
}

function saveFollowUp(state, input, now) {
  const name = clean(input?.prospect, 80);
  const note = clean(input?.note, 400);
  const date = clean(input?.date, 10);
  const at = new Date(now).toISOString();
  if (!prospect(state, name)) fail("Record the prospect first.");
  if (note.length < 8) fail("Write the follow-up from facts you have.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T13:00:00.000Z`))) fail("Enter the follow-up date as YYYY-MM-DD.");
  const key = `follow:${name.toLowerCase()}:${date}`;
  if (!remember(state, key, `Follow up ${name}`, at)) return { created: false, duplicate: true };
  state.tasks ??= [];
  state.tasks.push({ id: randomUUID(), title: `Follow up: ${name}`.slice(0, 180), detail: note, business: "website-agency", businessName: "Website-building agency", kind: "outreach", risk: "low", priority: 2, status: "proposed", attempts: 0, dueAt: `${date}T13:00:00.000Z`, createdAt: at, audit: [], externalSideEffects: [], decisionKey: key });
  log(state, at, `Follow-up for ${name} is set for ${date}. Nothing was sent.`);
  return { created: true, duplicate: false };
}

function savePayment(state, input, now) {
  const name = clean(input?.prospect, 80);
  const basis = input?.basis === "deposit" ? "deposit" : input?.basis === "accepted" ? "accepted" : "";
  const at = new Date(now).toISOString();
  const lead = prospect(state, name);
  if (!lead) fail("Record the prospect first.");
  if (lead.stage !== "offered" && lead.stage !== "won") fail("Save the offer first. Jarvis will not record a payment for a job with no approved price.");
  if (!basis) fail("Record a payment only when the quote was accepted or a deposit was paid.");
  const paid = basis === "deposit" ? cents(input?.amount) : null;
  if (basis === "deposit" && paid == null) fail("Enter the deposit amount you received. Jarvis will not guess it.");
  const key = `won:${name.toLowerCase()}`;
  if (!remember(state, key, `Won ${name}`, at)) return { created: false, duplicate: true };
  lead.stage = "won";
  lead.depositCents = paid;
  const offer = (state.drafts ?? []).find(item => item.title === `Offer for ${name}`.slice(0, 120));
  if (offer) offer.status = "recorded";
  const reason = basis === "deposit" ? `a deposit of ${formatMoney(paid)} was paid` : "you marked the quote accepted";
  log(state, at, `Recorded ${name} as a paying customer because ${reason}. Nothing was sent and nobody was called.`);
  return { created: true, duplicate: false, amountCents: paid };
}

function saveBrief(state, input, now) {
  const title = clean(input?.title, 120);
  const outline = clean(input?.outline, 800);
  const at = new Date(now).toISOString();
  if (title.length < 3 || outline.length < 8) fail("Add the title and the outline you want used. Jarvis will not invent a post.");
  const key = `brief:${title.toLowerCase()}`;
  if (!remember(state, key, `Brief ${title}`, at)) return { created: false, duplicate: true };
  state.drafts ??= [];
  state.drafts.push({ id: randomUUID(), business: "buxme", kind: "campaign", title, body: `${outline}\n\nSource: the outline you wrote. Not published. Views, downloads, and signups are not connected.`, status: "draft", externalAction: "not_performed", createdAt: at, decisionKey: key });
  log(state, at, `Prepared a Buxme draft titled ${title}. It was not published.`);
  return { created: true, duplicate: false };
}

function saveProduct(state, input, now) {
  const name = clean(input?.name, 80);
  const demand = clean(input?.demand, 400);
  const supplier = clean(input?.supplier, 80);
  const shipping = clean(input?.shipping, 160);
  const at = new Date(now).toISOString();
  if (name.length < 2) fail("Name the product.");
  if (demand.length < 8) fail("Write the demand fact you checked. Jarvis will not invent demand.");
  if (input?.verified !== true) fail("Confirm that you verified this supplier. Jarvis will not recommend an unverified supplier.");
  if (supplier.length < 2 || shipping.length < 3) fail("Enter the supplier and the shipping fact you verified.");
  const priceBlank = input?.price == null || String(input.price).trim() === "";
  const costBlank = input?.deliveredCost == null || String(input.deliveredCost).trim() === "";
  const price = priceBlank ? null : cents(input.price);
  const delivered = costBlank ? null : cents(input.deliveredCost);
  if (!priceBlank && price == null) fail("Enter the selling price as a dollar amount, or leave it blank.");
  if (!costBlank && delivered == null) fail("Enter the delivered cost you verified, or leave it blank. Jarvis will not estimate it.");
  const margin = price != null && delivered != null ? price - delivered : null;
  const key = `product:${name.toLowerCase()}:${delivered ?? "unknown"}:${price ?? "unknown"}`;
  if (!remember(state, key, `Product ${name}`, at)) return { created: false, duplicate: true };
  const marginText = margin == null ? "not recorded" : formatMoney(margin);
  const recommendation = margin == null ? "No product is recommended until both the selling price and delivered cost are entered." : `Recorded margin is ${marginText}. This is not a sales forecast.`;
  const product = { id: randomUUID(), name, supplier, shipping, demand, verified: true, priceCents: price, deliveredCents: delivered, marginCents: margin, marginText, recommendation, createdAt: at };
  state.products ??= [];
  state.products.push(product);
  state.drafts ??= [];
  state.drafts.push({ id: randomUUID(), business: "drivenest", kind: "listing", title: `Listing draft: ${name}`.slice(0, 120), body: `Product: ${name}\nSupplier: ${supplier}\nShipping: ${shipping}\nDemand fact: ${demand}\nSelling price: ${price == null ? "not recorded" : formatMoney(price)}\nDelivered cost: ${delivered == null ? "not recorded" : formatMoney(delivered)}\nMargin: ${marginText}\n${recommendation}\n\nSource: the facts you verified. Nothing was purchased or published.`, status: "draft", externalAction: "not_performed", createdAt: at, decisionKey: key });
  log(state, at, `Prepared a listing draft for ${name}. ${recommendation} Nothing was purchased.`);
  return { created: true, duplicate: false, product };
}

export function moneyReport(state) {
  const leads = (state.leads ?? []).filter(item => item.business === "website-agency");
  const offers = (state.drafts ?? []).filter(item => item.business === "website-agency" && item.title?.startsWith("Offer for "));
  const followUps = (state.tasks ?? []).filter(item => item.title?.startsWith("Follow up:"));
  const won = leads.filter(item => item.stage === "won");
  const deposits = won.reduce((sum, item) => sum + (Number.isInteger(item.depositCents) ? item.depositCents : 0), 0);
  const briefs = (state.drafts ?? []).filter(item => item.business === "buxme");
  const products = state.products ?? [];
  const priced = products.filter(item => Number.isInteger(item.marginCents));
  const largest = priced.reduce((best, item) => best == null || item.marginCents > best.marginCents ? item : best, null);
  return {
    agency: { prospects: leads.length, offers: offers.length, followUps: followUps.length, payingCustomers: won.length, recordedDepositsCents: deposits },
    buxme: { drafts: briefs.length, published: 0 },
    drivenest: { products: products.length, priced: priced.length, largest },
  };
}

export function chooseFocus(state, now = new Date()) {
  const waiting = (state.drafts ?? []).find(item => item.status === "needs-christian");
  if (waiting) return { business: waiting.business, reason: `${waiting.title} needs your decision. Nothing will be sent.` };
  const due = (state.tasks ?? []).find(item => item.dueAt && !["completed", "rejected", "failed"].includes(item.status) && Date.parse(item.dueAt) <= new Date(now).getTime());
  if (due) return { business: due.business || "website-agency", reason: `${due.title} is due. Nothing will be sent until you approve it.` };
  const report = moneyReport(state);
  if (report.agency.payingCustomers < 1) return { business: "website-agency", reason: "No paying customer is recorded. Agency is first until one is." };
  if (report.buxme.drafts < 1) return { business: "buxme", reason: "Agency has a paying customer recorded. Buxme has no content draft yet." };
  if (report.drivenest.priced < 1) return { business: "drivenest", reason: "DriveNest has no product with both a selling price and a delivered cost." };
  return { business: "website-agency", reason: "The recorded goals are met. Nothing will be sent, published, or purchased." };
}

export function advanceMoney(state, now = new Date()) {
  const at = new Date(now).toISOString();
  const day = dayKey(now);
  state.drafts ??= [];
  const ready = (state.leads ?? []).filter(item => item.business === "website-agency" && item.score >= 8 && item.stage === "discovered" && !state.drafts.some(draft => draft.decisionKey === `checklist:${item.name.toLowerCase()}`)).sort((a, b) => b.score - a.score)[0];
  if (ready && remember(state, `checklist:${ready.name.toLowerCase()}`, `Checklist ${ready.name}`, at)) {
    state.drafts.push({ id: randomUUID(), business: "website-agency", kind: "outreach", title: `Offer checklist: ${ready.name}`.slice(0, 120), body: `Industry: ${ready.industry}\n${ready.scoreNote}\n\nAdd the pages, a concept, and the price you approve. Jarvis will not invent the design or the price.\n\nNothing was sent.`, status: "draft", externalAction: "not_performed", createdAt: at, decisionKey: `checklist:${ready.name.toLowerCase()}` });
    log(state, at, `Prepared an offer checklist for ${ready.name}. The price is blank. Nothing was sent.`);
    return { step: "checklist" };
  }
  if (!state.drafts.some(item => item.business === "buxme" && item.decisionKey === `content:${day}`) && remember(state, `content:${day}`, "Buxme idea", at)) {
    const idea = IDEAS[Number(day.slice(-2)) % IDEAS.length];
    state.drafts.push({ id: randomUUID(), business: "buxme", kind: "campaign", title: idea[0], body: `${idea[1]}\n\nSource: a content template. Not filmed. Not published. Views, downloads, and signups are not connected.`, status: "draft", externalAction: "not_performed", createdAt: at, decisionKey: `content:${day}` });
    log(state, at, `No prospect was ready to price. Saved a Buxme idea titled ${idea[0]}. It was not published.`);
    return { step: "content" };
  }
  if (remember(state, `idle:${day}`, "No money step", at)) log(state, at, "No new money step was ready. Nothing was sent, published, or purchased.");
  return { step: "idle" };
}

export function recoverStep(state, error, now = new Date()) {
  log(state, new Date(now).toISOString(), `The check stopped: ${clean(error?.message, 160) || "unknown error"}. Saved work was kept. Nothing was sent, published, or purchased.`);
  return { recovered: true };
}

export function progressLines(state) {
  const report = moneyReport(state);
  const deposits = report.agency.recordedDepositsCents > 0 ? formatMoney(report.agency.recordedDepositsCents) : "none entered";
  const margin = report.drivenest.largest ? `${report.drivenest.largest.name} ${report.drivenest.largest.marginText}` : "not recorded";
  return {
    agency: [`Prospects: ${report.agency.prospects} recorded`, `Offers: ${report.agency.offers} recorded`, `Follow-ups: ${report.agency.followUps} recorded`, `Paying customers: ${report.agency.payingCustomers} recorded`, `Recorded deposits: ${deposits}`, "Collected revenue beyond those deposits: not connected", "Estimates are not shown."],
    buxme: [`Content drafts: ${report.buxme.drafts} recorded`, "Published: 0 recorded", "Views: not connected", "Downloads: not connected", "Signups: not connected", "Subscriptions: not connected", "Estimates are not shown."],
    drivenest: [`Products: ${report.drivenest.products} recorded`, `Priced from your costs: ${report.drivenest.priced} recorded`, `Largest recorded margin: ${margin}`, "Supplier catalog: not connected", "Sales forecast: not shown."],
  };
}
