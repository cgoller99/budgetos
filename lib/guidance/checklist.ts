export type ChecklistStepId =
  | "accounts"
  | "income"
  | "bills"
  | "savings"
  | "household";

const DISMISSED_KEY = "buxme-welcome-checklist-dismissed";
const COMPLETED_KEY = "buxme-welcome-checklist-completed";

function readCompletedSteps(): Set<ChecklistStepId> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const stored = window.localStorage.getItem(COMPLETED_KEY);
    const parsed = stored ? JSON.parse(stored) : [];

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter(
            (step): step is ChecklistStepId =>
              typeof step === "string" &&
              ["accounts", "income", "bills", "savings", "household"].includes(
                step,
              ),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeCompletedSteps(steps: Set<ChecklistStepId>): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(steps)));
}

export function isWelcomeChecklistDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(DISMISSED_KEY) === "true";
}

export function dismissWelcomeChecklist(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DISMISSED_KEY, "true");
}

export function isChecklistStepComplete(stepId: ChecklistStepId): boolean {
  return readCompletedSteps().has(stepId);
}

export function setChecklistStepComplete(
  stepId: ChecklistStepId,
  complete = true,
): ChecklistStepId[] {
  const steps = readCompletedSteps();

  if (complete) {
    steps.add(stepId);
  } else {
    steps.delete(stepId);
  }

  writeCompletedSteps(steps);
  return Array.from(steps);
}

export function getCompletedChecklistSteps(): ChecklistStepId[] {
  return Array.from(readCompletedSteps());
}
