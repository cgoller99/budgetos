import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_FILES = 100;
const MAX_FILE_BYTES = 200_000;

async function inventory(root, paths, pattern) {
  const matches = [];
  let filesExamined = 0;

  async function visit(relativePath) {
    if (matches.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await readdir(join(root, relativePath), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (matches.length >= MAX_FILES) return;
      if (entry.name.startsWith(".") && entry.name !== ".github") continue;
      if (["node_modules", ".next", "dist", "build"].includes(entry.name)) continue;
      const child = join(relativePath, entry.name);
      if (entry.isDirectory()) {
        await visit(child);
      } else if (entry.isFile() && /\.(md|ts|tsx|js|mjs|yml|yaml|json)$/.test(entry.name)) {
        const data = await readFile(join(root, child), "utf8");
        if (data.length > MAX_FILE_BYTES) continue;
        filesExamined += 1;
        const lines = data.split(/\r?\n/);
        for (let index = 0; index < lines.length && matches.length < MAX_FILES; index += 1) {
          if (pattern.test(lines[index])) {
            matches.push({ file: child.replaceAll("\\", "/"), line: index + 1 });
          }
        }
      }
    }
  }

  for (const path of paths) await visit(path);
  return { filesExamined, matches, truncated: matches.length >= MAX_FILES };
}

const handlers = {
  buxme: {
    name: "buxme-read-only-inventory",
    async run({ root }) {
      return {
        summary: "Inspected Buxme finance-product code for task evidence.",
        evidence: await inventory(root, ["app", "components", "lib"], /budget|finance|transaction|subscription|analytics/i),
      };
    },
  },
  "website-agency": {
    name: "website-agency-delivery-inventory",
    async run({ root }) {
      return {
        summary: "Inspected website-delivery code and workflow evidence.",
        evidence: await inventory(root, ["app", "components", ".github"], /website|page|deploy|workflow|landing|conversion/i),
      };
    },
  },
  drivenest: {
    name: "drivenest-operations-inventory",
    async run({ root }) {
      return {
        summary: "Inspected DriveNest operations evidence without contacting customers.",
        evidence: await inventory(root, ["docs", "data", "app", "lib"], /auto|care|booking|service|customer|vehicle/i),
      };
    },
  },
};

export function getBusinessHandler(business) {
  return handlers[business] ?? null;
}

export function listBusinessHandlers() {
  return Object.fromEntries(Object.entries(handlers).map(([business, handler]) => [business, handler.name]));
}
