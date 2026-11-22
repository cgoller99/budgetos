import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, resolve } from "node:path";

const exec = promisify(execFile);
const branchPattern = /^jarvis\/[a-z0-9-]{3,40}$/;
const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const filePattern = /^[A-Za-z0-9_./-]{1,120}$/;

async function ownRepository(repoDir, execFileImpl) {
  const { stdout } = await execFileImpl("git", ["-C", repoDir, "rev-parse", "--show-toplevel"]);
  const toplevel = resolve(String(stdout).trim());
  if (toplevel !== resolve(repoDir)) {
    throw new Error("Refusing to operate on a parent git repository.");
  }
}

export async function commitApprovedSandbox({
  repoDir,
  branch,
  message,
  files,
  allowGit = false,
  allowPush = false,
  allowPullRequest = false,
  pushApproved = false,
  pullRequestApproved = false,
  remoteRepo = "",
  execFileImpl = exec,
}) {
  if (allowGit !== true) {
    return { performed: false, pushed: false, pullRequest: false, reason: "Git execution is disabled. No branch, commit, push, or pull request was created." };
  }
  if (!branchPattern.test(branch ?? "")) {
    return { performed: false, pushed: false, pullRequest: false, reason: "Branch name is not allowed." };
  }
  if (!message || message.length > 120 || /[\r\n]/.test(message)) {
    return { performed: false, pushed: false, pullRequest: false, reason: "Commit message is not allowed." };
  }
  const safeFiles = Array.isArray(files) ? files.filter(file => filePattern.test(file) && !file.includes("..")) : [];
  if (!safeFiles.length) {
    return { performed: false, pushed: false, pullRequest: false, reason: "No sandbox file was available to commit." };
  }
  const marker = await readFile(join(repoDir, ".jarvis-sandbox"), "utf8").catch(() => "");
  if (marker.trim() !== "dedicated-jarvis-sandbox") {
    return { performed: false, pushed: false, pullRequest: false, reason: "This directory is not a dedicated Jarvis sandbox. No git command ran." };
  }
  try {
    await ownRepository(repoDir, execFileImpl);
  } catch (error) {
    return { performed: false, pushed: false, pullRequest: false, reason: error.message };
  }
  await execFileImpl("git", ["-C", repoDir, "checkout", "-B", branch]);
  await execFileImpl("git", ["-C", repoDir, "add", "--", ...safeFiles]);
  await execFileImpl("git", ["-C", repoDir, "commit", "-m", message]);
  if (allowPush !== true || pushApproved !== true) {
    return { performed: true, pushed: false, pullRequest: false, branch, reason: "Local commit created. Push and pull request were not performed." };
  }
  await execFileImpl("git", ["-C", repoDir, "push", "-u", "origin", branch]);
  if (allowPullRequest !== true || pullRequestApproved !== true || !repoPattern.test(remoteRepo)) {
    return { performed: true, pushed: true, pullRequest: false, branch, reason: "Branch pushed. A pull request was not opened." };
  }
  await execFileImpl("gh", ["pr", "create", "--repo", remoteRepo, "--head", branch, "--title", message, "--body", "Prepared by Jarvis after explicit approval. Review the diff before merging."]);
  return { performed: true, pushed: true, pullRequest: true, branch, reason: "Pull request command completed. Confirm the open request in GitHub before treating it as merged." };
}
