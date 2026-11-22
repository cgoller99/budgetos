import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the dashboard layout fits a phone viewport", async () => {
  const css = await readFile(new URL("../public/app.css", import.meta.url), "utf8");
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-bottom/);
});
