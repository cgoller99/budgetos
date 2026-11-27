import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { approveQuote, claimCalls } from "../lib/calls.mjs";
import { briefing, ingestAgencyReply } from "../lib/operator.mjs";

const quote = {
  prospect: "Northline Dental",
  scope: "five-page site",
  price: "$2,400",
  deadline: "December 18",
  next: "start the homepage",
};
const line = {
  TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
  TWILIO_AUTH_TOKEN: "test-token",
  TWILIO_PHONE_NUMBER: "+15555550100",
  JARVIS_VERIFIED_PHONE_NUMBER: "+15555550199",
  JARVIS_PUBLIC_ORIGIN: "https://buxme.co",
};

function tracker() {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    calls.push({
      url: String(input),
      body: options.body instanceof URLSearchParams ? options.body.toString() : "",
    });
    if (String(input).includes("api.twilio.com")) {
      return { ok: true, json: async () => ({ sid: "CA1234567890abcdef1234567890abcd", status: "queued" }) };
    }
    return { ok: true, json: async () => ({ data: [] }) };
  };
  return { calls, fetchImpl };
}

test("an interested reply does not call, even when a quote is approved", () => {
  const state = { inbox: [], drafts: [], logs: [], previews: [], calls: [], quotes: [] };
  approveQuote(state, quote);
  ingestAgencyReply(state, {
    messageId: "msg-interest-1",
    from: "Northline Dental",
    text: "Yes, we are interested in a new website. What is the quote?",
  });
  assert.equal(state.calls.length, 0);
  assert.equal(state.drafts.length, 1);
});

test("acceptance without an approved quote does not call", () => {
  const state = { inbox: [], drafts: [], logs: [], previews: [], calls: [], quotes: [] };
  ingestAgencyReply(state, { messageId: "msg-accept-0001", from: "Northline Dental", text: "We accept the quote." });
  assert.equal(state.calls.length, 0);
  assert.match(state.logs.at(-1).message, /No approved quote/);
});

test("a discount request queues one question and not a won call", () => {
  const state = { inbox: [], drafts: [], logs: [], previews: [], calls: [], quotes: [] };
  approveQuote(state, quote);
  ingestAgencyReply(state, { messageId: "msg-discount-1", from: "Northline Dental", text: "We accept if you can do 15 percent off." });
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].kind, "exception");
});

test("an excluded business never gets a call", () => {
  const state = { inbox: [], drafts: [], logs: [], previews: [], calls: [], quotes: [] };
  approveQuote(state, { ...quote, prospect: "Reynolds and Sons Automotive" });
  ingestAgencyReply(state, { messageId: "msg-excluded-9", from: "Reynolds and Sons Automotive", text: "We accept the quote." });
  assert.equal(state.calls.length, 0);
  assert.equal(state.drafts.length, 0);
});

test("an approved acceptance dials the verified number once and a miss is not redialed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-call-"));
  const { calls, fetchImpl } = tracker();
  const app = createApp({ dataDir: dir, env: line, fetchImpl, now: () => Date.parse("2026-11-26T15:00:00Z") });
  const saved = await app.handle(new Request("http://127.0.0.1/api/quotes", {
    method: "POST",
    headers: { "content-type": "application/json", "x-jarvis-client": "dashboard" },
    body: JSON.stringify({ ...quote, to: "+19995550123" }),
  }), { buxme: "required", userId: "demo-admin" });
  assert.equal(saved.status, 201);
  await app.ingest({ messageId: "msg-won-00001", from: "Northline Dental", text: "We accept the quote and the deposit is sent." });
  await app.ingest({ messageId: "msg-won-00001", from: "Northline Dental", text: "We accept the quote and the deposit is sent." });
  const twilio = calls.filter(call => call.url.includes("api.twilio.com"));
  assert.equal(twilio.length, 1);
  const params = new URLSearchParams(twilio[0].body);
  assert.equal(params.get("To"), "+15555550199");
  assert.equal(params.get("From"), "+15555550100");
  assert.equal(params.get("To").includes("19995550123"), false);
  const spoken = new URL(params.get("Url")).searchParams.get("say");
  assert.match(spoken, /Northline Dental/);
  assert.match(spoken, /\$2,400/);
  assert.equal(spoken.includes("+1555"), false);
  const state = await app.store.read("2026-11-26");
  assert.equal(state.calls[0].status, "dialed");
  const missed = await app.recordCallStatus("msg-won-00001", "no-answer");
  assert.equal(missed.status, "missed");
  await app.collectInbox();
  assert.equal(calls.filter(call => call.url.includes("api.twilio.com")).length, 1);
  const desk = briefing(await app.store.read("2026-11-26"), new Date("2026-11-26T15:00:00Z"));
  assert.match(desk.calls[0].note, /No second call/);
  const repeat = await app.recordCallStatus("msg-won-00001", "no-answer");
  assert.equal(repeat.note, missed.note);
});

test("quiet hours and a missing phone line do not dial", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-quiet-"));
  const { calls, fetchImpl } = tracker();
  const app = createApp({ dataDir: dir, env: line, fetchImpl, now: () => Date.parse("2026-11-26T03:30:00Z") });
  await app.store.update("2026-11-25", state => { approveQuote(state, quote); });
  await app.ingest({ messageId: "msg-quiet-0001", from: "Northline Dental", text: "We accept the quote." });
  assert.equal(calls.filter(call => call.url.includes("api.twilio.com")).length, 0);
  const quiet = await app.store.read("2026-11-25");
  assert.equal(quiet.calls[0].status, "queued");
  assert.match(quiet.calls[0].note, /8:00 AM/);
  const plain = { calls: [{ eventId: "msg-plain-0001", status: "queued", sent: false, script: "Question", kind: "exception" }] };
  claimCalls(plain, { env: {}, now: new Date("2026-11-26T15:00:00Z") });
  assert.equal(plain.calls[0].sent, false);
  assert.match(plain.calls[0].note, /not connected/);
});

test("a phone-line timeout is not dialed a second time", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-timeout-"));
  let attempts = 0;
  const app = createApp({
    dataDir: dir,
    env: line,
    now: () => Date.parse("2026-11-26T15:00:00Z"),
    fetchImpl: async () => {
      attempts += 1;
      throw new Error("timeout");
    },
  });
  await app.store.update("2026-11-26", state => { approveQuote(state, quote); });
  await app.ingest({ messageId: "msg-timeout-01", from: "Northline Dental", text: "We accept the quote." });
  await app.collectInbox();
  assert.equal(attempts, 1);
  const saved = await app.store.read("2026-11-26");
  assert.equal(saved.calls[0].status, "unconfirmed");
  assert.match(saved.calls[0].note, /No second call/);
});
