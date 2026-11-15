import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const HANDLER_SCOPES = {
  buxme: {
    paths: ["app", "components", "lib"],
    pattern: /budget|income|expense|transaction|subscription|goal|finance/i,
  },
  "website-agency": {
    paths: ["app", "components"],
    pattern: /page|layout|component|website|landing|marketing|conversion/i,
  },
  drivenest: {
    paths: ["docs", "scripts"],
    pattern: /booking|vehicle|service|customer|appointment|auto|drive/i,
  },
};

const kinds = new Set(["coding", "business", "research", "routine"]);

async function inventory(root, scope) {
  const files = [];
  const evidence = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(join(root, directory), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || ["node_modules", ".next", "dist", "build"].includes(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
      } else if (entry.isFile() && /\.(mjs|js|ts|tsx|md|yml|yaml)$/.test(entry.name)) {
        files.push(file.replaceAll("\\", "/"));
        if (files.length > 200) return;
        const content = await readFile(join(root, file), "utf8");
        const lines = content.split(/\r?\n/);
        for (let line = 0; line < lines.length && evidence.length < 40; line++) {
          if (scope.pattern.test(lines[line])) evidence.push({ file: file.replaceAll("\\", "/"), line: line + 1 });
        }
      }
    }
  }
  for (const path of scope.paths) await visit(path);
  return { filesExamined: files.length, evidence, truncated: files.length > 200 };
}

export function getBusinessHandler(business, kind) {
  const scope = HANDLER_SCOPES[business];
  if (!scope || !kinds.has(kind)) return null;
  return async ({ root }) => ({
    handler: `${business}.${kind}.inventory`,
    business,
    kind,
    scope: [...scope.paths],
    ...(await inventory(root, scope)),
  });
}

export function supportedBusinesses() {
  return Object.keys(HANDLER_SCOPES);
}
