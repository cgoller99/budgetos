#!/usr/bin/env node
/**
 * Static checks: Buxme iOS AppIcon catalog is the navy ribbon-B icon (not the
 * Capacitor white placeholder), and Debug/Release App Icons Source = AppIcon.
 *
 * Usage: npm run test:ios-appicon
 * Does not modify StoreKit / subscription code.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ICONSET = path.join(
  ROOT,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset",
);
const PBXPROJ = path.join(ROOT, "ios/App/App.xcodeproj/project.pbxproj");
const INFO_PLIST = path.join(ROOT, "ios/App/App/Info.plist");

const EXPECTED_SLOTS = [
  ["iphone", "20x20", "2x", 40],
  ["iphone", "20x20", "3x", 60],
  ["iphone", "29x29", "2x", 58],
  ["iphone", "29x29", "3x", 87],
  ["iphone", "40x40", "2x", 80],
  ["iphone", "40x40", "3x", 120],
  ["iphone", "60x60", "2x", 120],
  ["iphone", "60x60", "3x", 180],
  ["ipad", "20x20", "1x", 20],
  ["ipad", "20x20", "2x", 40],
  ["ipad", "29x29", "1x", 29],
  ["ipad", "29x29", "2x", 58],
  ["ipad", "40x40", "1x", 40],
  ["ipad", "40x40", "2x", 80],
  ["ipad", "76x76", "1x", 76],
  ["ipad", "76x76", "2x", 152],
  ["ipad", "83.5x83.5", "2x", 167],
  ["ios-marketing", "1024x1024", "1x", 1024],
];

assert.ok(fs.existsSync(ICONSET), `missing ${ICONSET}`);
assert.ok(fs.existsSync(PBXPROJ), `missing ${PBXPROJ}`);
assert.ok(fs.existsSync(INFO_PLIST), `missing ${INFO_PLIST}`);

const contents = JSON.parse(
  fs.readFileSync(path.join(ICONSET, "Contents.json"), "utf8"),
);
const byKey = new Map(
  contents.images.map((e) => [`${e.idiom}|${e.size}|${e.scale}`, e]),
);

for (const [idiom, size, scale] of EXPECTED_SLOTS) {
  const entry = byKey.get(`${idiom}|${size}|${scale}`);
  assert.ok(entry?.filename, `missing slot ${idiom} ${size} ${scale}`);
  assert.ok(
    fs.existsSync(path.join(ICONSET, entry.filename)),
    `missing file ${entry.filename}`,
  );
}

const onDisk = fs.readdirSync(ICONSET);
const referenced = new Set(contents.images.map((e) => e.filename));
referenced.add("Contents.json");
for (const name of onDisk) {
  assert.ok(referenced.has(name), `orphan file in AppIcon.appiconset: ${name}`);
}

const pbx = fs.readFileSync(PBXPROJ, "utf8");
const appIconNames = [
  ...pbx.matchAll(/ASSETCATALOG_COMPILER_APPICON_NAME = ([^;]+);/g),
].map((m) => m[1].trim());
assert.ok(
  appIconNames.length >= 2,
  "expected ASSETCATALOG_COMPILER_APPICON_NAME on Debug and Release",
);
assert.ok(
  appIconNames.every((v) => v === "AppIcon"),
  `App Icons Source must be AppIcon, found: ${appIconNames.join(", ")}`,
);
assert.ok(
  pbx.includes("INFOPLIST_KEY_CFBundleIconName = AppIcon"),
  "missing INFOPLIST_KEY_CFBundleIconName = AppIcon in pbxproj",
);

const plist = fs.readFileSync(INFO_PLIST, "utf8");
assert.ok(
  plist.includes("<key>CFBundleIconName</key>") &&
    plist.includes("<string>AppIcon</string>"),
  "Info.plist must set CFBundleIconName = AppIcon",
);

// Pixel QA via Pillow (no extra npm deps): reject Capacitor white placeholders.
const py = `
from pathlib import Path
from PIL import Image
import json, sys
iconset = Path(${JSON.stringify(ICONSET)})
contents = json.loads((iconset / "Contents.json").read_text())
expected = ${JSON.stringify(EXPECTED_SLOTS)}
by = {(e["idiom"], e["size"], e["scale"]): e for e in contents["images"]}
for idiom, size, scale, px in expected:
    e = by[(idiom, size, scale)]
    im = Image.open(iconset / e["filename"]).convert("RGBA")
    w, h = im.size
    if (w, h) != (px, px):
        print(f"SIZE {e['filename']}: {w}x{h} != {px}x{px}", file=sys.stderr)
        sys.exit(1)
    data = list(im.getdata())
    n = len(data)
    white = sum(1 for r,g,b,a in data if a > 200 and r > 230 and g > 230 and b > 230)
    dark = sum(1 for r,g,b,a in data if a > 200 and r < 60 and g < 80 and b < 120)
    if white / n > 0.05:
        print(f"PLACEHOLDER {e['filename']}: white%={100*white/n:.1f}", file=sys.stderr)
        sys.exit(1)
    if dark / n < 0.15:
        print(f"NOT_NAVY {e['filename']}: dark%={100*dark/n:.1f}", file=sys.stderr)
        sys.exit(1)
print("pixel-ok", len(expected))
`;

const out = execFileSync("python3", ["-c", py], { encoding: "utf8" }).trim();
assert.equal(out, `pixel-ok ${EXPECTED_SLOTS.length}`);

console.log(
  `ok: ${EXPECTED_SLOTS.length} AppIcon slots are navy Buxme; Debug/Release App Icons Source = AppIcon`,
);
