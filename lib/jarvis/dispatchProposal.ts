/** Dispatches review-only GitHub proposal workflow. Never approves or executes a task. */
export async function dispatchJarvisProposal(goal: string): Promise<boolean> {
  const token = process.env.JARVIS_GITHUB_DISPATCH_TOKEN?.trim();
  if (!token || goal.length < 3 || goal.length > 500 || /[\r\n]/.test(goal)) return false;
  try {
    const response = await fetch("https://api.github.com/repos/cgoller99/budgetos/actions/workflows/jarvis-proposals.yml/dispatches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs: { founder_task: goal } }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
