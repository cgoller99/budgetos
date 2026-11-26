import { mkdir, open, readFile, rename, unlink, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export const BUSINESSES = {
  buxme: { id: "buxme", name: "Buxme", summary: "Personal finance product. Jarvis can prepare work here. It does not change Buxme production." },
  "website-agency": { id: "website-agency", name: "Website-building agency", summary: "Leads, outreach drafts, and follow-ups you record. Jarvis does not send them." },
  drivenest: { id: "drivenest", name: "DriveNest Auto Care", summary: "Product research, listings, and campaign drafts. Store accounts stay unread until a connector is configured." },
};

export function defaultGates() {
  return {
    publish: true,
    bulkOutreach: true,
    advertising: true,
    purchases: true,
    accountChanges: true,
    deploy: true,
    codePush: true,
  };
}

export function normalizeState(parsed, day) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks)) throw new Error("Jarvis store is unreadable.");
  parsed.settings ??= { gates: defaultGates() };
  parsed.settings.gates = { ...defaultGates(), ...(parsed.settings.gates ?? {}) };
  parsed.messages ??= [];
  parsed.logs ??= [];
  parsed.leads ??= [];
  parsed.drafts ??= [];
  parsed.inbox ??= [];
  parsed.work ??= [];
  parsed.calls ??= [];
  parsed.decisions ??= [];
  parsed.followUps ??= [];
  parsed.usage ??= emptyState(day).usage;
  return parsed;
}

export function emptyState(day) {
  return {
    version: 1,
    tasks: [],
    messages: [],
    logs: [],
    leads: [],
    drafts: [],
    inbox: [],
    work: [],
    calls: [],
    decisions: [],
    followUps: [],
    settings: { gates: defaultGates() },
    usage: { day, requests: 0, promptTokens: 0, completionTokens: 0, errors: [], byModel: {} },
  };
}

export function createStore(directory) {
  const file = join(directory, "state.json");
  const lockPath = `${file}.lock`;
  let tail = Promise.resolve();

  function exclusive(operation) {
    const run = tail.then(operation, operation);
    tail = run.then(() => undefined, () => undefined);
    return run;
  }

  async function acquireLock() {
    await mkdir(directory, { recursive: true });
    try {
      return await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const age = Date.now() - (await stat(lockPath)).mtimeMs;
        if (age < 15000) throw new Error("Jarvis store is locked; retry shortly.");
        await unlink(lockPath);
      } catch (stale) {
        if (stale.code !== "ENOENT") throw stale;
      }
      return open(lockPath, "wx", 0o600);
    }
  }

  async function readUnlocked(day) {
    try {
      const parsed = JSON.parse(await readFile(file, "utf8"));
      return normalizeState(parsed, day);
    } catch (error) {
      if (error.code === "ENOENT") return emptyState(day);
      throw error;
    }
  }

  async function writeUnlocked(state) {
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, file);
  }

  async function withLock(operation) {
    const handle = await acquireLock();
    try {
      return await operation();
    } finally {
      await handle.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }

  return {
    mode: "file",
    directory,
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
