import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { advanceMoney, chooseFocus, moneyReport, saveMoney } from "../lib/pipeline.mjs";

const now = new Date("2026-11-26T15:00:00Z");
const access = { buxme: "required", userId: "demo-admin" };

async function post(app, body) {
  return app.handle(new Request("http://127.0.0.1/api/money", {
    method: "POST",
    headers: { "content-type": "application/json", "x-jarvis-client": "dashboard" },
    body: JSON.stringify(body),
  }), access);
}

test("a prospect is scored from entered facts and an excluded name is refused", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-money-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  const saved = await post(app, { kind: "prospect", name: "Harbor Dental", industry: "dental", url: "https://harbor.example", note: "The homepage is a Facebook link and they asked about a five-page site.", budget: "$2000", noWebsite: true, asked: true });
  assert.equal(saved.status, 201);
  const body = await saved.json();
  assert.equal(body.called, false);
  assert.equal(body.lead.score, 10);
  assert.match(body.lead.scoreNote, /not a revenue prediction/);
  const restaurant = await post(app, { kind: "prospect", name: "Maple Spoon", industry: "restaurant", note: "Menu is a PDF and they asked for a site." });
  assert.equal(restaurant.status, 201);
  const blocked = await post(app, { kind: "prospect", name: "Reynolds and Sons Automotive", industry: "automotive", note: "They want a new website soon." });
  assert.equal(blocked.status, 400);
  const again = await post(app, { kind: "prospect", name: "Harbor Dental", industry: "dental", note: "The homepage is a Facebook link and they asked about a five-page site." });
  assert.equal((await again.json()).duplicate, true);
});

test("an offer, follow-up, and payment stay unsent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-sale-"));
  const app = createApp({ dataDir: dir, env: {}, now: () => now.getTime() });
  await post(app, { kind: "prospect", name: "Harbor Dental", industry: "dental", note: "They asked about a five-page site." });
  const missing = await post(app, { kind: "offer", prospect: "Harbor Dental", scope: "Five pages", concept: "A five-page dental site", price: "about two thousand", deadline: "December", next: "Review it" });
  assert.equal(missing.status, 400);
  const offer = await post(app, { kind: "offer", prospect: "Harbor Dental", scope: "Five pages", concept: "A five-page dental site with booking", price: "$2,400", deadline: "December 20", next: "Review the preview" });
  assert.equal(offer.status, 201);
  assert.equal((await offer.json()).sent, false);
  const follow = await post(app, { kind: "follow-up", prospect: "Harbor Dental", note: "Ask if Thursday still works.", date: "2026-11-20" });
  assert.equal(follow.status, 201);
  const paid = await post(app, { kind: "payment", prospect: "Harbor Dental", basis: "deposit", amount: "500" });
  assert.equal(paid.status, 201);
  assert.equal((await paid.json()).called, false);
  const repeat = await post(app, { kind: "payment", prospect: "Harbor Dental", basis: "accepted" });
  assert.equal((await repeat.json()).duplicate, true);
  const state = await app.store.read("2026-11-26");
  assert.equal(state.calls, undefined);
  assert.equal(moneyReport(state).agency.payingCustomers, 1);
  assert.equal(moneyReport(state).agency.recordedDepositsCents, 50000);
  const focus = chooseFocus(state, now);
  assert.match(focus.reason, /Follow up: Harbor Dental/);
});

test("content and products do not invent performance or demand", () => {
  const state = { drafts: [], leads: [], logs: [], decisions: [], tasks: [], products: [] };
  assert.throws(() => saveMoney(state, { kind: "brief", title: "Tip", outline: "short" }, now), /outline/);
  const brief = saveMoney(state, { kind: "brief", title: "Sunday budget tip", outline: "Show the empty paycheck screen and one next step." }, now);
  assert.equal(brief.published, undefined);
  assert.equal(state.drafts[0].body.includes("not connected"), true);
  assert.throws(() => saveMoney(state, { kind: "product", name: "Red V410", demand: "popular", supplier: "Northline", shipping: "USPS 5 days", verified: true }, now), /demand/);
  assert.throws(() => saveMoney(state, { kind: "product", name: "Red V410", demand: "Shops asked for this scanner twice.", supplier: "Northline", shipping: "USPS 5 days", verified: false }, now), /verified/);
  const priced = saveMoney(state, { kind: "product", name: "Red V410", demand: "Two shops asked for this scanner.", supplier: "Northline", shipping: "USPS Ground, 5 days", price: "199", deliveredCost: "140.50", verified: true }, now);
  assert.equal(priced.product.marginCents, 5850);
  assert.match(priced.product.recommendation, /not a sales forecast/);
  assert.equal(priced.purchased, undefined);
  const first = advanceMoney(state, now);
  const second = advanceMoney(state, now);
  assert.equal(first.step === "checklist" || first.step === "content" || first.step === "idle", true);
  assert.equal(second.step, "idle");
  assert.equal(JSON.stringify(moneyReport(state)).includes("signup count"), false);
});

test("a high score prospect gets one checklist and a second check does not repeat it", () => {
  const state = { drafts: [], leads: [], logs: [], decisions: [], tasks: [] };
  saveMoney(state, { kind: "prospect", name: "Harbor Dental", industry: "dental", url: "https://harbor.example", note: "The current page is only a Facebook link and they asked for a quote.", noWebsite: true, asked: true, budget: "$2000" }, now);
  assert.equal(advanceMoney(state, now).step, "checklist");
  assert.match(state.drafts.at(-1).body, /will not invent the design or the price/);
  assert.equal(state.drafts.at(-1).body.includes("$"), false);
  assert.equal(advanceMoney(state, now).step, "content");
  const briefs = state.drafts.filter(item => item.business === "buxme");
  assert.equal(briefs.length, 1);
  assert.match(briefs[0].body, /not connected/);
});

test("the empty desk does not invent a margin or a signup count", async () => {
  const { businessDesk } = await import("../lib/operator.mjs");
  const desk = businessDesk({ drafts: [], logs: [] });
  assert.match(desk.buxme.answer, /not connected/);
  assert.match(desk.drivenest.answer, /margin is unknown/);
  assert.equal(desk.drivenest.blocker.includes("$"), false);
  assert.equal(desk.buxme.progress.join(" ").includes("$"), false);
  assert.match(desk.agency.progress.join(" "), /not connected/);
});
