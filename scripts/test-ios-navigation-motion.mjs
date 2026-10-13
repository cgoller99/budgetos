#!/usr/bin/env node
/**
 * iOS tab, back, and scroll-position behavior.
 * Usage: node scripts/test-ios-navigation-motion.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  consumeIosNavigation,
  markIosNavigation,
  recallScrollPosition,
  rememberScrollPosition,
  resolveIosNavigationKind,
} from "../lib/native/iosNavigation.ts";

const primary = ["/dashboard", "/transactions", "/income", "/accounts"];

assert.equal(
  resolveIosNavigationKind({
    marked: null,
    path: "/transactions",
    previousPath: "/dashboard",
    primaryHrefs: primary,
  }),
  "tab",
);
assert.equal(
  resolveIosNavigationKind({
    marked: "pop",
    path: "/dashboard",
    previousPath: "/bills",
    primaryHrefs: primary,
  }),
  "pop",
);
assert.equal(
  resolveIosNavigationKind({
    marked: null,
    path: "/bills",
    previousPath: "/dashboard",
    primaryHrefs: primary,
  }),
  "push",
);
assert.equal(
  resolveIosNavigationKind({
    marked: "tab",
    path: "/settings",
    previousPath: "/dashboard",
    primaryHrefs: primary,
  }),
  "tab",
);

markIosNavigation("pop");
assert.equal(consumeIosNavigation(), "pop");
assert.equal(consumeIosNavigation(), null);

rememberScrollPosition("/dashboard", 240);
assert.equal(recallScrollPosition("/dashboard"), 240);
rememberScrollPosition("/dashboard", Number.NaN);
assert.equal(recallScrollPosition("/dashboard"), 240);

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const transition = read("components/PageTransition.tsx");
const scroll = read("components/native/useScrollRestoration.ts");
const nav = read("components/MobileBottomNav.tsx");
const css = read("app/globals.css");
const sheet = read("components/native/ios/IosBottomSheet.tsx");

assert.match(transition, /native-tab-enter/);
assert.match(transition, /native-page-enter/);
assert.match(transition, /native-page-back/);
assert.match(transition, /popstate/);
assert.match(scroll, /useLayoutEffect/);
assert.match(nav, /markIosNavigation\("tab"\)/);
assert.match(nav, /safe-area-inset-bottom/);
assert.match(css, /native-page-back/);
assert.match(css, /ios-home-hero/);
assert.match(sheet, /dragOffsetRef\.current > 96/);
assert.match(sheet, /native-sheet-footer/);
assert.match(sheet, /triggerHaptic/);

console.log("iOS navigation motion checks passed.");
