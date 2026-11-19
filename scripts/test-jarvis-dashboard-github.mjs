import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile("app/api/admin/jarvis-status/route.ts", "utf8");
const dashboard = await readFile("components/admin/JarvisHeadquarters.tsx", "utf8");

// Contract checks: the dashboard must use the authenticated server endpoint,
// never expose GitHub credentials or treat a missing API response as empty success.
assert.match(route, /requireAdminApiUser\(\)/);
assert.match(route, /if \("response" in auth\) return auth\.response/);
assert.match(route, /\/pulls\?state=open/);
assert.match(route, /cache: "no-store"/);
assert.match(route, /developmentPullsAvailable: Boolean\(pullResponse\?\.ok\)/);
assert.match(route, /\[143, 144, 146\]\.includes\(pr\.number\)/);
assert.match(route, /pr\.head\.sha\.slice\(0, 7\)/);
assert.match(dashboard, /fetch\("\/api\/admin\/jarvis-status"/);
assert.match(dashboard, /!worker\?\.developmentPullsAvailable/);
assert.match(dashboard, /worker\?\.developmentPulls\?\.map/);
assert.match(dashboard, /href=\{pr\.url\}/);
assert.match(dashboard, /rel="noopener noreferrer"/);
assert.doesNotMatch(dashboard, /JARVIS_GITHUB_(READ|DISPATCH)_TOKEN/);
console.log("Jarvis dashboard GitHub contract checks passed: auth, PR mapping, unavailable state, links, token isolation.");
