"use client";

import Link from "next/link";
import { IosCard, IosScreen, IosSection } from "@/components/native/ios/IosPrimitives";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useNativeIos } from "@/lib/native/useNativeIos";

const PREVIEW_SECTIONS = [
  "This month",
  "Income Plan",
  "Bills",
  "Debt",
  "Goals",
  "Saved budgets",
] as const;

function UpgradeLink() {
  return (
    <Link
      href="/settings?upgrade=pro_plus#billing"
      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
    >
      Upgrade to Pro+
    </Link>
  );
}

function PreviewSections() {
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {PREVIEW_SECTIONS.map((section) => (
        <li key={section} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="font-medium text-[var(--foreground)]">{section}</span>
          <span className="text-[var(--text-muted)]">Included with Pro+</span>
        </li>
      ))}
    </ul>
  );
}

export function MoneyPlanPreview() {
  const nativeIos = useNativeIos();
  const summary =
    "Money Plan brings this month's income, bills, debt, goals, and budgets into one Pro+ view. It does not move money.";

  if (nativeIos) {
    return (
      <IosScreen>
        <IosSection title="Money Plan">
          <IosCard padding="md">
            <p className="text-[13px] leading-snug text-[var(--text-muted)]">{summary}</p>
            <PreviewSections />
            <div className="mt-4">
              <UpgradeLink />
            </div>
          </IosCard>
        </IosSection>
      </IosScreen>
    );
  }

  return (
    <div className={pageContainerWideClassName}>
      <Card>
        <CardHeader
          title="Money Plan"
          description="A Pro+ summary of the current month. Free and Pro accounts can preview the sections."
        />
        <CardContent>
          <p className="text-sm text-[var(--text-muted)]">{summary}</p>
          <PreviewSections />
          <div className="mt-4">
            <UpgradeLink />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
