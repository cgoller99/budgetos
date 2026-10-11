#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const screen = fs.readFileSync(
  path.join(import.meta.dirname, "../components/native/ios/IosBillsScreen.tsx"),
  "utf8",
);
const sheet = fs.readFileSync(
  path.join(import.meta.dirname, "../components/native/ios/IosBottomSheet.tsx"),
  "utf8",
);

assert.match(screen, /IosBottomSheet/);
assert.match(screen, /Mark paid/);
assert.match(screen, /Recurring/);
assert.match(screen, /Autopay/);
assert.match(screen, /setSelectedBill/);
assert.doesNotMatch(screen, /onClick=\{\(\) => onEdit\(bill\.billId\)\}/);
assert.match(sheet, /data-sheet-handle="true"/);
assert.match(sheet, /Escape/);
assert.match(sheet, /safe-area-inset-bottom/);

console.log("✅ iOS Bills sheet checks passed.");
