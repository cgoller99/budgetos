import { spawn } from "node:child_process";

export const DEFAULT_TIMEOUT_MS = 45_000;

function timeoutMs(env = process.env) {
  const value = Number(env.JARVIS_SCHEDULED_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1_000
    ? Math.min(value, DEFAULT_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
}

export function runScheduledWorker({
  cwd = process.cwd(),
  env = process.env,
  spawnProcess = spawn,
  timeout = timeoutMs(env),
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(process.execPath, ["scripts/jarvis-scheduled-worker.mjs"], {
      cwd,
      env: {
        ...env,
        JARVIS_ACTOR: env.JARVIS_ACTOR?.trim() || "jarvis-cron-trigger",
      },
      stdio: "ignore",
    });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error("Jarvis scheduled worker exceeded its execution deadline.");
      error.code = "ETIMEDOUT";
      finish(reject, error);
    }, timeout);

    child.once("error", error => finish(reject, error));
    child.once("exit", (code, signal) => {
      if (signal) {
        const error = new Error(`Jarvis scheduled worker stopped by ${signal}.`);
        error.code = "ESIGNAL";
        finish(reject, error);
      } else if (code !== 0) {
        const error = new Error(`Jarvis scheduled worker exited with code ${code ?? "unknown"}.`);
        error.code = "EWORKER";
        finish(reject, error);
      } else {
        finish(resolve, { status: "completed_or_idle" });
      }
    });
  });
}
