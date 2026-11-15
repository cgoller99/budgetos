/** Persistent local Jarvis worker. It executes only approved, due, bounded internal handlers. */
import { runWorker } from "../lib/jarvis/worker.mjs";

const outcome = await runWorker();
console.log(JSON.stringify(outcome, null, 2));
