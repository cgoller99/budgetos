export type BuildInfo = {
  version: string;
  commit: string;
  builtAt: string;
};

export function getBuildInfo(): BuildInfo {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown",
    builtAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown",
  };
}

export function formatBuildLabel(info: BuildInfo = getBuildInfo()): string {
  const shortCommit =
    info.commit === "unknown" || info.commit === "local-dev"
      ? info.commit
      : info.commit.slice(0, 7);

  return `v${info.version} · ${shortCommit}`;
}
