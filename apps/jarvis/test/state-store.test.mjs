import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRedisStore } from "../lib/redisStore.mjs";
import { createStore } from "../lib/store.mjs";

const day = "2026-11-21";

test("the file store keeps a conversation on disk for the next process", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jarvis-file-"));
  const first = createStore(directory);
  assert.equal(first.mode, "file");
  await first.update(day, state => {
    state.messages.push({ role: "user", content: "Remember the blue notebook" });
  });
  const second = createStore(directory);
  const state = await second.read(day);
  assert.match(JSON.stringify(state.messages), /Remember the blue notebook/);
});

test("configured Redis keeps state after a new store is created", async () => {
  const db = new Map();
  const fetchImpl = async (url, options) => {
    assert.equal(String(url).includes("token"), false);
    const args = JSON.parse(options.body);
    const [command, key, value] = args;
    assert.equal(url, "https://redis.example.invalid");
    if (command === "SET" && args[3] === "NX") {
      if (db.has(key)) return { ok: true, json: async () => ({ result: null }) };
      db.set(key, value);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    if (command === "GET") return { ok: true, json: async () => ({ result: db.has(key) ? db.get(key) : null }) };
    if (command === "DEL") {
      db.delete(key);
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    if (command === "SET") {
      db.set(key, value);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    return { ok: false, status: 500, json: async () => ({ error: "unexpected" }) };
  };
  const options = { url: "https://redis.example.invalid", token: "token", fetchImpl };
  const first = createRedisStore(options);
  assert.equal(first.mode, "redis");
  await first.update(day, state => {
    state.messages.push({ role: "user", content: "Remember the blue notebook" });
    state.tasks.push({ id: "task-1", title: "Keep the approved note", status: "approved" });
  });
  const second = createRedisStore(options);
  const state = await second.read(day);
  assert.match(JSON.stringify(state.messages), /Remember the blue notebook/);
  assert.equal(state.tasks[0].status, "approved");
});
