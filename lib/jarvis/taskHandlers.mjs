import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function localInventory({ rootDir, paths, pattern }) {
  const matches = [];
  async function visit(path) {
    let entries;
    try {
      entries = await readdir(join(rootDir, path), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (matches.length >= 100 || entry.name.startsWith(".") && entry.name !== ".github") continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".next", "dist", "build"].includes(entry.name)) await visit(child);
      } else if (entry.isFile() && /\.(ts|tsx|js|mjs|yml|yaml)$/.test(entry.name)) {
        const content = await readFile(join(rootDir, child), "utf8");
        if (content.length > 200_000) continue;
        content.split(/\r?\n/).forEach((line, index) => {
          if (matches.length < 100 && pattern.test(line))
            matches.push({ file: child.replaceAll("\\", "/"), line: index + 1 });
        });
      }
    }
  }
  for (const path of paths) await visit(path);
  return { filesExamined: new Set(matches.map(match => match.file)).size, matches };
}

const businessResult = (business, task, scope, inventory) => ({
  business,
  scope,
  task: task.title,
  mode: "local-read-only",
  inventory,
});

export const taskHandlers = {
  buxme: {
    research: async context => businessResult("buxme", context.task, "buxme-product", await localInventory({
      rootDir: context.rootDir,
      paths: ["app", "lib"],
      pattern: /revenue|conversion|signup|subscribe|upgrade|analytics/i,
    })),
    business: async context => businessResult("buxme", context.task, "buxme-product", await localInventory({
      rootDir: context.rootDir,
      paths: ["app", "lib"],
      pattern: /pricing|sales|customer|business/i,
    })),
  },
  "website-agency": {
    coding: async context => businessResult("website-agency", context.task, "agency-delivery",
      await localInventory({
        rootDir: context.rootDir,
        paths: ["app", "components"],
        pattern: /typescript|website|route|component|deploy/i,
      })),
  },
  drivenest: {
    business: async context => businessResult("drivenest", context.task, "drivenest-operations",
      await localInventory({
        rootDir: context.rootDir,
        paths: ["app", "lib"],
        pattern: /booking|appointment|service|customer|vehicle/i,
      })),
  },
};
