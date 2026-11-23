import assert from "node:assert/strict";
import test from "node:test";
import { decideJarvisAdmin, JARVIS_ADMIN_EMAIL } from "../lib/buxmeAccess.mjs";

const id = "6d8b6c0e-1c1a-4a1e-9c2a-0b0e6d8b6c0e";

function allow(overrides = {}) {
  return decideJarvisAdmin({
    sessionUser: { id, email: JARVIS_ADMIN_EMAIL },
    authUser: { id, email: JARVIS_ADMIN_EMAIL },
    profile: { id, email: JARVIS_ADMIN_EMAIL },
    adminAuthorized: true,
    ...overrides,
  });
}

test("Jarvis admits only the confirmed admin user id", () => {
  assert.equal(allow().ok, true);
  assert.equal(allow().userId, id);
  assert.equal(decideJarvisAdmin({ adminAuthorized: true, sessionUser: { id, email: JARVIS_ADMIN_EMAIL } }).status, 403);
  assert.equal(allow({ adminAuthorized: false }).status, 403);
  assert.equal(allow({ authUser: { id, email: "other@example.com" } }).status, 403);
  assert.equal(allow({ sessionUser: { id, email: "other@example.com" }, authUser: { id, email: "other@example.com" } }).status, 403);
  assert.equal(allow({ authUser: { id: "other-user", email: JARVIS_ADMIN_EMAIL } }).status, 403);
  assert.equal(allow({ profile: { id: "other-user", email: JARVIS_ADMIN_EMAIL } }).status, 403);
  assert.equal(allow({ profile: null }).status, 403);
  assert.equal(decideJarvisAdmin({ sessionUser: null, adminAuthorized: true }).status, 401);
});
