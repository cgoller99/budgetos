import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { agencySearchQuery, pickupDelay } from "../lib/inbox.mjs";
import { answerFromRecords } from "../lib/operator.mjs";
import { createRedisStore } from "../lib/redisStore.mjs";

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

function memoryRedis() {
  const db = new Map();
  const fetchImpl = async (url, options) => {
    const args = JSON.parse(options.body);
    const [command, key, value] = args;
    if (String(url).includes("token")) throw new Error("token leaked");
    if (command === "SET" && args[3] === "NX") {
      if (db.has(key)) return { ok: true, json: async () => ({ result: null }) };
      db.set(key, value);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    if (command === "GET") return { ok: true, json: async () => ({ result: db.has(key) ? db.get(key) : null }) };
    if (command === "DEL") {
      db.delete(key);
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    if (command === "SET") {
      db.set(key, value);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    return { ok: false, status: 500, json: async () => ({ error: "unexpected" }) };
  };
  return { db, fetchImpl };
}

test("one scoped Gmail reply survives a second check and a fresh server", async () => {
  const memory = memoryRedis();
  const repliedAt = "2026-11-27T19:40:00.000Z";
  const personal = "Are you free for dinner tonight?";
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const address = String(url);
    if (address.startsWith("https://redis.example.invalid")) return memory.fetchImpl(url, options);
    calls.push(JSON.parse(options.body));
    assert.equal(options.headers["x-api-key"], "test-key");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        successful: true,
        data: { messages: [
          { messageId: "18c0aa11bb22cc33", sender: "Buxme App <buxmeapp@gmail.com>", recipient: "christiangoller99@gmail.com", subject: "Re: website offer", messageText: "Yes, we are interested in the website.", messageTimestamp: repliedAt, labelIds: ["INBOX"] },
          { messageId: "18c0aa11bb22cc44", sender: "Friend <friend@example.com>", recipient: "christiangoller99@gmail.com", subject: "Re: dinner", messageText: personal, messageTimestamp: repliedAt, labelIds: ["INBOX"] },
        ] },
      }),
    };
  };
  const env = { COMPOSIO_API_KEY: "test-key", COMPOSIO_USER_ID: "christian", KV_REST_API_URL: "https://redis.example.invalid", KV_REST_API_TOKEN: "token" };
  const now = () => Date.parse("2026-11-27T19:42:30.000Z");
  const app = createApp({ env, fetchImpl, now });
  const first = await app.collectInbox();
  const second = await app.collectInbox();
  const restarted = createApp({
    env,
    now,
    fetchImpl: async () => { throw new Error("the fresh server must read Redis without asking Gmail again"); },
    store: createRedisStore({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN, fetchImpl: memory.fetchImpl }),
  });
  const saved = await restarted.store.read("2026-11-27");
  assert.equal(calls[0].arguments.query, agencySearchQuery());
  assert.equal(calls[0].arguments.query.includes("in:inbox"), false);
  assert.equal(first.created, 1);
  assert.equal(first.duplicates, 1);
  assert.equal(first.pickup.waitedMs, 150000);
  assert.equal(first.pickup.desk, "https://buxme.co/jarvis");
  assert.equal(second.created, 0);
  assert.equal(saved.drafts.length, 1);
  assert.equal(saved.previews.length, 1);
  assert.equal(saved.drafts[0].id, first.pickup.draftId);
  assert.equal(saved.previews[0].id, first.pickup.previewId);
  assert.equal(JSON.stringify(saved).includes(personal), false);
  assert.match(answerFromRecords("Who replied?", saved), /Buxme App/);
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
