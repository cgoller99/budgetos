import assert from "node:assert/strict";
import test from "node:test";
import { decideCall, markMissed } from "../lib/calls.mjs";
import { commandFromSpeech, isEcho } from "../public/voice-commands.mjs";

test("two spoken turns ask who replied and then open that draft", () => {
  const first = commandFromSpeech("Jarvis, who replied?");
  assert.equal(first.type, "ask");
  assert.equal(first.text, "who replied");
  const answer = "Reply to Northline Dental. It is in Needs Christian and has not been sent.";
  assert.equal(isEcho(answer, answer), true);
  assert.equal(isEcho("thanks", answer), false);
  const second = commandFromSpeech("Open that draft");
  assert.equal(second.type, "open-draft");
  assert.equal(commandFromSpeech("Open the preview").type, "open-preview");
});

test("a won job queues one call and a missed call is not repeated", () => {
  const state = { calls: [] };
  const won = { id: "deal-1", kind: "won", client: "Northline Dental", scope: "five-page site", price: "$2,400", deadline: "December 18", next: "start the homepage" };
  const first = decideCall(state, won);
  const second = decideCall(state, won);
  assert.equal(first.call, true);
  assert.match(first.record.script, /Northline Dental/);
  assert.match(first.record.script, /\$2,400/);
  assert.match(first.record.script, /December 18/);
  assert.equal(first.record.sent, false);
  assert.equal(second.call, false);
  assert.equal(state.calls.length, 1);
  assert.equal(decideCall(state, { id: "lead-1", kind: "interested" }).call, false);
  const missed = markMissed(state, "deal-1");
  assert.equal(missed.status, "missed");
  assert.match(markMissed(state, "deal-1").note, /No second call/);
  const question = decideCall(state, { id: "ask-1", kind: "exception", question: "May I offer 15 percent off?" });
  assert.equal(question.call, true);
  assert.match(question.record.script, /15 percent/);
});
