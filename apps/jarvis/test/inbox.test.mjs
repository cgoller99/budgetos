import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { pickupDelay } from "../lib/inbox.mjs";
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
  const app = createApp({ dataDir: dir, env, fetchImpl });
  const opened = await app.collectInbox();
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

test("a lead waits until the daily window and one extra day after ten unread", () => {
  const beforeWindow = pickupDelay(new Date("2026-11-26T06:00:00Z"), 0);
  const afterWindow = pickupDelay(new Date("2026-11-26T08:00:00Z"), 0);
  const behind = pickupDelay(new Date("2026-11-26T08:00:00Z"), 10);
  assert.equal(beforeWindow.maxWaitMinutes <= 120, true);
  assert.equal(afterWindow.maxWaitMinutes > 23 * 60, true);
  assert.equal(afterWindow.maxWaitMinutes < 25 * 60, true);
  assert.equal(behind.extraDays, 1);
  assert.equal(behind.maxWaitMinutes > afterWindow.maxWaitMinutes + 20 * 60, true);
});

test("the cron routes accept a bearer GET and do not send", async () => {
  const inbox = await readFile(new URL("../../../app/api/cron/jarvis-inbox/route.ts", import.meta.url), "utf8");
  const priorities = await readFile(new URL("../../../app/api/cron/jarvis-priorities/route.ts", import.meta.url), "utf8");
  assert.match(inbox, /export async function GET/);
  assert.match(inbox, /Bearer \$\{secret\}/);
  assert.match(inbox, /collectInbox/);
  assert.match(priorities, /collectInbox/);
  assert.match(priorities, /Bearer \$\{secret\}/);
  assert.doesNotMatch(inbox, /api\.resend\.com\/emails"/);
});
