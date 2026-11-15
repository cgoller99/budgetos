/** Persistent, local-only worker for approved, due, business-scoped tasks. */
import { runOnce } from "../lib/jarvis/taskWorker.mjs";
import { taskHandlers } from "../lib/jarvis/taskHandlers.mjs";

const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const intervalArg = process.argv.find(arg => arg.startsWith("--interval-ms="));
const intervalMs = intervalArg ? Number(intervalArg.slice("--interval-ms=".length)) : 30_000;
if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000 || intervalMs > 86_400_000)
  throw new Error("interval-ms must be an integer between 1000 and 86400000");

async function tick() {
  const result = await runOnce({ handlers: taskHandlers });
  console.log(JSON.stringify(result));
  if (result.status === "failed") console.error(`Jarvis task failed: ${result.error}`);
  return result;
}

if (once) {
  await tick();
} else {
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  while (!stopping) {
    await tick();
    if (!stopping) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
