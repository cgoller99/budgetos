/** Run one due task, retrying only transient queue contention within fixed limits. */
import { spawn } from "node:child_process";

const maxRetries = Math.min(
  Math.max(Number.parseInt(process.env.JARVIS_TRIGGER_MAX_RETRIES ?? "3", 10) || 3, 0),
  5,
);
const retryDelayMs = Math.min(
  Math.max(Number.parseInt(process.env.JARVIS_TRIGGER_RETRY_DELAY_MS ?? "100", 10) || 100, 0),
  2_000,
);

function runWorker() {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        JARVIS_ACTOR: process.env.JARVIS_ACTOR?.trim() || "jarvis-scheduled-trigger",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => resolve({ code: 1, stdout, stderr: error.message }));
    child.on("close", (code, signal) => resolve({ code: code ?? 1, signal, stdout, stderr }));
  });
}

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  const result = await runWorker();
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.code === 0) process.exit(0);
  if (!result.stderr.includes("Queue locked") || attempt === maxRetries) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.code);
  }
  await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
}
