export type IosNavigationKind = "tab" | "push" | "pop";

let pendingKind: IosNavigationKind | null = null;

export function markIosNavigation(kind: IosNavigationKind) {
  pendingKind = kind;
}

export function peekIosNavigation(): IosNavigationKind | null {
  return pendingKind;
}

export function consumeIosNavigation(): IosNavigationKind | null {
  const kind = pendingKind;
  pendingKind = null;
  return kind;
}

export function resolveIosNavigationKind(input: {
  marked: IosNavigationKind | null;
  path: string;
  previousPath: string | null;
  primaryHrefs: readonly string[];
}): IosNavigationKind {
  if (input.marked === "pop") {
    return "pop";
  }

  const onPrimaryTab = input.primaryHrefs.includes(input.path);
  const fromPrimaryTab =
    input.previousPath != null && input.primaryHrefs.includes(input.previousPath);

  if (input.marked === "tab" || (onPrimaryTab && (input.previousPath == null || fromPrimaryTab))) {
    return "tab";
  }

  return "push";
}

const scrollPositions = new Map<string, number>();

export function rememberScrollPosition(path: string, y: number) {
  if (!Number.isFinite(y) || y < 0) {
    return;
  }
  scrollPositions.set(path, y);
}

export function recallScrollPosition(path: string): number | null {
  const saved = scrollPositions.get(path);
  return saved == null ? null : saved;
}
