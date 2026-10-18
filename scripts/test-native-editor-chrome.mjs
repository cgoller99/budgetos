#!/usr/bin/env node
/**
 * Native editor chrome: Modal/IosBottomSheet keep actions outside scroll.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const modal = read("components/ui/Modal.tsx");
const sheet = read("components/native/ios/IosBottomSheet.tsx");
const actions = read("components/native/NativeEditorActions.tsx");

assert.match(modal, /footer\?: ReactNode/);
assert.match(modal, /data-native-modal-footer/);
assert.match(modal, /native-keyboard-avoid/);
assert.match(modal, /safe-area-inset-bottom/);

assert.match(sheet, /footer\?: ReactNode/);
assert.match(sheet, /flex max-h-\[min\(88dvh/);
assert.match(sheet, /overflow-hidden/);
assert.match(sheet, /flex-1 overflow-y-auto/);
assert.match(sheet, /native-sheet-footer shrink-0/);
assert.doesNotMatch(sheet, /sticky bottom-0/);

assert.match(actions, /NativeEditorActions/);
assert.match(actions, /NativeDestructiveButton/);
assert.match(actions, /formId/);
assert.match(actions, /min-h-12/);

const transaction = read("components/native/ios/IosTransactionDetailSheet.tsx");
assert.match(transaction, /IosBottomSheet/);
assert.match(transaction, /footer=\{/);
assert.doesNotMatch(transaction, /sticky bottom-0/);

const designSystem = read("components/native/designSystem.ts");
assert.match(designSystem, /IosEmptyState/);
assert.match(designSystem, /NativeEditorActions/);
assert.match(designSystem, /IosPageHeader/);

console.log("✅ Native editor chrome checks passed.");
