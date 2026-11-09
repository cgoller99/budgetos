import { writeFile, mkdir } from "node:fs/promises";
const task = (process.env.FOUNDER_TASK || "").trim();
if (task.length > 500) throw Error("Task too long");
await mkdir("jarvis-output", { recursive: true });
await writeFile("jarvis-output/founder-task.json", JSON.stringify({ task, mode: "proposal_only", executed: false }, null, 2) + "\n");
