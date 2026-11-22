import assert from "node:assert/strict";
import test from "node:test";
import { authConfigured, issueSession, passwordsMatch, readSession, sessionSecret } from "../lib/auth.mjs";
import { createLimiter } from "../lib/limits.mjs";

test("owner auth requires a long password and a signed session", () => {
  assert.equal(authConfigured({ JARVIS_OWNER_PASSWORD: "short" }), false);
  assert.equal(authConfigured({ JARVIS_OWNER_PASSWORD: "correct-horse" }), true);
  assert.equal(passwordsMatch("correct-horse", "correct-horse"), true);
  assert.equal(passwordsMatch("correct-horse", "other-secret"), false);
  const secret = sessionSecret({ JARVIS_OWNER_PASSWORD: "correct-horse" }, "correct-horse");
  const token = issueSession(secret, 1_000);
  assert.equal(readSession(`jarvis_session=${token}`, secret, 1_000).role, "owner");
  assert.equal(readSession(`jarvis_session=${token}`, secret, 1_000 + 13 * 60 * 60 * 1000), null);
  assert.equal(sessionSecret({ VERCEL: "1", JARVIS_OWNER_PASSWORD: "correct-horse" }, "correct-horse"), "");
});

test("shared limiter uses configured Redis without dropping the local limit", async () => {
  const seen = [];
  const limiter = createLimiter({
    fetchImpl: async url => {
      seen.push(url);
      return { ok: true, json: async () => ({ result: seen.filter(item => item.includes("/incr/")).length }) };
    },
  });
  const env = { UPSTASH_REDIS_REST_URL: "https://example.invalid", UPSTASH_REDIS_REST_TOKEN: "token" };
  assert.equal((await limiter.allow({ key: "login:1", limit: 1, windowMs: 1000, env })).allowed, true);
  assert.equal((await limiter.allow({ key: "login:1", limit: 1, windowMs: 1000, env })).allowed, false);
  assert.equal(seen.some(url => url.startsWith("https://example.invalid/incr/")), true);
});
