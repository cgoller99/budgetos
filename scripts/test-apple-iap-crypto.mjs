#!/usr/bin/env node
/**
 * Cryptographic SignedDataVerifier coverage using Apple's official
 * app-store-server-library mock fixtures (MIT).
 *
 * Usage: npm run test:apple-iap-crypto
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  SignedDataVerifier,
  Environment,
  VerificationException,
  VerificationStatus,
} = require("@apple/app-store-server-library");

const root = path.resolve(import.meta.dirname, "..");
const fixtureRoot = path.join(
  root,
  "scripts/fixtures/apple-app-store-server-library",
);

function readFixture(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath));
}

function readFixtureText(relativePath) {
  return readFixture(relativePath).toString("utf8").trim();
}

const testCA = readFixture("certs/testCA.der");
const transactionInfo = readFixtureText("mock_signed_data/transactionInfo");
const testNotification = readFixtureText("mock_signed_data/testNotification");
const missingX5C = readFixtureText("mock_signed_data/missingX5CHeaderClaim");

assert.ok(testCA.length > 0, "Apple testCA.der must be present");
assert.ok(transactionInfo.includes("."), "transactionInfo must be a JWS");
assert.ok(testNotification.includes("."), "testNotification must be a JWS");

const verifier = new SignedDataVerifier(
  [testCA],
  false,
  Environment.SANDBOX,
  "com.example",
  1234,
);

const decodedTxn = await verifier.verifyAndDecodeTransaction(transactionInfo);
assert.equal(decodedTxn.bundleId, "com.example");
assert.equal(decodedTxn.environment, Environment.SANDBOX);

const decodedNotification =
  await verifier.verifyAndDecodeNotification(testNotification);
assert.equal(decodedNotification.notificationType, "TEST");

let missingFailed = false;
try {
  await verifier.verifyAndDecodeNotification(missingX5C);
} catch (error) {
  missingFailed = true;
  assert.ok(error instanceof VerificationException);
  assert.equal(error.status, VerificationStatus.INVALID_CERTIFICATE);
}
assert.equal(missingFailed, true, "missing x5c must fail verification");

const parts = transactionInfo.split(".");
assert.equal(parts.length, 3);
const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
payload.bundleId = "com.evil.tampered";
parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
const tampered = parts.join(".");

let tamperFailed = false;
try {
  await verifier.verifyAndDecodeTransaction(tampered);
} catch (error) {
  tamperFailed = true;
  assert.ok(error instanceof VerificationException);
  assert.equal(error.status, VerificationStatus.VERIFICATION_FAILURE);
}
assert.equal(tamperFailed, true, "tampered JWS payload must fail verification");

let wrongBundleFailed = false;
try {
  const wrongBundleVerifier = new SignedDataVerifier(
    [testCA],
    false,
    Environment.SANDBOX,
    "com.example.x",
    1234,
  );
  await wrongBundleVerifier.verifyAndDecodeTransaction(transactionInfo);
} catch (error) {
  wrongBundleFailed = true;
  assert.ok(error instanceof VerificationException);
  assert.equal(error.status, VerificationStatus.INVALID_APP_IDENTIFIER);
}
assert.equal(wrongBundleFailed, true, "wrong bundle id must fail verification");

console.log("✅ Apple SignedDataVerifier cryptographic fixture checks passed.");
