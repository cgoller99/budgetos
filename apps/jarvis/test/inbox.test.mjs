import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
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
