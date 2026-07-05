"use client";

import type { AppRelease } from "@/lib/whatsNew/types";
import {
  RELEASE_CATEGORY_META,
  formatReleaseMonthYear,
} from "@/lib/whatsNew/constants";
import { cn } from "@/components/ui/cn";

type ReleaseCardProps = {
  release: AppRelease;
  expanded?: boolean;
  highlight?: boolean;
};

export function ReleaseCard({
  release,
  expanded = true,
  highlight = false,
}: ReleaseCardProps) {
  const grouped = release.changes.reduce<
    Record<string, typeof release.changes>
  >((acc, change) => {
    acc[change.category] = acc[change.category] ?? [];
    acc[change.category].push(change);
    return acc;
  }, {});

  return (
    <article
      className={cn(
        "page-enter rounded-3xl border bg-[var(--surface-soft)]/60 p-6 transition-all duration-300",
        highlight
          ? "border-[#0077ed]/30 shadow-[0_0_40px_rgba(0,119,237,0.08)]"
          : "border-[var(--surface-border)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#4da3ff]">
            Version {release.version}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {release.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Released {formatReleaseMonthYear(release.releaseDate)}
          </p>
        </div>
        {release.featured ? (
          <span className="rounded-full border border-[#0077ed]/25 bg-[#0077ed]/10 px-3 py-1 text-xs font-medium text-[#4da3ff]">
            Featured
          </span>
        ) : null}
      </div>

      {release.summary ? (
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {release.summary}
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-6 space-y-5">
          {Object.entries(grouped).map(([category, changes]) => {
            const meta =
              RELEASE_CATEGORY_META[
                category as keyof typeof RELEASE_CATEGORY_META
              ];

            return (
              <div key={category}>
                <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
                  {meta.emoji} {meta.label}
                </p>
                <ul className="space-y-2">
                  {changes.map((change) => (
                    <li
                      key={change.id}
                      className="flex gap-2 text-sm text-[var(--text-secondary)]"
                    >
                      <span className="text-[var(--text-muted)]">•</span>
                      <span>{change.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
