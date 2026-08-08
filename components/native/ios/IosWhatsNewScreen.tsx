"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IosCard,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { useWhatsNewOptional } from "@/context/WhatsNewContext";
import {
  fetchLatestRelease,
  fetchReleaseList,
  markReleaseSeen,
} from "@/lib/whatsNew/clientApi";
import { RELEASE_FILTER_CATEGORIES } from "@/lib/whatsNew/constants";
import type { AppRelease, ReleaseChangeCategory } from "@/lib/whatsNew/types";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

const PAGE_SIZE = 5;

export function IosWhatsNewScreen() {
  const whatsNew = useWhatsNewOptional();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ReleaseChangeCategory | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadReleases = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);

      try {
        const result = await fetchReleaseList({
          offset: nextOffset,
          limit: PAGE_SIZE,
          q: query.trim() || undefined,
          category: category === "all" ? undefined : category,
        });
        setReleases((current) =>
          append ? [...current, ...result.releases] : result.releases,
        );
        setHasMore(result.hasMore);
        setOffset(result.nextOffset);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load release notes.",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [category, query],
  );

  useEffect(() => {
    void loadReleases(0, false);
  }, [loadReleases]);

  useEffect(() => {
    async function markLatestSeen() {
      try {
        const result = await fetchLatestRelease();
        if (result.release && !result.seen) {
          await markReleaseSeen(result.release.id);
          whatsNew?.dismissReleaseNotification();
        }
      } catch {
        // non-blocking
      }
    }
    void markLatestSeen();
  }, [whatsNew]);

  const featured = useMemo(
    () => releases.find((release) => release.featured) ?? releases[0] ?? null,
    [releases],
  );

  if (isLoading) {
    return <IosSkeletonScreen rows={5} />;
  }

  return (
    <IosScreen>
      <div>
        <p className="text-[13px] font-medium text-[var(--text-muted)]">What&apos;s New</p>
        <p className="mt-1 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
          Product updates
        </p>
      </div>

      <IosCard padding="md">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search updates"
          className="min-h-11 w-full rounded-[12px] border border-white/[0.08] bg-black/20 px-3 text-[16px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void triggerHaptic("selection");
              setCategory("all");
            }}
            className={cn(
              "min-h-9 rounded-full px-3 text-[12px] font-semibold",
              category === "all"
                ? "bg-[var(--accent)] text-white"
                : "bg-white/[0.06] text-[var(--text-muted)]",
            )}
          >
            All
          </button>
          {RELEASE_FILTER_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                void triggerHaptic("selection");
                setCategory(item);
              }}
              className={cn(
                "min-h-9 rounded-full px-3 text-[12px] font-semibold capitalize",
                category === item
                  ? "bg-[var(--accent)] text-white"
                  : "bg-white/[0.06] text-[var(--text-muted)]",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </IosCard>

      {error ? (
        <IosCard padding="md" className="border-[var(--danger)]/25 bg-[var(--danger)]/10">
          <p className="text-[13px] text-[var(--danger)]">{error}</p>
        </IosCard>
      ) : null}

      {featured ? (
        <IosCard padding="md" className="border-[var(--accent)]/25 bg-[var(--accent)]/10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-light)]">
            Latest
          </p>
          <p className="mt-1 text-[17px] font-semibold text-[var(--foreground)]">
            {featured.title}
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">{featured.summary}</p>
        </IosCard>
      ) : null}

      <IosSection title="Releases">
        {releases.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">No releases match.</p>
          </IosCard>
        ) : (
          <IosList>
            {releases.map((release) => (
              <IosListRow
                key={release.id}
                title={release.title}
                subtitle={release.version}
                trailing={
                  <span className="text-[var(--accent-light)]">
                    {expandedId === release.id ? "Hide" : "›"}
                  </span>
                }
                onClick={() => {
                  void triggerHaptic("selection");
                  setExpandedId((current) =>
                    current === release.id ? null : release.id,
                  );
                }}
              />
            ))}
          </IosList>
        )}
      </IosSection>

      {expandedId
        ? releases
            .filter((release) => release.id === expandedId)
            .map((release) => (
              <IosCard key={`detail-${release.id}`} padding="md">
                <p className="text-[15px] font-semibold text-[var(--foreground)]">
                  {release.title}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {release.summary}
                </p>
                {release.changes.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {release.changes.slice(0, 6).map((change) => (
                      <li
                        key={change.id}
                        className="text-[13px] text-[var(--text-muted)]"
                      >
                        · {change.description}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </IosCard>
            ))
        : null}

      {hasMore ? (
        <IosTextButton
          className="self-center"
          onClick={() => {
            void triggerHaptic("light");
            void loadReleases(offset, true);
          }}
        >
          {isLoadingMore ? "Loading…" : "Load more"}
        </IosTextButton>
      ) : null}
    </IosScreen>
  );
}
