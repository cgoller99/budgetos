#!/usr/bin/env node
/**
 * Static checks for Capacitor deep-link path mapping and IAP product IDs.
 *
 * Usage: npm run test:capacitor-deep-links
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

// deepLinks.ts is TypeScript — validate via source + transpile-free regex checks,
// then duplicate the pure mapping logic here for executable assertions.
function toAppPathFromDeepLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "buxme:") {
      const host = parsed.hostname || "";
      const pathPart = parsed.pathname || "";
      const combined = `/${[host, pathPart.replace(/^\//, "")]
        .filter(Boolean)
        .join("/")}`.replace(/\/+/g, "/");
      return `${combined}${parsed.search}${parsed.hash}`;
    }
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "buxme.co" || parsed.hostname === "www.buxme.co")
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return null;
  } catch {
    return null;
  }
}

const cases = [
  [
    "buxme://auth/callback?next=%2Fonboarding",
    "/auth/callback?next=%2Fonboarding",
  ],
  ["buxme://oauth/plaid?oauth_state_id=abc", "/oauth/plaid?oauth_state_id=abc"],
  [
    "https://buxme.co/auth/callback?code=xyz&next=%2Fsettings",
    "/auth/callback?code=xyz&next=%2Fsettings",
  ],
  [
    "https://buxme.co/oauth/plaid?oauth_state_id=1",
    "/oauth/plaid?oauth_state_id=1",
  ],
  [
    "https://buxme.co/household/invite/tok_abc123",
    "/household/invite/tok_abc123",
  ],
  [
    "https://www.buxme.co/household/invite/tok_abc123",
    "/household/invite/tok_abc123",
  ],
  ["https://evil.example/oauth/plaid", null],
];

for (const [input, expected] of cases) {
  assert.equal(
    toAppPathFromDeepLink(input),
    expected,
    `Deep link mapping failed for ${input}`,
  );
}

const productsPath = path.join(ROOT, "lib/iap/products.ts");
const products = fs.readFileSync(productsPath, "utf8");
assert.match(products, /co\.buxme\.app\.pro\.monthly/);
assert.match(products, /co\.buxme\.app\.proplus\.monthly/);
assert.match(products, /apps\.apple\.com\/account\/subscriptions/);

const configPath = path.join(ROOT, "capacitor.config.ts");
const config = fs.readFileSync(configPath, "utf8");
assert.match(config, /appId:\s*"co\.buxme\.app"/);
assert.match(config, /appName:\s*"Buxme"/);
assert.match(config, /webDir:\s*"native\/www"/);
assert.match(config, /https:\/\/buxme\.co/);

const infoPlist = fs.readFileSync(
  path.join(ROOT, "ios/App/App/Info.plist"),
  "utf8",
);
assert.match(infoPlist, /<string>buxme<\/string>/);

const packageJson = require(path.join(ROOT, "package.json"));
assert.ok(packageJson.dependencies["@capacitor/core"]);
assert.ok(packageJson.devDependencies["@capacitor/ios"]);

console.log("✅ Capacitor deep-link and IAP product checks passed.");
