import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { claimForDial } from "../lib/calls.mjs";
import { applyHostedPass, scannerMargin } from "../lib/nextAction.mjs";

const id = "4f1c9a0e-1111-4222-8333-444455556666";
const line = {
  RESEND_API_KEY: "re_test_key",
  JARVIS_AGENCY_INBOX: "agency@buxme.co",
  TWILIO_ACCOUNT_SID: `AC${"ab".repeat(16)}`,
  TWILIO_AUTH_TOKEN: "1234567890123456",
  TWILIO_PHONE_NUMBER: "+15555550100",
  JARVIS_VERIFIED_PHONE_NUMBER: "+15555550199",
  JARVIS_PUBLIC_ORIGIN: "https://buxme.co",
};

function day() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function mailbox(text, subject = "Re: website") {
  const message = { id, from: "Northline Dental <owner@northline.example>", to: ["agency@buxme.co"], subject, text };
  return async (url) => {
    if (String(url).includes("?")) return { ok: true, status: 200, json: async () => ({ data: [{ id, from: message.from, to: message.to, subject }] }) };
    return { ok: true, status: 200, json: async () => message };
  };
}

test("an acceptance dials once and a restart does not dial again", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-call-"));
  let dials = 0;
  const placeCall = async (request) => {
    dials += 1;
    assert.equal(request.to, "+15555550199");
    assert.equal(request.approvedByUser, true);
    assert.match(request.reason, /Northline Dental/);
    assert.match(request.reason, /five-page site/);
    assert.match(request.reason, /\$2,400/);
    assert.match(request.reason, /deposit paid/);
    assert.match(request.reason, /December 18/);
    assert.equal(request.callbackUrl, "https://buxme.co/api/jarvis/voice");
    return { sid: "CA123", status: "queued" };
  };
  const app = createApp({
    dataDir: dir,
    env: line,
    fetchImpl: mailbox("I accept the five-page site for $2,400. Deposit paid. Deadline December 18."),
    placeCall,
  });
  const first = await app.collectInbox();
  const second = await app.collectInbox();
  assert.equal(dials, 1);
  assert.equal(first.sent, false);
  assert.equal(first.call.status, "dialed");
  assert.equal(second.call.attempted, false);
  const saved = await app.store.read(day());
  assert.equal(saved.calls.length, 1);
  assert.equal(saved.calls[0].status, "dialed");
  assert.equal(saved.calls[0].providerId, "CA123");
  assert.equal(saved.calls[0].sent, true);
});

test("interest is a lead and an uncertain provider response is not retried", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-lead-"));
  let dials = 0;
  const interested = createApp({
    dataDir: dir,
    env: line,
    fetchImpl: mailbox("Yes, we are interested in a new website.", "Website"),
    placeCall: async () => { dials += 1; return { sid: "CA9", status: "queued" }; },
  });
  const lead = await interested.collectInbox();
  assert.equal(dials, 0);
  assert.match(lead.decision.detail, /lead/);
  assert.match(lead.decision.detail, /No call was placed/);
  const wonDir = await mkdtemp(join(tmpdir(), "jarvis-uncertain-"));
  const won = createApp({
    dataDir: wonDir,
    env: line,
    fetchImpl: mailbox("I accept the five-page site for $2,400. Deposit paid. Deadline December 18."),
    placeCall: async () => { dials += 1; throw new Error("network down"); },
  });
  const attempt = await won.collectInbox();
  await won.collectInbox();
  assert.equal(dials, 1);
  assert.equal(attempt.call.status, "uncertain");
  assert.equal((await won.store.read(day())).calls[0].status, "uncertain");
});

test("a crashed dial is reconciled and a missing price does not invent a scope", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-restart-"));
  const env = { ...line };
  let dials = 0;
  const app = createApp({ dataDir: dir, env, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }), placeCall: async () => { dials += 1; return { sid: "CA1" }; } });
  await app.store.update(day(), state => {
    state.calls.push({ eventId: "deal-crashed", status: "queued", attempted: true, sent: false, script: "Already handed to the provider." });
  });
  await app.collectInbox();
  assert.equal(dials, 0);
  assert.equal((await app.store.read(day())).calls[0].status, "uncertain");
  const missing = await createApp({ dataDir: await mkdtemp(join(tmpdir(), "jarvis-gap-")), env: {}, placeCall: async () => { dials += 1; return { sid: "CA2" }; } }).recordWork({
    id: "accept-no-price",
    kind: "exception",
    business: "website-agency",
    question: "A reply sounds like an acceptance, but the scope or price is missing.",
  });
  assert.equal(dials, 0);
  assert.equal(missing.call.status, "queued");
  assert.match(missing.decision.detail, /scope or price/);
  assert.equal(missing.sent, false);
});

test("scanner margin, fulfillment, and a duplicate Buxme post stay inside their boundaries", () => {
  const unknown = scannerMargin({ features: "scans codes" });
  assert.equal(unknown.known, false);
  assert.equal(unknown.blocker.includes("$"), false);
  const priced = scannerMargin({ supplierCostCents: 600, shippingCents: 300, inventory: 40, features: "red V410 handheld scanner", transitDays: 8 });
  assert.equal(priced.deliveredCents, 900);
  assert.equal(priced.marginCents, 2099);
  assert.equal(priced.meetsTarget, true);
  const over = scannerMargin({ supplierCostCents: 800, shippingCents: 400, inventory: 10, features: "red V410", transitDays: 12 });
  assert.equal(over.meetsTarget, false);
  const state = { work: [], drafts: [], logs: [], calls: [], decisions: [], followUps: [] };
  const now = new Date("2026-11-26T12:00:00Z");
  state.work.push(
    { id: "src-1", business: "drivenest", kind: "sourcing", supplierCostCents: 800, shippingCents: 400, inventory: 10, features: "red V410", transitDays: 12, createdAt: now.toISOString(), handledAt: null },
    { id: "order-1", business: "drivenest", kind: "fulfillment", orderId: "1008", issue: "scanner not scanned at the carrier", createdAt: now.toISOString(), handledAt: null },
    { id: "post-1", business: "buxme", kind: "growth", assetId: "clip-9", postUrl: "https://example.com/post/9", signups: 3, appleSubscriptions: 1, stripeSubscriptions: 0, attributed: false, createdAt: now.toISOString(), handledAt: null },
    { id: "post-2", business: "buxme", kind: "growth", assetId: "clip-9", postUrl: "https://example.com/post/again", createdAt: now.toISOString(), handledAt: null },
  );
  const decision = applyHostedPass(state, now);
  assert.match(decision.detail, /above the \$10 target/);
  assert.match(decision.detail, /No refund/);
  assert.equal(state.drafts[0].externalAction, "not_performed");
  assert.match(state.drafts[0].body, /not published/);
  assert.match(state.logs.map(entry => entry.message).join("\n"), /was not posted again/);
  assert.equal(state.calls.length, 0);
  const claimed = claimForDial(state, now);
  assert.equal(claimed, null);
});
