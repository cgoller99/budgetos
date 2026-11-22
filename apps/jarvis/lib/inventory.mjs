import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const MAX_FILES = 200;
const MAX_FILE_BYTES = 200_000;
const MAX_EVIDENCE = 30;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "coverage", "data"]);

const SCOPES = {
  buxme: { paths: ["app", "components", "lib"], pattern: /budget|income|expense|transaction|subscription|goal|finance/i },
  "website-agency": { paths: ["app", "components"], pattern: /page|layout|component|website|landing|marketing|conversion/i },
  drivenest: { paths: ["docs", "scripts"], pattern: /booking|vehicle|service|customer|appointment|auto|drive/i },
};

function insideRoot(root, path) {
  const fromRoot = relative(resolve(root), resolve(root, path));
  return fromRoot === "" || (!isAbsolute(fromRoot) && !fromRoot.startsWith(".."));
}

function blockedName(name) {
  return name.startsWith(".") || /env|secret|credential|token|password/i.test(name) || name.endsWith(".pem");
}

export async function readBusinessInventory(root, business) {
  const scope = SCOPES[business];
  if (!root || !scope) {
    return { connected: false, filesExamined: 0, evidence: [], note: "Repository reading is off. Set JARVIS_REPO_ROOT to a checkout Jarvis may read. No files were changed." };
  }
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
      if (blockedName(entry.name) || SKIP_DIRS.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (!insideRoot(root, path)) throw new Error("Inventory refused a path outside the repository root.");
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && /\.(mjs|js|ts|tsx|md|yml|yaml)$/.test(entry.name)) {
        const portable = path.replaceAll("\\", "/");
        files.push(portable);
        const absolute = resolve(root, path);
        const info = await stat(absolute);
        if (info.size > MAX_FILE_BYTES) continue;
        const lines = (await readFile(absolute, "utf8")).split(/\r?\n/);
        for (let index = 0; index < lines.length && evidence.length < MAX_EVIDENCE; index += 1) {
          if (scope.pattern.test(lines[index])) evidence.push({ file: portable, line: index + 1, excerpt: lines[index].trim().slice(0, 160) });
        }
      }
    }
  }
  for (const path of scope.paths) await visit(path);
  return {
    connected: true,
    filesExamined: files.length,
    evidence,
    truncated: files.length >= MAX_FILES,
    note: "These are pattern matches in files Jarvis was allowed to read. They are not confirmed bugs, and no file was edited.",
  };
}
