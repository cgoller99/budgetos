#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const investments = read("components/native/ios/IosInvestmentsScreen.tsx");
const reports = read("components/native/ios/IosReportsScreen.tsx");
const calendar = read("components/native/ios/IosCalendarScreen.tsx");
const search = read("components/search/GlobalSearch.tsx");
const topBar = read("components/TopBar.tsx");
const notifications = read("components/notifications/NotificationCenter.tsx");

assert.match(investments, /No investments connected/);
assert.match(investments, /IosProgressBar/);
assert.match(investments, /portfolioValue/);
assert.match(reports, /Net cash flow/);
assert.match(reports, /text-\[var\(--danger\)\]/);
assert.match(calendar, /PayBillSplitModal/);
assert.match(calendar, /rounded-full bg-\[var\(--accent\)\]/);
assert.match(search, /useNativeIos/);
assert.match(search, /variant === "icon"/);
assert.match(search, /safe-area-inset-bottom/);
assert.match(topBar, /GlobalSearch variant="icon"/);
assert.match(topBar, /return "Plan"/);
assert.match(notifications, /rounded-t-\[22px\]/);
assert.match(notifications, /safe-area-inset-bottom/);

console.log("✅ Remaining iOS screen checks passed.");
