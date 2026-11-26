import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { connectionChecklist, recordClose, recoverCheck, saveBrief, saveOffer, saveProspect, saveSupplier } from "../lib/close.mjs";

const now = new Date("2026-11-26T15:00:00Z");
const access = { buxme: "required", userId: "demo-admin" };

async function post(app, path, body) {
  return app.handle(new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-jarvis-client": "dashboard" },
    body: JSON.stringify(body),
  }), access);
}

test("a prospect is qualified once and an excluded name is refused", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-close-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  const saved = await post(app, "/api/prospects", { name: "Harbor Dental", url: "https://harbor.example", note: "Five-page site, asked about timing." });
  const again = await post(app, "/api/prospects", { name: "Harbor Dental", url: "https://harbor.example", note: "Five-page site, asked about timing." });
  assert.equal(saved.status, 201);
  const body = await saved.json();
  assert.equal(body.contacted, false);
  assert.equal(body.lead.stage, "drafted");
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
  const blocked = await post(app, "/api/prospects", { name: "Reynolds and Sons Automotive", note: "They want a new website soon." });
  assert.equal(blocked.status, 400);
  const state = await app.store.read("2026-11-26");
  assert.equal(state.leads.length, 1);
});

test("an offer keeps the price you entered and is not sent twice", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-offer-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  const missing = await post(app, "/api/offers", { prospect: "Harbor Dental", scope: "Five pages", price: "about two thousand", deadline: "December", next: "Send the preview after approval" });
  assert.equal(missing.status, 400);
  const offer = { prospect: "Harbor Dental", scope: "Five pages", price: "$2,400", deadline: "December 20", next: "Review the preview" };
  const saved = await post(app, "/api/offers", offer);
  const again = await post(app, "/api/offers", offer);
  assert.equal(saved.status, 201);
  const body = await saved.json();
  assert.equal(body.sent, false);
  assert.match(body.draft.body, /\$2,400/);
  assert.match(body.draft.body, /not sent/);
  assert.equal((await again.json()).duplicate, true);
  const state = await app.store.read("2026-11-26");
  assert.equal(state.drafts.length, 1);
});

test("the same follow-up is not saved twice", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-follow-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  const note = "Ask whether Thursday still works for the preview.";
  const first = await post(app, "/api/follow-ups", { prospect: "Harbor Dental", note });
  const second = await post(app, "/api/follow-ups", { prospect: "Harbor Dental", note });
  assert.equal(first.status, 201);
  assert.equal((await first.json()).sent, false);
  assert.equal((await second.json()).duplicate, true);
  assert.equal((await app.store.read("2026-11-26")).drafts.length, 1);
});

test("a close requires the priced offer and does not place a call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-won-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  const early = await post(app, "/api/closes", { prospect: "Harbor Dental", basis: "accepted" });
  assert.equal(early.status, 400);
  const offer = await post(app, "/api/offers", { prospect: "Harbor Dental", scope: "Five pages", price: "$2,400", deadline: "December 20", next: "Start the preview" });
  assert.equal(offer.status, 201);
  const won = await post(app, "/api/closes", { prospect: "Harbor Dental", basis: "accepted" });
  assert.equal(won.status, 201);
  const body = await won.json();
  assert.equal(body.called, false);
  assert.equal(body.sent, false);
  const repeat = await post(app, "/api/closes", { prospect: "Harbor Dental", basis: "deposit", amount: "500" });
  assert.equal((await repeat.json()).duplicate, true);
  const state = await app.store.read("2026-11-26");
  assert.equal(state.calls, undefined);
  assert.equal(state.drafts[0].status, "recorded");
  assert.equal(state.leads[0].stage, "won");
  assert.match(state.logs.at(-1).message, /nobody was called/i);
});

test("a deposit is recorded only when the amount is entered", () => {
  const state = { drafts: [{ business: "website-agency", title: "Offer for Harbor Dental", status: "needs-christian" }], leads: [], logs: [], decisions: [] };
  assert.throws(() => recordClose(state, { prospect: "Harbor Dental", basis: "deposit" }, now), /deposit amount/);
  const saved = recordClose(state, { prospect: "Harbor Dental", basis: "deposit", amount: "500" }, now);
  assert.equal(saved.amountCents, 50000);
  assert.equal(saved.called, false);
});

test("a content outline is saved once and does not invent a signup count", () => {
  const state = { drafts: [], logs: [], decisions: [] };
  const first = saveBrief(state, { title: "Sunday budget tip", outline: "Show the empty paycheck screen and the one next step." }, now);
  const second = saveBrief(state, { title: "Sunday budget tip", outline: "A different outline still uses the same title." }, now);
  assert.equal(first.published, false);
  assert.equal(second.duplicate, true);
  assert.equal(state.drafts.length, 1);
  assert.equal(/\d+\s+signups?/i.test(state.drafts[0].body), false);
});

test("supplier margin stays unknown until both verified numbers exist", () => {
  const state = { drafts: [], logs: [], decisions: [] };
  assert.throws(() => saveSupplier(state, { supplier: "Northline Supply", product: "Red V410", shipping: "USPS Ground", verified: false }, now), /verified/);
  const held = saveSupplier(state, { supplier: "Northline Supply", product: "Red V410", shipping: "USPS Ground, 5 days", verified: true }, now);
  assert.equal(held.marginCents, null);
  assert.equal(held.purchased, false);
  assert.match(held.draft.body, /Margin: unknown/);
  assert.equal(held.draft.body.includes("$"), false);
  const priced = saveSupplier(state, { supplier: "Northline Supply", product: "Red V410", shipping: "USPS Ground, 5 days", verified: true, price: "199", deliveredCost: "140.50" }, now);
  assert.equal(priced.marginCents, 5850);
  assert.match(priced.draft.body, /not published or purchased/);
  assert.equal(saveSupplier(state, { supplier: "Northline Supply", product: "Red V410", shipping: "USPS Ground, 5 days", verified: true, price: "199", deliveredCost: "140.50" }, now).duplicate, true);
});

test("connection setup names variables and does not reveal values", () => {
  const guide = connectionChecklist({ RESEND_API_KEY: "secret-value", JARVIS_AGENCY_INBOX: "agency@buxme.co", TWILIO_AUTH_TOKEN: "hidden" });
  assert.equal(guide.inbox.configured, true);
  assert.equal(guide.memory.configured, false);
  assert.equal(guide.phone.configured, false);
  assert.equal(JSON.stringify(guide).includes("secret-value"), false);
  assert.equal(JSON.stringify(guide).includes("hidden"), false);
  const state = { logs: [] };
  const recovered = recoverCheck(state, new Error("worker crashed"), now);
  assert.equal(recovered.sent, false);
  assert.match(state.logs[0].message, /Saved work was kept/);
});

test("a short qualification note is refused", () => {
  const state = { leads: [], logs: [], decisions: [] };
  assert.throws(() => saveProspect(state, { name: "Harbor Dental", note: "site" }, now), /will not invent/);
  assert.equal(state.leads.length, 0);
  assert.equal(saveOffer(state, { prospect: "Harbor", scope: "Pages", price: "$20", deadline: "Friday", next: "Wait" }, now).sent, false);
});
