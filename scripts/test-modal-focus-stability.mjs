/**
 * Regression: Modal focus trap must not depend on onClose identity.
 * Unstable onClose (recreated each form keystroke) previously re-ran the
 * focus effect and stole input focus after every character.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(
  path.join(root, "components/ui/Modal.tsx"),
  "utf8",
);

assert.match(
  source,
  /onCloseRef\.current\s*=\s*onClose/,
  "Modal should keep onClose in a ref",
);
assert.match(
  source,
  /onCloseRef\.current\(\)/,
  "Escape handler should call onClose via ref",
);

const focusEffectMatch = source.match(
  /useEffect\(\(\) => \{\s*if \(!isOpen \|\| !isMounted\) return;[\s\S]*?\}, \[([^\]]+)\]\)/,
);
assert.ok(focusEffectMatch, "Focus trap useEffect not found");
const deps = focusEffectMatch[1].replace(/\s+/g, "");
assert.equal(
  deps,
  "isMounted,isOpen",
  `Focus trap deps must be [isMounted, isOpen], got [${focusEffectMatch[1].trim()}]`,
);
assert.ok(
  !deps.includes("onClose"),
  "Focus trap must not list onClose in dependency array",
);

console.log("✓ Modal focus trap is stable across onClose identity changes");
