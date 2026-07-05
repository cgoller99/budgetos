import type { ReleaseChangeCategory } from "@/lib/whatsNew/types";

export const RELEASE_CATEGORY_META: Record<
  ReleaseChangeCategory,
  { label: string; emoji: string; filterLabel: string }
> = {
  feature: { label: "New Features", emoji: "✨", filterLabel: "Features" },
  improvement: { label: "Improvements", emoji: "🚀", filterLabel: "Improvements" },
  bugfix: { label: "Bug Fixes", emoji: "🐛", filterLabel: "Bug Fixes" },
  security: { label: "Security", emoji: "🔒", filterLabel: "Security" },
  performance: { label: "Performance", emoji: "⚡", filterLabel: "Performance" },
};

export const RELEASE_FILTER_CATEGORIES: ReleaseChangeCategory[] = [
  "feature",
  "improvement",
  "bugfix",
  "security",
  "performance",
];

export function formatReleaseDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatReleaseMonthYear(value: string): string {
  return formatReleaseDate(value);
}
