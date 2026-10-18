#!/usr/bin/env node
/**
 * Bills edit + remove: list Edit affordance, editor fields, remove confirmation,
 * and persistence hooks (editBill / deleteBill).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const screen = read("components/native/ios/IosBillsScreen.tsx");
const editModal = read("components/bills/EditBillModal.tsx");
const deleteModal = read("components/bills/DeleteBillModal.tsx");
const form = read("components/bills/BillFormFields.tsx");
const desktop = read("components/bills/BillsContent.tsx");
const service = read("lib/supabase/services/financeService.ts");
const schema = read("supabase/schema.sql");

assert.match(screen, /data-bill-edit=\{bill\.billId\}/);
assert.match(screen, />\s*Edit\s*</);
assert.match(screen, /EditBillModal/);
assert.match(screen, /DeleteBillModal/);
assert.match(screen, /onRemove=\{/);
assert.match(screen, /setEditBillId\(bill\.billId\)/);
assert.match(screen, /setRemoveBillId/);

assert.match(editModal, /BillFormFields/);
assert.match(editModal, /Cancel/);
assert.match(editModal, /Delete Bill/);
assert.match(editModal, /data-bill-editor-footer="true"/);
assert.match(editModal, /await editBill\(bill\.id, parsed\)/);
assert.match(editModal, /footer=\{/);

for (const field of [
  "Bill Name",
  "Category",
  "Frequency",
  "Start date",
  "Amount",
  "Due date (day of month)",
  "Linked bank account",
  "Autopay",
  "Due date reminders",
]) {
  assert.match(form, new RegExp(field.replace(/[()]/g, "\\$&")));
}

assert.match(form, /BILL_FREQUENCY_OPTIONS/);
assert.match(form, /paymentAccountId/);
assert.match(form, /autopay/);

assert.match(deleteModal, /Delete Bill/);
assert.match(deleteModal, /active bill list/);
assert.match(deleteModal, /Bank transactions are never deleted/);
assert.match(deleteModal, /await deleteBill\(bill\.id\)/);

assert.match(desktop, /EditBillModal/);
assert.match(desktop, /DeleteBillModal/);

assert.match(service, /async updateBill/);
assert.match(service, /async deleteBill/);
// Transactions keep history when a bill is removed
assert.match(schema, /bill_id uuid references public\.bills \(id\) on delete set null/);

console.log("✅ Bills edit/remove checks passed.");
