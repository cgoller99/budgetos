import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const HANDLER_SCOPES = {
  buxme: {
    name: "Buxme",
    paths: ["app", "components", "lib"],
    pattern: /budget|income|expense|transaction|subscription|goal|finance/i,
  },
  "website-agency": {
    name: "Website-building agency",
    paths: ["app", "components"],
    pattern: /page|layout|component|website|landing|marketing|conversion/i,
  },
  drivenest: {
    name: "DriveNest Auto Care",
    paths: ["docs", "scripts"],
    pattern: /booking|vehicle|service|customer|appointment|auto|drive/i,
  },
};

const kinds = new Set(["coding", "business", "research", "routine"]);
const MAX_FILES = 200;
const MAX_FILE_BYTES = 200_000;

async function inventory(root, scope) {
  const files = [];
  const evidence = [];
  async function visit(directory) {
    if (files.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await readdir(join(root, directory), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      if (entry.name.startsWith(".") || ["node_modules", ".next", "dist", "build"].includes(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
      } else if (entry.isFile() && /\.(mjs|js|ts|tsx|md|yml|yaml)$/.test(entry.name)) {
        files.push(file.replaceAll("\\", "/"));
        let content;
        try {
          const { size } = await stat(join(root, file));
          if (size > MAX_FILE_BYTES) continue;
          content = await readFile(join(root, file), "utf8");
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        const lines = content.split(/\r?\n/);
        for (let line = 0; line < lines.length && evidence.length < 40; line++) {
          if (scope.pattern.test(lines[line])) evidence.push({ file: file.replaceAll("\\", "/"), line: line + 1 });
        }
      }
    }
  }
  for (const path of scope.paths) await visit(path);
  return { filesExamined: files.length, evidence, truncated: files.length >= MAX_FILES };
}

<<<<<<< HEAD
export function getBusinessHandler(business, kind) {
  const scope = HANDLER_SCOPES[business];
  if (!scope || !kinds.has(kind)) return null;
  return async ({ root }) => ({
=======
export function handlerFor(business, kind, task) {
  const scope = SCOPES[business];
  if (!scope || !KINDS.has(kind) || (task?.businessName && task.businessName !== scope.name)) return null;
  return async ({ root, task }) => ({
>>>>>>> 331d4e2 (Harden scoped Jarvis business worker)
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
