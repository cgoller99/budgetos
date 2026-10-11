import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

function resolveAlias(specifier) {
  const relative = specifier.slice(2);
  if (/\.[a-z]+$/i.test(relative)) {
    return `../${relative}`;
  }

  const asFile = new URL(`../${relative}.ts`, import.meta.url);
  try {
    statSync(fileURLToPath(asFile));
    return `../${relative}.ts`;
  } catch {
    return `../${relative}/index.ts`;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(resolveAlias(specifier), import.meta.url).href, context);
  }

  const parent = context.parentURL ?? "";
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !pathHasExtension(specifier) &&
    parent.includes("/workspace/lib/")
  ) {
    const asFile = new URL(`${specifier}.ts`, parent);
    try {
      statSync(fileURLToPath(asFile));
      return nextResolve(asFile.href, context);
    } catch {
      return nextResolve(new URL(`${specifier}/index.ts`, parent).href, context);
    }
  }

  return nextResolve(specifier, context);
}

function pathHasExtension(specifier) {
  return /\.[a-z]+$/i.test(specifier);
}
