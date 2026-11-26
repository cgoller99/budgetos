import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { answerFromRecords, businessDesk, ingestAgencyReply } from "../lib/operator.mjs";
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
  assert.match(state.logs.at(-1).message, /exclusion list/);
});

test("the desk states missing sources instead of inventing numbers", () => {
  const desk = businessDesk({ drafts: [], logs: [] });
  assert.match(desk.buxme.answer, /not connected/);
  assert.match(desk.drivenest.answer, /margin is unknown/);
  assert.equal(desk.drivenest.blocker.includes("$"), false);
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
});
