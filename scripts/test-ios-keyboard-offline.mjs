#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const chrome = fs.readFileSync(
  path.join(root, "components/native/NativeIosChrome.tsx"),
  "utf8",
);
const layout = fs.readFileSync(path.join(root, "components/AppLayout.tsx"), "utf8");

assert.match(chrome, /focusin/);
assert.match(chrome, /visualViewport/);
assert.match(chrome, /prefers-reduced-motion/);
assert.match(chrome, /You are offline/);
assert.match(chrome, /navigator\.onLine/);
assert.match(layout, /NativeIosChrome/);
assert.match(chrome, /if \(!nativeIos\) return/);
assert.match(chrome, /--keyboard-inset/);
assert.match(chrome, /keyboardOverlapPx/);

const layoutSource = fs.readFileSync(path.join(root, "components/AppLayout.tsx"), "utf8");
assert.match(layoutSource, /wasOffline/);
assert.match(layoutSource, /addEventListener\("online", refreshAfterReconnect\)/);
assert.match(layoutSource, /refreshFinance\(\)/);

console.log("✅ iOS keyboard and offline chrome checks passed.");
