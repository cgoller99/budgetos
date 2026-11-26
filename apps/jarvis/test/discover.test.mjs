import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { chooseWork, industryFor, pageEvidence, pipeline, publicHttpUrl, searchBusinesses } from "../lib/discover.mjs";
import { createTask, reviewTask } from "../lib/worker.mjs";

const now = new Date("2026-11-25T15:00:00Z");
const day = "2026-11-25";
const access = { buxme: "required", userId: "demo-admin" };

function town() {
  return { ok: true, json: async () => [
    { type: "administrative", addresstype: "county", display_name: "Decatur County, Georgia, United States", boundingbox: ["30.69", "31.07", "-84.87", "-84.37"] },
    { type: "administrative", addresstype: "town", display_name: "Decatur, Georgia, United States", boundingbox: ["33.75", "33.79", "-84.32", "-84.27"] },
  ] };
}

function elementsFor(industry) {
  const tag = { [industry.key]: industry.value };
  return [
    { type: "node", id: 1, tags: { name: "Example Dental", ...tag } },
    { type: "node", id: 2, tags: { name: "Example Legal", ...tag, website: "https://facebook.com/examplelegal" } },
    { type: "node", id: 3, tags: { name: "Healthy Cafe", ...tag, website: "https://healthy.example" } },
    { type: "node", id: 4, tags: { name: "Reynolds and Sons Automotive", ...tag } },
    { type: "node", id: 5, tags: { name: "Old Shop", ...tag, website: "http://oldshop.home.comcast.net" } },
    { type: "node", id: 6, tags: { name: "Wrong Trade", amenity: "not-the-query" } },
    { type: "node", id: 7, tags: { name: "Local Only", ...tag, website: "http://127.0.0.1/secret" } },
  ];
}

function mapFetch(elements) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const address = String(url);
    calls.push({ address, body: options.body ?? "" });
    if (address.includes("nominatim")) return town();
    if (address.includes("overpass")) return { ok: true, json: async () => ({ elements }) };
    if (address.startsWith("https://stale.example")) return { ok: true, url: address, headers: { get: () => "text/html" }, text: async () => "Copyright 2012" };
    throw new Error(`unexpected ${address}`);
  };
  return { calls, fetchImpl };
}

test("revenue counts only a contacted deposit or sale", () => {
  const discovered = { business: "website-agency", source: "openstreetmap", stage: "discovered", contacted: false, depositCents: 50000 };
  assert.equal(pipeline({ leads: [discovered], drafts: [] }).revenueCents, 0);
  assert.equal(pipeline({ leads: [discovered], drafts: [] }).discovered, 1);
  assert.equal(pipeline({ leads: [{ ...discovered, stage: "sold" }], drafts: [] }).revenueCents, 0);
  const paid = { business: "website-agency", stage: "deposit", contacted: true, depositCents: 50000 };
  assert.equal(pipeline({ leads: [paid], drafts: [] }).revenueCents, 50000);
  assert.equal(pipeline({ leads: [paid], drafts: [] }).deposits, 1);
  assert.equal(pipeline({ leads: [{ ...paid, stage: "sold", depositCents: 10000 }], drafts: [] }).completed, 1);
  const blank = { business: "website-agency", title: "Offer for Example Dental", body: "Price: blank until you set it." };
  const priced = { ...blank, body: "Price: $2,400" };
  assert.equal(pipeline({ leads: [], drafts: [blank] }).quotes, 0);
  assert.equal(pipeline({ leads: [], drafts: [priced] }).quotes, 1);
});

test("an approval outranks an unpriced offer", () => {
  const offer = chooseWork({ drafts: [{ kind: "offer", status: "draft", title: "Offer for Example Dental", business: "website-agency" }], settings: { discoveryArea: "Decatur, Georgia" } });
  assert.match(offer.reason, /needs a price/);
  assert.match(offer.reason, /not revenue/);
  const waiting = chooseWork({ drafts: [{ status: "needs-christian", title: "Reply to Northline Dental", business: "website-agency" }, { kind: "offer", status: "draft", title: "Offer for Example Dental" }] });
  assert.match(waiting.reason, /Reply to Northline Dental/);
  assert.match(chooseWork({}).reason, /None have been invented/);
});

test("page evidence and private urls stay factual", () => {
  assert.match(pageEvidence("This domain is parked", now), /unfinished or for sale/);
  assert.match(pageEvidence("Copyright 2014", now), /2014/);
  assert.equal(pageEvidence("© 2014 copyright 2024", now), "");
  assert.equal(publicHttpUrl("http://127.0.0.1/secret"), "");
  assert.equal(publicHttpUrl("http://10.0.0.8/cost"), "");
  assert.equal(publicHttpUrl("https://user:pass@healthy.example"), "");
  assert.equal(industryFor(new Date("2026-01-01T15:00:00Z")).id, "dental");
});

test("a saved city stores only evidenced businesses and an unpriced offer", async () => {
  const industry = industryFor(now);
  const map = mapFetch(elementsFor(industry));
  const dir = await mkdtemp(join(tmpdir(), "jarvis-find-"));
  const app = createApp({ dataDir: dir, env: {}, fetchImpl: map.fetchImpl, now: () => now.getTime() });
  await app.store.update(day, state => {
    state.settings.discoveryArea = "Decatur, Georgia";
    reviewTask(state, createTask(state, { title: "Prepare scanner notes", business: "drivenest", detail: "Supplier cost is unknown." }, {}).id, "approved");
  });
  const first = await app.collectInbox();
  const second = await app.collectInbox();
  assert.equal(first.sent, false);
  assert.equal(first.run.action, "approved");
  assert.equal(first.worker.completed.length, 1);
  assert.equal(second.sent, false);
  assert.equal(map.calls.filter(call => call.address.includes("overpass")).length, 1);
  assert.match(map.calls.find(call => call.address.includes("overpass")).body, /33\.75/);
  assert.doesNotMatch(map.calls.find(call => call.address.includes("overpass")).body, /30\.69/);
  const saved = await app.store.read(day);
  assert.deepEqual(saved.leads.map(lead => lead.name), ["Example Dental", "Example Legal", "Old Shop"]);
  assert.equal(saved.leads.every(lead => lead.contacted === false && lead.stage === "discovered" && lead.source === "openstreetmap"), true);
  assert.equal(saved.reports.at(-1).pipeline.revenueCents, 0);
  assert.equal(saved.reports.at(-1).pipeline.discovered, 3);
  assert.equal(saved.reports.at(-1).pipeline.contacted, 0);
  assert.match(saved.drafts[0].body, /not been contacted/);
  assert.match(saved.drafts[0].body, /not revenue/);
  assert.doesNotMatch(saved.drafts[0].body, /\$\s?\d/);
  assert.match(saved.logs.map(entry => entry.message).join(" "), /exclusion list/);
  assert.match(saved.reports.at(-1).blocked.join(" "), /No campaign was ranked/);
  assert.match(saved.reports.at(-1).blocked.join(" "), /No DriveNest product was recommended/);
  assert.match(saved.reports.at(-1).choice, /Offer for Example Dental/);
});

test("an outdated page is evidence and a failed lookup invents nothing", async () => {
  const industry = industryFor(now);
  const stale = [{ type: "node", id: 9, tags: { name: "Stale Page Dental", [industry.key]: industry.value, website: "https://stale.example" } }];
  const found = await searchBusinesses({ area: "Decatur, Georgia", now, fetchImpl: mapFetch(stale).fetchImpl });
  assert.equal(found.prospects.length, 1);
  assert.match(found.prospects[0].evidence, /2012/);
  const huge = mapFetch([]);
  huge.fetchImpl = async (url) => {
    if (String(url).includes("nominatim")) return { ok: true, json: async () => [{ type: "city", addresstype: "city", display_name: "Georgia, United States", boundingbox: ["30.0", "35.0", "-86.0", "-80.0"] }] };
    throw new Error("overpass should not run");
  };
  const tooBig = await searchBusinesses({ area: "Georgia", now, fetchImpl: huge.fetchImpl });
  assert.equal(tooBig.prospects.length, 0);
  assert.match(tooBig.error, /too large/);
  const missing = await searchBusinesses({ area: "Nowhereville, Georgia", now, fetchImpl: async (url) => String(url).includes("nominatim") ? { ok: true, json: async () => [] } : { ok: false, status: 500 } });
  assert.match(missing.error, /not found/);
  assert.equal(missing.prospects.length, 0);
});

test("the daily check does not search or invent prospects until a city is saved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-quiet-"));
  let called = false;
  const app = createApp({ dataDir: dir, env: {}, fetchImpl: async () => { called = true; throw new Error("no"); }, now: () => now.getTime() });
  await app.collectInbox();
  assert.equal(called, false);
  const saved = await app.store.read(day);
  assert.equal(saved.leads.length, 0);
  assert.match(saved.reports[0].accomplished[0], /No prospects were invented/);
});

test("the city route refuses a blank city and does not contact anyone", async () => {
  const industry = industryFor(now);
  const map = mapFetch(elementsFor(industry));
  const dir = await mkdtemp(join(tmpdir(), "jarvis-city-"));
  const app = createApp({ dataDir: dir, env: {}, fetchImpl: map.fetchImpl, now: () => now.getTime() });
  const post = (area) => app.handle(new Request("http://127.0.0.1/api/discovery", {
    method: "POST", headers: { "content-type": "application/json", "x-jarvis-client": "dashboard" }, body: JSON.stringify({ area }),
  }), access);
  const bad = await post(" ");
  assert.equal(bad.status, 400);
  const response = await post("Decatur, Georgia");
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.sent, false);
  assert.equal(body.contacted, false);
  assert.equal(body.report.pipeline.revenueCents, 0);
  const repeat = await post("Decatur, Georgia");
  assert.equal(repeat.status, 200);
  assert.equal(map.calls.filter(call => call.address.includes("nominatim")).length, 1);
});
