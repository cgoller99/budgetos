import "server-only";
import manifest from "@/data/jarvis-approved-tasks.json";

/** Dispatch only repository-allowlisted read-only audits; never infer authorization from freeform text. */
export async function dispatchApprovedJarvisExecution(taskId: string): Promise<boolean> {
  if (!manifest.some(task => task.id === taskId && task.status === "approved")) return false;
  const token = process.env.JARVIS_GITHUB_DISPATCH_TOKEN?.trim();
  if (!token) return false;
  try {
    const response = await fetch("https://api.github.com/repos/cgoller99/budgetos/actions/workflows/jarvis-safe-execution.yml/dispatches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs: { approved_task_id: taskId } }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
