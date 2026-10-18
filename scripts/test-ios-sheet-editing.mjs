#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { keyboardOverlapPx } from "../lib/native/keyboardInset.ts";

const root = path.join(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const sheet = read("components/native/ios/IosBottomSheet.tsx");
const transaction = read("components/native/ios/IosTransactionDetailSheet.tsx");
const account = read("components/native/ios/IosAccountDetailSheet.tsx");
const more = read("components/navigation/MobileMoreSheet.tsx");
const search = read("components/search/GlobalSearch.tsx");
const modal = read("components/ui/Modal.tsx");
const css = read("app/globals.css");
const layout = read("app/layout.tsx");
const goals = read("components/native/ios/IosGoalsScreen.tsx");
const debt = read("components/native/ios/IosDebtScreen.tsx");
const income = read("components/native/ios/IosIncomeScreen.tsx");

for (const source of [sheet, account, more, search]) {
  assert.match(source, /lockBodyScroll/);
  assert.match(source, /unlockBodyScroll/);
  assert.doesNotMatch(source, /document\.body\.style\.overflow/);
}

// Transaction detail reuses IosBottomSheet (scroll body + fixed footer).
assert.match(transaction, /IosBottomSheet/);
assert.match(transaction, /data-transaction-detail-footer/);
assert.doesNotMatch(transaction, /sticky bottom-0/);
assert.doesNotMatch(transaction, /document\.body\.style\.overflow/);

assert.match(sheet, /native-keyboard-avoid/);
assert.match(modal, /native-modal-panel/);
assert.match(modal, /native-keyboard-avoid/);
assert.match(modal, /dragOffsetRef\.current > 96/);
assert.match(modal, /data-sheet-handle="true"/);
assert.match(css, /\.native-keyboard-avoid/);
assert.match(css, /font-size: 16px/);
assert.match(css, /column-reverse/);
assert.doesNotMatch(layout, /maximumScale/);

const focusEffectMatch = modal.match(
  /previouslyFocused[\s\S]*?\}, \[([^\]]+)\]\)/,
);
assert.ok(focusEffectMatch, "Modal focus trap not found");
assert.equal(focusEffectMatch[1].replace(/\s+/g, ""), "isMounted,isOpen");

assert.match(goals, /IosDetailLine/);
assert.match(goals, /label="Projected"/);
assert.match(goals, /monthlyContribution/);
assert.match(debt, /IosDetailLine/);
assert.match(debt, /interestRate/);
assert.match(debt, /Record payment/);
assert.doesNotMatch(debt, />\s*Pay\s*</);
assert.match(income, /label="Next pay"/);
assert.match(income, /label="Deposits to"/);
assert.match(income, /Mark received/);

assert.equal(keyboardOverlapPx({ innerHeight: 800, viewportHeight: 800, offsetTop: 0 }), 0);
assert.equal(keyboardOverlapPx({ innerHeight: 800, viewportHeight: 470, offsetTop: 0 }), 330);
assert.equal(keyboardOverlapPx({ innerHeight: 800, viewportHeight: 500, offsetTop: 20 }), 280);
assert.equal(keyboardOverlapPx({ innerHeight: 400, viewportHeight: 500, offsetTop: 0 }), 0);

console.log("✅ iOS sheet editing checks passed.");
