#!/usr/bin/env node
/**
 * Delete Bill must be a solid red control pinned in the Edit Bill footer —
 * always present, not gated on optional onRemove, not a ghost text link.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const edit = read("components/bills/EditBillModal.tsx");
const del = read("components/bills/DeleteBillModal.tsx");
const ios = read("components/native/ios/IosBillsScreen.tsx");
const modal = read("components/ui/Modal.tsx");

assert.match(edit, /data-bill-delete="true"/);
assert.match(edit, /data-bill-editor-footer="true"/);
assert.match(edit, />\s*Delete Bill\s*</);
assert.match(edit, /bg-rose-500/);
assert.match(edit, /sticky bottom-0/);
assert.match(edit, /safe-area-inset-bottom/);
assert.match(edit, /DeleteBillModal/);
assert.match(edit, /setConfirmDelete\(true\)/);
// Must not gate the button on optional onRemove
assert.doesNotMatch(edit, /\{onRemove \? \(/);

assert.match(del, /Delete Bill/);
assert.match(del, /Not a Bill/);
assert.match(del, /Remove from Bills/);
assert.match(del, /Bank transactions are never deleted/);
assert.match(del, /dismissPlaidRecurringSuggestion/);
assert.match(del, /merchantGroupKey/);
assert.match(del, /data-bill-delete-confirm="true"/);

assert.match(ios, />\s*Delete Bill\s*</);
assert.match(ios, /EditBillModal/);

assert.match(modal, /safe-area-inset-bottom/);
assert.match(modal, /overflow-y-auto/);

console.log("✅ Bills Delete Bill button checks passed.");
