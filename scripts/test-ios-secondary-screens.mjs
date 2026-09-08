#!/usr/bin/env node
/**
 * Ensures secondary iOS destinations wire dedicated native screens.
 * Usage: node scripts/test-ios-secondary-screens.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const checks = [
  ["components/goals/GoalsContent.tsx", "IosGoalsScreen"],
  ["components/investments/InvestmentsContent.tsx", "IosInvestmentsScreen"],
  ["components/income/IncomeHubContent.tsx", "IosIncomeScreen"],
  ["components/transactions/TransactionsContent.tsx", "IosTransactionsScreen"],
  ["components/reports/ReportsContent.tsx", "IosReportsScreen"],
  ["components/calendar/CalendarContent.tsx", "IosCalendarScreen"],
  ["components/roadmap/RoadmapContent.tsx", "IosRoadmapScreen"],
  ["components/whatsNew/WhatsNewContent.tsx", "IosWhatsNewScreen"],
  ["components/settings/SettingsContent.tsx", "IosSettingsScreen"],
];

for (const [file, screen] of checks) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  assert.match(src, new RegExp(screen));
  assert.match(src, /useNativeIos/);
  assert.ok(
    fs.existsSync(path.join(ROOT, "components/native/ios", `${screen}.tsx`)),
    `missing ${screen}.tsx`,
  );
}

const primary = [
  "IosHomeScreen",
  "IosAccountsScreen",
  "IosBillsScreen",
  "IosDebtScreen",
];
for (const screen of primary) {
  assert.ok(
    fs.existsSync(path.join(ROOT, "components/native/ios", `${screen}.tsx`)),
    `missing ${screen}.tsx`,
  );
}

console.log("✅ iOS secondary screen wiring checks passed.");
