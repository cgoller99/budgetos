#!/usr/bin/env node
/**
 * Delete Bill must be a solid red control in Modal footer chrome —
 * always present, outside the scroll region (not sticky-inside-scroll).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const edit = read("components/bills/EditBillModal.tsx");
const del = read("components/bills/DeleteBillModal.tsx");
const modal = read("components/ui/Modal.tsx");
const actions = read("components/native/NativeEditorActions.tsx");
const ios = read("components/native/ios/IosBillsScreen.tsx");
const css = read("app/globals.css");

assert.match(modal, /footer\?: ReactNode/);
assert.match(modal, /data-native-modal-footer="true"/);
assert.match(modal, /shrink-0 border-t/);
assert.match(modal, /overflow-y-auto/);

assert.match(edit, /footer=\{/);
assert.match(edit, /data-bill-editor-footer="true"/);
assert.match(edit, /NativeDestructiveButton/);
assert.match(edit, /Delete Bill/);
assert.match(edit, /billDelete/);
assert.doesNotMatch(edit, /sticky bottom-0/);

assert.match(actions, /data-native-editor-actions="true"/);
assert.match(actions, /bg-rose-500/);
assert.match(actions, /data-bill-delete/);

assert.match(del, /footer=\{/);
assert.match(del, /Delete Bill/);
assert.match(del, /Not a Bill/);
assert.match(del, /Bank transactions are never deleted/);
assert.match(del, /dismissPlaidRecurringSuggestion/);

assert.match(ios, /Delete Bill/);
assert.match(ios, /EditBillModal/);

assert.match(
  css,
  /form:not\(:has\(\[data-bill-editor-footer\]/,
);

console.log("✅ Bills Delete Bill button checks passed.");
