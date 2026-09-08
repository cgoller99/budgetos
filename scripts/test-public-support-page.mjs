#!/usr/bin/env node
/**
 * Ensures /support is a public App Store–ready help page.
 * Usage: node scripts/test-public-support-page.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const pagePath = path.join(ROOT, "app/support/page.tsx");
const contentPath = path.join(ROOT, "components/support/SupportPageContent.tsx");
const constantsPath = path.join(ROOT, "lib/legal/constants.ts");
const sitemapPath = path.join(ROOT, "app/sitemap.ts");
const footerPath = path.join(ROOT, "components/landing/LandingFooter.tsx");

assert.ok(fs.existsSync(pagePath), "missing app/support/page.tsx");
assert.ok(fs.existsSync(contentPath), "missing SupportPageContent.tsx");

const page = fs.readFileSync(pagePath, "utf8");
const content = fs.readFileSync(contentPath, "utf8");
const constants = fs.readFileSync(constantsPath, "utf8");
const sitemap = fs.readFileSync(sitemapPath, "utf8");
const footer = fs.readFileSync(footerPath, "utf8");

assert.match(page, /title:\s*"Buxme Support"/);
assert.match(page, /SupportPageContent/);
assert.doesNotMatch(page, /\(authenticated\)/);

assert.match(content, /Buxme Support/);
assert.match(content, /Contact Support/);
assert.match(content, /Account & login help/);
assert.match(content, /Bank \/ Plaid connection help/);
assert.match(content, /Subscription & billing help/);
assert.match(content, /Privacy & security help/);
assert.match(content, /Plaid/);
assert.match(content, /never receives or stores your online banking/);
assert.match(content, /LEGAL_CONTACT_EMAIL/);
assert.match(content, /mailto:\$\{LEGAL_CONTACT_EMAIL\}/);
assert.match(content, /Never email passwords|Never include passwords/i);
assert.match(content, /href="\/privacy"/);
assert.match(content, /href="\/terms"/);
assert.match(content, /href="\/security"/);
assert.match(content, /href="\/"/);
assert.match(content, /Back to Buxme/);
assert.match(content, /id="faq"/);

assert.match(constants, /support@buxme\.co/);
assert.match(sitemap, /\/support/);
assert.match(footer, /href="\/support"/);

assert.equal(
  fs.existsSync(path.join(ROOT, "app/(authenticated)/support/page.tsx")),
  false,
);

console.log("✅ Public /support page checks passed.");
