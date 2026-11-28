import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve, relative } from "node:path";

const MAX_FILES = 200;
const MAX_FILE_BYTES = 200_000;
const MAX_EVIDENCE = 40;

const SCOPES = {
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

const KINDS = new Set(["coding", "business", "research", "routine"]);

function insideRoot(root, path) {
  const resolvedPath = resolve(root, path);
  const fromRoot = relative(resolve(root), resolvedPath);
  return fromRoot === "" || (!isAbsolute(fromRoot) && !fromRoot.startsWith(".."));
}

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
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && /\.(mjs|js|ts|tsx|md|yml|yaml)$/.test(entry.name)) {
        const absolute = resolve(root, path);
        if (!insideRoot(root, path)) throw new Error("Handler attempted to leave business root");
        files.push(path.replaceAll("\\", "/"));
        try {
          const { size } = await stat(absolute);
          if (size > MAX_FILE_BYTES) continue;
          const lines = (await readFile(absolute, "utf8")).split(/\r?\n/);
          for (let line = 0; line < lines.length && evidence.length < MAX_EVIDENCE; line++) {
            if (scope.pattern.test(lines[line])) evidence.push({ file: path.replaceAll("\\", "/"), line: line + 1 });
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
  }
  for (const path of scope.paths) await visit(path);
  return { filesExamined: files.length, evidence, truncated: files.length >= MAX_FILES };
}

export function handlerFor(business, kind, task) {
  const scope = SCOPES[business];
  if (!scope || !KINDS.has(kind) || (task?.businessName && task.businessName !== scope.name)) return null;
  return async ({ root, task }) => ({
    handler: `${business}.${kind}.inventory`,
    business,
    businessName: task.businessName,
    kind,
    taskId: task.id,
    scope: [...scope.paths],
    sideEffects: [],
    ...(await inventory(root, scope)),
  });
}

export function supportedBusinesses() {
  return Object.keys(SCOPES);
}
