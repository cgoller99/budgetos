import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { previewDocument } from "../lib/preview.mjs";
import { answerFromRecords, briefing, businessDesk, ingestAgencyReply, recordOperatorRun } from "../lib/operator.mjs";
import { createStore } from "../lib/store.mjs";
import { spendCap, spendCeiling } from "../lib/routing.mjs";

const day = "2026-11-24";
const reply = {
  messageId: "msg-agency-001",
  from: "Northline Dental",
  text: "Yes, we are interested in a new website. What is the quote?",
};

test("one agency reply becomes one draft and a second delivery does not", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-operator-"));
  const store = createStore(dir);
  let first;
  let second;
  await store.update(day, state => { first = ingestAgencyReply(state, reply, new Date("2026-11-24T22:00:00Z")); });
  await store.update(day, state => { second = ingestAgencyReply(state, reply, new Date("2026-11-24T22:05:00Z")); });
  const saved = await store.read(day);
  assert.equal(first.created, true);
  assert.equal(first.draft.status, "needs-christian");
  assert.equal(second.duplicate, true);
  assert.equal(saved.drafts.length, 1);
  assert.equal(saved.previews.length, 1);
  assert.equal(second.preview.id, first.preview.id);
  assert.equal(saved.inbox.length, 1);
  const reopened = createStore(dir);
  const again = await reopened.read(day);
  assert.equal(again.drafts[0].id, first.draft.id);
  assert.match(answerFromRecords("Who replied?", again), /Northline Dental/);
  assert.match(answerFromRecords("Who replied?", again), /not been sent/);
});

test("a reply to an offer becomes one draft and an opt-out does not", () => {
  const state = { inbox: [], drafts: [], logs: [] };
  const reply = ingestAgencyReply(state, {
    messageId: "msg-reply-0001",
    from: "Northline Dental",
    text: "Re: website proposal\nThursday works for a call.",
  });
  const optOut = ingestAgencyReply(state, {
    messageId: "msg-optout-001",
    from: "Northline Dental",
    text: "Please unsubscribe me from these emails.",
  });
  assert.equal(reply.draft.status, "needs-christian");
  assert.equal(optOut.draft, null);
  assert.equal(state.drafts.length, 1);
  assert.equal(state.previews.length, 1);
  assert.match(previewDocument(state.previews[0]), /Not launched/);
});

test("the exclusion list never becomes a draft", () => {
  const state = { inbox: [], drafts: [], logs: [] };
  const result = ingestAgencyReply(state, {
    messageId: "msg-excluded-1",
    from: "Reynolds and Sons Automotive",
    text: "We are interested in a website.",
  });
  assert.equal(result.draft, null);
  assert.equal(state.drafts.length, 0);
  assert.equal(state.previews.length, 0);
  assert.match(state.logs.at(-1).message, /exclusion list/);
});

test("the desk states missing sources instead of inventing numbers", () => {
  const desk = businessDesk({ drafts: [], logs: [] });
  assert.match(desk.buxme.answer, /not connected/);
  assert.match(desk.drivenest.answer, /margin is unknown/);
  assert.equal(desk.drivenest.blocker.includes("$"), false);
  const saved = businessDesk({
    drafts: [
      { business: "buxme", kind: "campaign", title: "Sunday tip", body: "outline", status: "draft" },
      { business: "drivenest", kind: "listing", title: "Listing draft: Red V410", body: "Margin: unknown until both numbers are entered\n", status: "draft" },
    ],
    leads: [{ business: "website-agency", name: "Harbor Dental", stage: "won" }],
  });
  assert.match(saved.buxme.answer, /None were published/);
  assert.equal(/\d+ signups/.test(saved.buxme.answer), false);
  assert.match(saved.drivenest.answer, /Margin is unknown/);
  assert.equal(saved.drivenest.answer.includes("$"), false);
  assert.match(saved.agency.answer, /Nobody was called/);
});

test("the spending ceiling stays at five dollars", () => {
  assert.equal(spendCeiling({}).cents, 500);
  assert.equal(spendCeiling({ JARVIS_DAILY_SPEND_CENTS: "500" }).ok, true);
  assert.equal(spendCeiling({ JARVIS_DAILY_SPEND_CENTS: "501" }).ok, false);
  assert.equal(spendCap({ JARVIS_DAILY_REQUEST_CAP: "20" }).cap, 20);
});

test("the inbox route used by the server keeps the same draft", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-inbox-"));
  const app = createApp({ dataDir: dir, env: { JARVIS_OWNER_PASSWORD: "correct-horse" } });
  const first = await app.ingest(reply);
  const second = await app.ingest(reply);
  assert.equal(first.created, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.draft.id, first.draft.id);
  assert.equal(second.preview.id, first.preview.id);
  const restarted = createApp({ dataDir: dir, env: { JARVIS_OWNER_PASSWORD: "correct-horse" } });
  const page = await restarted.handle(new Request(`http://127.0.0.1/preview/${first.preview.id}`), { buxme: "required", userId: "demo-admin" });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Northline Dental/);
  assert.match(html, /Not launched/);
  assert.equal(html.includes("<script"), false);
  const denied = await restarted.handle(new Request(`http://127.0.0.1/preview/${first.preview.id}`));
  assert.equal(denied.status, 401);
});

test("today’s answer skips yesterday and a preview cannot inject markup", () => {
  const state = { inbox: [], drafts: [], logs: [], previews: [] };
  ingestAgencyReply(state, {
    messageId: "msg-escape-001",
    from: "A <b>Name",
    text: "Yes, we are interested in a website <script>alert(1)</script>",
  }, new Date("2026-11-25T22:00:00Z"));
  state.logs.push({ at: "2026-11-24T15:00:00Z", message: "Yesterday’s note should stay out." });
  const today = answerFromRecords("What happened today?", state, new Date("2026-11-26T01:00:00Z"));
  assert.match(today, /A <b>Name/);
  assert.equal(today.includes("Yesterday"), false);
  const html = previewDocument(state.previews[0]);
  assert.match(html, /A &lt;b&gt;Name/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(html.includes("<script>"), false);
});

test("a hosted check records the decision and does not send", () => {
  const state = { drafts: [], logs: [], runs: [] };
  const run = recordOperatorRun(state, { connected: false, now: new Date("2026-11-26T01:00:00Z") });
  assert.match(run.decision, /not connected/);
  assert.equal(state.runs.length, 1);
  const desk = briefing(state, new Date("2026-11-26T01:00:00Z"));
  assert.equal(desk.operator.backlog, 0);
  assert.ok(desk.operator.nextCheckBy);
});
