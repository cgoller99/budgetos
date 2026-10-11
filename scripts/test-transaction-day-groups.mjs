#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatDayGroupLabel, groupByDay } from "../lib/transactions/groupByDay.ts";

const screen = fs.readFileSync(
  path.join(import.meta.dirname, "../components/native/ios/IosTransactionsScreen.tsx"),
  "utf8",
);
assert.match(screen, /IosTransactionDetailSheet/);
assert.match(screen, /type="search"/);
assert.match(screen, /Load older/);
assert.match(screen, /groupByDay/);
assert.doesNotMatch(screen, /setEditTransactionId\(transaction\.id\)/);

const today = new Date(2026, 9, 11);

assert.equal(formatDayGroupLabel("2026-10-11", today), "Today");
assert.equal(formatDayGroupLabel("2026-10-10", today), "Yesterday");
assert.match(formatDayGroupLabel("2026-10-08", today), /Oct/);

const groups = groupByDay(
  [
    { id: "a", date: "2026-10-11T15:00:00.000Z" },
    { id: "b", date: "2026-10-11T08:00:00.000Z" },
    { id: "c", date: "2026-10-10" },
  ],
  today,
);

assert.equal(groups.length, 2);
assert.equal(groups[0].label, "Today");
assert.deepEqual(
  groups[0].items.map((item) => item.id),
  ["a", "b"],
);
assert.equal(groups[1].label, "Yesterday");
assert.equal(groups[1].items[0].id, "c");

console.log("✅ Transaction day grouping checks passed.");
