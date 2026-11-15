/** Deterministic, configurable model routing. No new credentials or spending. */
import { classifyJarvisTask as classifyShared, selectJarvisModel as selectShared } from "./modelRouting.mjs";

export type JarvisTaskKind = "coding" | "business" | "research" | "routine";
export function classifyJarvisTask(message: string): JarvisTaskKind {
  return classifyShared(message) as JarvisTaskKind;
}
export function selectJarvisModel(kind: JarvisTaskKind, env: NodeJS.ProcessEnv = process.env) {
  return selectShared(kind, env);
}
