import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { advanceBusinesses, describeBusinesses, saveBuxmeReading, saveProductCost } from "../lib/operations.mjs";
import { businessDesk } from "../lib/operator.mjs";

const now = new Date("2026-11-26T15:00:00Z");

test("one saved agency lead becomes one follow-up and a second check does not repeat it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-ops-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  await app.store.update("2026-11-26", state => {
    state.leads.push({
      id: "11111111-1111-4111-8111-111111111111",
      business: "website-agency",
      name: "Harbor Dental",
      url: "https://harbor.example",
      note: "They need a five page site and asked for a timeline.",
      stage: "new",
      createdAt: "2026-11-26T14:00:00Z",
    });
  });
  const first = await app.collectInbox();
  const second = await app.collectInbox();
  assert.equal(first.sent, false);
  assert.equal(first.work.agency.action, "draft");
  assert.equal(second.work.agency.action, "none");
  const saved = await app.store.read("2026-11-26");
  assert.equal(saved.drafts.length, 1);
  assert.equal(saved.drafts[0].externalAction, "not_performed");
  assert.match(saved.drafts[0].body, /not sent or published/);
  assert.equal(saved.leads[0].stage, "drafted");
});

test("a responded prospect is prepared before a new lead, and an excluded name is skipped", () => {
  const state = {
    leads: [
      { id: "new", business: "website-agency", name: "New Shop", note: "Needs a homepage and a booking page.", stage: "new" },
      { id: "won", business: "website-agency", name: "Paying Dental", note: "Accepted the page list.", stage: "responded" },
      { id: "skip", business: "website-agency", name: "Reynolds and Sons Automotive", note: "They want a website rebuild soon.", stage: "new" },
    ],
    drafts: [],
    logs: [],
    inbox: [],
  };
  const first = advanceBusinesses(state, now);
  const second = advanceBusinesses(state, now);
  assert.equal(first.agency.action, "draft");
  assert.equal(state.drafts[0].title.includes("Paying Dental"), true);
  assert.equal(second.agency.action, "draft");
  assert.equal(state.drafts[1].title.includes("New Shop"), true);
  assert.equal(state.drafts.some(draft => /Reynolds/.test(draft.title)), false);
  assert.equal(advanceBusinesses(state, now).agency.action, "none");
});

test("an interested reply gets one quote checklist and no invented price", () => {
  const state = {
    leads: [],
    inbox: [{ messageId: "msg-quote-0001", from: "Northline Dental", interested: true, excluded: false, draftId: "draft-1" }],
    drafts: [{ id: "draft-1", title: "Reply to Northline Dental", body: "Thanks for writing.", status: "needs-christian" }],
    logs: [],
  };
  assert.equal(advanceBusinesses(state, now).agency.action, "quote");
  assert.equal(advanceBusinesses(state, now).agency.action, "none");
  assert.equal(state.drafts.length, 1);
  assert.equal(state.drafts[0].quote.price, "");
  assert.match(state.drafts[0].body, /Nothing was priced or sent/);
  assert.equal(state.drafts[0].body.includes("$"), false);
});

test("Buxme counts are stored once and a missing reading invents nothing", () => {
  const state = { logs: [], drafts: [] };
  const reading = { users: 12, activeUsers7d: 4, applePaid: 2, stripePaid: 1, paidUsers: 3, stripeReported: false };
  assert.equal(saveBuxmeReading(state, reading, now).recorded, true);
  assert.equal(saveBuxmeReading(state, reading, now).duplicate, true);
  assert.equal(state.logs.length, 1);
  assert.match(describeBusinesses(state).buxme.answer, /2 paid through Apple/);
  assert.match(describeBusinesses(state).buxme.answer, /1 paid through Stripe/);
  assert.match(describeBusinesses(state).buxme.answer, /Nothing was published/);
  const empty = businessDesk({ drafts: [], logs: [] });
  assert.match(empty.buxme.answer, /not connected/);
  assert.match(empty.drivenest.answer, /margin is unknown/);
  assert.equal(empty.drivenest.blocker.includes("$"), false);
});

test("a verified delivered cost computes margin and does not purchase", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-cost-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  const saved = await app.handle(new Request("http://127.0.0.1/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", "x-jarvis-client": "dashboard" },
    body: JSON.stringify({ name: "Red V410", deliveredCost: "140.50", price: "199" }),
  }), { buxme: "required", userId: "demo-admin" });
  assert.equal(saved.status, 201);
  const body = await saved.json();
  assert.equal(body.purchased, false);
  assert.equal(body.published, false);
  assert.equal(body.product.marginCents, 5850);
  const again = await app.handle(new Request("http://127.0.0.1/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", "x-jarvis-client": "dashboard" },
    body: JSON.stringify({ name: "Red V410", deliveredCost: "150", price: "199" }),
  }), { buxme: "required", userId: "demo-admin" });
  assert.equal(again.status, 201);
  const state = await app.store.read("2026-11-26");
  assert.equal(state.products.length, 1);
  assert.equal(state.drafts.length, 1);
  assert.match(state.drafts[0].body, /\$150\.00/);
  assert.match(state.drafts[0].body, /not published or purchased/);
  const unknown = { products: [], drafts: [], logs: [] };
  assert.throws(() => saveProductCost(unknown, { name: "Red V410", deliveredCost: "about 40" }, now), /will not estimate/);
  assert.equal(unknown.products.length, 0);
  const held = saveProductCost({ products: [], drafts: [], logs: [] }, { name: "Red V410", deliveredCost: "140" }, now);
  assert.equal(held.product.marginCents, null);
  assert.match(describeBusinesses({ products: [held.product], drafts: [], logs: [] }).drivenest.answer, /margin is unknown/);
});
