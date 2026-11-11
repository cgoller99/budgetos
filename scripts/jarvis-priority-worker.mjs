/** Local, read-only Jarvis decision worker. No API credentials, deployment or production writes. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { prioritizeAutonomousSignals } from "../lib/ai-team/autonomousPriorities.ts";
const inputPath = resolve(process.argv[2] ?? "data/jarvis-signals.json");
const outputPath = resolve(process.argv[3] ?? "data/jarvis-priorities.json");
if (inputPath === outputPath) throw new Error("Input and output paths must differ.");
const raw = await readFile(inputPath, "utf8");
if (raw.length > 1024 * 1024) throw new Error("Signal file exceeds 1 MB.");
const signals = JSON.parse(raw);
if (process.env.JARVIS_LIVE_SIGNALS === "1") {
  try {
    const live = JSON.parse(await readFile(resolve("jarvis-output/live-signals.json"), "utf8"));
    if (Array.isArray(live)) signals.push(...live);
  } catch { console.warn("Live signals missing; continuing with baseline signals."); }
}
if (!Array.isArray(signals) || signals.length > 1000) throw new Error("Expected an array of at most 1000 signals.");
const priorities = prioritizeAutonomousSignals(signals);
const report = { generatedAt: new Date().toISOString(), mode: "proposal_only", inputCount: signals.length, priorities };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", { flag: "w" });
console.log(`Jarvis ranked ${priorities.length} evidence-backed proposals. No actions executed.`);
