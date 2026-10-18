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
const editModal = fs.readFileSync(
  path.join(import.meta.dirname, "../components/bills/EditBillModal.tsx"),
  "utf8",
);
const deleteModal = fs.readFileSync(
  path.join(import.meta.dirname, "../components/bills/DeleteBillModal.tsx"),
  "utf8",
);
const form = fs.readFileSync(
  path.join(import.meta.dirname, "../components/bills/BillFormFields.tsx"),
  "utf8",
);

assert.match(screen, /IosBottomSheet/);
assert.match(screen, /Mark paid/);
assert.match(screen, /Recurring/);
assert.match(screen, /Autopay/);
assert.match(screen, /Upcoming/);
assert.match(screen, /label: "All"/);
assert.match(screen, /getBillPaymentHistory/);
assert.match(screen, /View all bills/);
assert.match(screen, /setSelectedBill/);
assert.match(screen, /data-bill-edit=/);
assert.match(screen, /DeleteBillModal/);
assert.match(screen, /Remove bill/);
assert.match(screen, /setRemoveBillId/);
assert.match(screen, /setEditBillId\(bill\.billId\)/);

assert.match(editModal, /onRemove\?:/);
assert.match(editModal, /Remove bill/);
assert.match(editModal, /await editBill/);
assert.match(editModal, /"Save"/);

assert.match(deleteModal, /Remove Bill/);
assert.match(deleteModal, /Historical payments and linked transactions stay/);
assert.match(deleteModal, /await deleteBill/);

assert.match(form, /Due date reminders/);
assert.match(form, /Linked bank account/);
assert.match(form, /Due date \(day of month\)/);
assert.match(form, /setNotificationPreferences/);

assert.match(sheet, /data-sheet-handle="true"/);
assert.match(sheet, /Escape/);
assert.match(sheet, /safe-area-inset-bottom/);

console.log("✅ iOS Bills sheet checks passed.");
