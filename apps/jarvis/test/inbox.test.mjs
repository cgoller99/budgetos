import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { beginCheck, checkSlot, finishCheck, pickupDelay } from "../lib/inbox.mjs";
import { answerFromRecords } from "../lib/operator.mjs";

const id = "4f1c9a0e-1111-4222-8333-444455556666";
const env = { RESEND_API_KEY: "re_test_key", JARVIS_AGENCY_INBOX: "agency@buxme.co" };

function mailbox(messages) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method ?? "GET" });
    if (String(url).includes("?")) return { ok: true, status: 200, json: async () => ({ data: messages.map(item => ({ id: item.id, from: item.from, to: item.to, subject: item.subject })) }) };
    const item = messages.find(entry => String(url).endsWith(entry.id));
    return { ok: true, status: 200, json: async () => item };
  };
  return { calls, fetchImpl };
}

test("a scheduled read saves one draft and a second pass does not", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-mail-"));
  const mail = mailbox([{
    id,
    from: "Northline Dental <owner@northline.example>",
    to: ["agency@buxme.co"],
    subject: "Website",
    text: "Yes, we are interested in a new website.",
  }]);
  const app = createApp({ dataDir: dir, env, fetchImpl: mail.fetchImpl });
  const result = await app.collectInbox();
  assert.equal(result.created, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.sent, false);
  assert.equal(result.drafts.length, 1);
  assert.equal(mail.calls.length, 2);
  assert.equal(mail.calls.every(call => call.method === "GET" && call.url.startsWith("https://api.resend.com/emails/receiving")), true);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const saved = await app.store.read(day);
  assert.equal(saved.drafts.length, 1);
  assert.match(saved.drafts[0].title, /Northline Dental/);
  assert.match(answerFromRecords("Who replied?", saved), /Northline Dental/);
  assert.match(answerFromRecords("Who replied?", saved), /not been sent/);
});

test("the same hour does not read the inbox again", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-hour-"));
  const mail = mailbox([{
    id,
    from: "Northline Dental <owner@northline.example>",
    to: ["agency@buxme.co"],
    subject: "Website",
    text: "Yes, we are interested in a new website.",
  }]);
  const app = createApp({ dataDir: dir, env, fetchImpl: mail.fetchImpl, now: () => Date.parse("2026-11-26T07:15:30Z") });
  const first = await app.collectInbox();
  const reads = mail.calls.length;
  const second = await app.collectInbox();
  assert.equal(first.skipped, false);
  assert.equal(first.created, 1);
  assert.equal(second.skipped, true);
  assert.equal(second.created, 0);
  assert.equal(mail.calls.length, reads);
  const saved = await app.store.read("2026-11-26");
  assert.equal(saved.drafts.length, 1);
  assert.equal(saved.lastCheckSlot, "2026-11-26T07");
});

test("mail for another address and a missing key are ignored", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-mail-"));
  let called = false;
  const quiet = createApp({ dataDir: dir, env: {}, fetchImpl: async () => { called = true; throw new Error("no"); } });
  const disconnected = await quiet.collectInbox();
  assert.equal(called, false);
  assert.match(disconnected.reason, /RESEND_API_KEY/);
  const mail = mailbox([{ id, from: "Other Shop <other@example.com>", to: ["other@example.com"], subject: "Website", text: "We are interested." }]);
  const app = createApp({ dataDir: dir, env, fetchImpl: mail.fetchImpl });
  const result = await app.collectInbox();
  assert.equal(result.created, 0);
  assert.equal(result.drafts.length, 0);
});

function uuid(n) {
  return `4f1c9a0e-1111-4222-8333-${n.toString(16).padStart(12, "0")}`;
}

test("the next check reads past the first ten unread messages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-pages-"));
  const first = Array.from({ length: 10 }, (_, index) => ({
    id: uuid(index + 1),
    from: "Northline Dental <owner@northline.example>",
    to: ["agency@buxme.co"],
    subject: "Website",
    text: "Yes, we are interested in a new website.",
  }));
  const second = [{
    id: uuid(11),
    from: "Harbor Dental <owner@harbor.example>",
    to: ["agency@buxme.co"],
    subject: "Re: website proposal",
    text: "Thursday works for a call.",
  }];
  const pages = [first, second];
  const fetchImpl = async (url) => {
    const address = String(url);
    if (!address.includes("?")) {
      const item = [...first, ...second].find(entry => address.endsWith(entry.id));
      return { ok: true, status: 200, json: async () => item };
    }
    const after = new URL(address).searchParams.get("after");
    const pageIndex = after ? 1 : 0;
    return { ok: true, status: 200, json: async () => ({ data: pages[pageIndex], has_more: pageIndex === 0 }) };
  };
  let clock = Date.parse("2026-11-26T07:15:00Z");
  const app = createApp({ dataDir: dir, env, fetchImpl, now: () => clock });
  const opened = await app.collectInbox();
  clock = Date.parse("2026-11-26T08:15:00Z");
  const continued = await app.collectInbox();
  assert.equal(opened.created, 10);
  assert.equal(opened.duplicates, 10);
  assert.equal(continued.created, 1);
  assert.equal(continued.drafts[0].title.includes("Harbor Dental"), true);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const saved = await app.store.read(day);
  assert.equal(saved.drafts.length, 11);
  assert.match(answerFromRecords("Who replied?", saved), /Harbor Dental/);
});

test("the next business check is the next :15 UTC, including 7:15", () => {
  const before = pickupDelay(new Date("2026-11-26T07:00:00Z"), 0);
  const atSevenFifteen = pickupDelay(new Date("2026-11-26T07:15:00Z"), 0);
  const after = pickupDelay(new Date("2026-11-26T07:16:00Z"), 0);
  const behind = pickupDelay(new Date("2026-11-26T07:16:00Z"), 10);
  assert.equal(before.schedule, "15 * * * *");
  assert.equal(before.nextCheckBy, "2026-11-26T07:15:00.000Z");
  assert.equal(atSevenFifteen.nextCheckBy, "2026-11-26T08:15:00.000Z");
  assert.equal(after.nextCheckBy, "2026-11-26T08:15:00.000Z");
  assert.equal(behind.extraHours, 1);
  assert.equal(behind.nextCheckBy, "2026-11-26T09:15:00.000Z");
  assert.match(before.summary, /every hour/);
  assert.match(before.summary, /7:15 UTC/);
});

test("one hour runs once and the next hour can continue", () => {
  const state = {};
  const now = new Date("2026-11-26T07:15:30Z");
  const first = beginCheck(state, now);
  assert.equal(first.started, true);
  assert.equal(first.slot, checkSlot(now));
  assert.equal(beginCheck(state, new Date("2026-11-26T07:16:00Z")).started, false);
  finishCheck(state, first.slot);
  assert.equal(beginCheck(state, new Date("2026-11-26T07:20:00Z")).started, false);
  assert.equal(beginCheck(state, new Date("2026-11-26T08:15:00Z")).started, true);
});

test("the cron routes accept a bearer GET and do not send", async () => {
  const inbox = await readFile(new URL("../../../app/api/cron/jarvis-inbox/route.ts", import.meta.url), "utf8");
  const priorities = await readFile(new URL("../../../app/api/cron/jarvis-priorities/route.ts", import.meta.url), "utf8");
  assert.match(inbox, /export async function GET/);
  assert.match(inbox, /Bearer \$\{secret\}/);
  assert.match(inbox, /collectInbox/);
  assert.match(priorities, /collectInbox/);
  assert.match(priorities, /Bearer \$\{secret\}/);
  assert.match(priorities, /15 \* \* \* \*/);
  assert.match(priorities, /proposal-only/);
  assert.doesNotMatch(inbox, /api\.resend\.com\/emails"/);
  const vercel = JSON.parse(await readFile(new URL("../../../vercel.json", import.meta.url), "utf8"));
  const business = vercel.crons.find(cron => cron.path === "/api/cron/jarvis-priorities");
  const paychecks = vercel.crons.find(cron => cron.path === "/api/cron/run-paychecks");
  assert.equal(business.schedule, "15 * * * *");
  assert.equal(paychecks.schedule, "0 6 * * *");
  const proposals = await readFile(new URL("../../../.github/workflows/jarvis-proposals.yml", import.meta.url), "utf8");
  assert.match(proposals, /cron: '7,22,37,52 \* \* \* \*'/);
  assert.doesNotMatch(proposals, /collectInbox/);
});
