import { randomUUID } from "node:crypto";
import { emptyState, normalizeState } from "./store.mjs";

const STATE_LIMIT = 900_000;

export function createRedisStore({ url, token, fetchImpl = fetch, key = "jarvis:state" }) {
  const base = String(url ?? "").replace(/\/$/, "");
  const lockKey = `${key}:lock`;
  let tail = Promise.resolve();

  function exclusive(operation) {
    const run = tail.then(operation, operation);
    tail = run.then(() => undefined, () => undefined);
    return run;
  }

  async function command(args) {
    const response = await fetchImpl(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) throw new Error("Jarvis state store is unavailable.");
    return body?.result;
  }

  async function withLock(operation) {
    const holder = randomUUID();
    const acquired = await command(["SET", lockKey, holder, "NX", "PX", "15000"]);
    if (acquired !== "OK") throw Object.assign(new Error("Jarvis store is locked; retry shortly."), { status: 503 });
    try {
      return await operation();
    } finally {
      const current = await command(["GET", lockKey]).catch(() => null);
      if (current === holder) await command(["DEL", lockKey]).catch(() => undefined);
    }
  }

  async function readUnlocked(day) {
    const raw = await command(["GET", key]);
    if (raw == null || raw === "") return emptyState(day);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Jarvis store is unreadable.");
    }
    return normalizeState(parsed, day);
  }

  async function writeUnlocked(state) {
    const body = JSON.stringify(state);
    if (body.length > STATE_LIMIT) throw new Error("Jarvis state is too large to store.");
    const saved = await command(["SET", key, body]);
    if (saved !== "OK") throw new Error("Jarvis state store is unavailable.");
  }

  return {
    mode: "redis",
    read(day) {
      return exclusive(() => withLock(async () => structuredClone(await readUnlocked(day))));
    },
    update(day, mutator) {
      return exclusive(() => withLock(async () => {
        const next = await readUnlocked(day);
        await mutator(next);
        await writeUnlocked(next);
        return structuredClone(next);
      }));
    },
  };
}
