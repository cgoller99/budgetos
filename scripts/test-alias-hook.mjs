import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolve } from "./alias-hook.mjs";

const hook = readFileSync(new URL("./alias-hook.mjs", import.meta.url), "utf8");
assert.doesNotMatch(hook, /\/workspace\/lib\//);
assert.match(hook, /isInsideRepoLib/);

const parent = pathToFileURL(path.resolve("lib/recurring/index.ts")).href;

let rewritten = "";
await resolve("./applyActivity", { parentURL: parent }, (specifier) => {
  rewritten = String(specifier);
  return { url: rewritten };
});
assert.match(rewritten, /applyActivity\.ts$/);

let withExtension = "";
await resolve("./applyActivity.ts", { parentURL: parent }, (specifier) => {
  withExtension = String(specifier);
  return { url: withExtension };
});
assert.equal(withExtension, "./applyActivity.ts");

let outside = "";
await resolve(
  "./applyActivity",
  { parentURL: pathToFileURL("/tmp/other.ts").href },
  (specifier) => {
    outside = String(specifier);
    return { url: outside };
  },
);
assert.equal(outside, "./applyActivity");

console.log("alias hook ok");
