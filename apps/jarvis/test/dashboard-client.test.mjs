import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the dashboard client keeps voice, model display, and live updates", async () => {
  const script = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(script, /function handleTranscript/);
  assert.match(script, /SpeechRecognition/);
  assert.match(script, /getUserMedia/);
  assert.match(script, /speechSynthesis/);
  assert.match(script, /Interrupt/);
  assert.match(script, /source === "gateway"/);
  assert.match(script, /setInterval/);
});
