import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { mapAppRelease } from "@/lib/whatsNew/mappers";
import type {
  AppRelease,
  ReleaseChangeCategory,
  ReleaseListResponse,
} from "@/lib/whatsNew/types";

const DEFAULT_PAGE_SIZE = 5;

export type PublicReleaseFilters = {
  offset?: number;
  limit?: number;
  q?: string;
  category?: ReleaseChangeCategory;
};

export async function listPublishedReleases(
  supabase: BuxmeSupabaseClient,
  filters: PublicReleaseFilters = {},
): Promise<ReleaseListResponse> {
  const offset = filters.offset ?? 0;
  const limit = Math.min(filters.limit ?? DEFAULT_PAGE_SIZE, 20);

  const { data: releaseRows, error } = await supabase
    .from("app_releases")
    .select(
      "id, version, release_date, title, summary, published, featured, published_at, created_at, updated_at",
    )
    .eq("published", true)
    .order("release_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    throw error;
  }

  const rows = releaseRows ?? [];
  const releaseIds = rows.map((row) => row.id);

  let changes: Array<{
    id: string;
    release_id: string;
    category: ReleaseChangeCategory;
    description: string;
    sort_order: number;
  }> = [];

  if (releaseIds.length > 0) {
    let changeQuery = supabase
      .from("app_release_changes")
      .select("id, release_id, category, description, sort_order")
      .in("release_id", releaseIds)
      .order("sort_order", { ascending: true });

    if (filters.category) {
      changeQuery = changeQuery.eq("category", filters.category);
    }

    const { data: changeRows, error: changeError } = await changeQuery;

    if (changeError) {
      throw changeError;
    }

    changes = changeRows ?? [];
  }

  let releases = rows.map((row) => mapAppRelease(row, changes));

  if (filters.q?.trim()) {
    const query = filters.q.trim().toLowerCase();
    releases = releases.filter(
      (release) =>
        release.version.toLowerCase().includes(query) ||
        release.title.toLowerCase().includes(query) ||
        release.summary.toLowerCase().includes(query) ||
        release.changes.some((change) =>
          change.description.toLowerCase().includes(query),
        ),
    );
  }

  if (filters.category) {
    releases = releases
      .map((release) => ({
        ...release,
        changes: release.changes.filter(
          (change) => change.category === filters.category,
        ),
      }))
      .filter((release) => release.changes.length > 0);
  }

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? releases.slice(0, limit) : releases;

  return {
    releases: pageRows,
    hasMore,
    nextOffset: offset + pageRows.length,
  };
}

export async function getLatestPublishedRelease(
  supabase: BuxmeSupabaseClient,
): Promise<AppRelease | null> {
  const { data, error } = await supabase
    .from("app_releases")
    .select(
      "id, version, release_date, title, summary, published, featured, published_at, created_at, updated_at",
    )
    .eq("published", true)
    .order("release_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: changes, error: changeError } = await supabase
    .from("app_release_changes")
    .select("id, release_id, category, description, sort_order")
    .eq("release_id", data.id)
    .order("sort_order", { ascending: true });

  if (changeError) {
    throw changeError;
  }

  return mapAppRelease(data, changes ?? []);
}

export async function hasUserSeenRelease(
  supabase: BuxmeSupabaseClient,
  userId: string,
  releaseId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_release_views")
    .select("user_id")
    .eq("user_id", userId)
    .eq("release_id", releaseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function markReleaseSeen(
  supabase: BuxmeSupabaseClient,
  userId: string,
  releaseId: string,
): Promise<void> {
  const { error } = await supabase.from("user_release_views").upsert(
    {
      user_id: userId,
      release_id: releaseId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,release_id" },
  );

  if (error) {
    throw error;
  }
}

export async function getReleaseById(
  supabase: BuxmeSupabaseClient,
  releaseId: string,
): Promise<AppRelease | null> {
  const { data, error } = await supabase
    .from("app_releases")
    .select(
      "id, version, release_date, title, summary, published, featured, published_at, created_at, updated_at",
    )
    .eq("id", releaseId)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: changes, error: changeError } = await supabase
    .from("app_release_changes")
    .select("id, release_id, category, description, sort_order")
    .eq("release_id", data.id)
    .order("sort_order", { ascending: true });

  if (changeError) {
    throw changeError;
  }

  return mapAppRelease(data, changes ?? []);
}
