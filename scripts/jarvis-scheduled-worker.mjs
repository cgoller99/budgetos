/** Run one due task from the durable queue through the claim-aware read-only worker. */
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    JARVIS_ACTOR: process.env.JARVIS_ACTOR?.trim() || "jarvis-scheduled-worker",
  },
  stdio: "inherit",
});

child.on("error", error => {
  console.error("Could not start Jarvis business worker:", error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Jarvis business worker stopped by ${signal}.`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
