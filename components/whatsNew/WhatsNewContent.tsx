"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, SkeletonGrid } from "@/components/ui";
import { ReleaseCard } from "@/components/whatsNew/ReleaseCard";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { useWhatsNewOptional } from "@/context/WhatsNewContext";
import {
  fetchLatestRelease,
  fetchReleaseList,
  markReleaseSeen,
} from "@/lib/whatsNew/clientApi";
import {
  RELEASE_CATEGORY_META,
  RELEASE_FILTER_CATEGORIES,
} from "@/lib/whatsNew/constants";
import type { AppRelease, ReleaseChangeCategory } from "@/lib/whatsNew/types";

const PAGE_SIZE = 5;

export function WhatsNewContent() {
  const whatsNew = useWhatsNewOptional();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ReleaseChangeCategory | "all">(
    "all",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReleases = useCallback(
    async (nextOffset: number, append: boolean) => {
      append ? setIsLoadingMore(true) : setIsLoading(true);
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
        // Non-blocking
      }
    }

    void markLatestSeen();
  }, [whatsNew]);

  const featuredRelease = useMemo(
    () => releases.find((release) => release.featured) ?? releases[0] ?? null,
    [releases],
  );

  return (
    <div className={cn(pageContainerWideClassName, "space-y-8")}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Product updates
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          What&apos;s New
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Every improvement, fix, and feature — so you always know Buxme is
          actively maintained.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search release notes…"
          aria-label="Search release notes"
          className="min-h-11 flex-1"
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
          />
          {RELEASE_FILTER_CATEGORIES.map((value) => (
            <FilterChip
              key={value}
              active={category === value}
              onClick={() => setCategory(value)}
              label={RELEASE_CATEGORY_META[value].filterLabel}
            />
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonGrid count={3} />
      ) : error ? (
        <p className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : releases.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">
          No release notes match your search.
        </p>
      ) : (
        <div className="relative space-y-8 before:absolute before:bottom-4 before:left-[1.125rem] before:top-4 before:w-px before:bg-[var(--surface-border)] sm:before:left-6">
          {releases.map((release, index) => (
            <div
              key={release.id}
              className="relative pl-10 sm:pl-14"
            >
              <span
                className="absolute left-3 top-8 flex size-3 rounded-full border-2 border-[#0077ed] bg-[var(--background)] sm:left-4"
                aria-hidden
              />
              <ReleaseCard
                release={release}
                highlight={featuredRelease?.id === release.id && index === 0}
              />
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            disabled={isLoadingMore}
            onClick={() => void loadReleases(offset, true)}
          >
            {isLoadingMore ? "Loading…" : "Load older versions"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring min-h-10 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[#0077ed]/20 text-[#4da3ff]"
          : "bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--foreground)]",
      )}
    >
      {label}
    </button>
  );
}
