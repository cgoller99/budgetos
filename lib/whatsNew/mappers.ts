import type {
  AppRelease,
  ReleaseChange,
  ReleaseChangeCategory,
} from "@/lib/whatsNew/types";

type ReleaseRow = {
  id: string;
  version: string;
  release_date: string;
  title: string;
  summary: string;
  published: boolean;
  featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ChangeRow = {
  id: string;
  release_id: string;
  category: ReleaseChangeCategory;
  description: string;
  sort_order: number;
};

export function mapReleaseChange(row: ChangeRow): ReleaseChange {
  return {
    id: row.id,
    releaseId: row.release_id,
    category: row.category,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

export function mapAppRelease(
  row: ReleaseRow,
  changes: ChangeRow[] = [],
): AppRelease {
  return {
    id: row.id,
    version: row.version,
    releaseDate: row.release_date,
    title: row.title,
    summary: row.summary,
    published: row.published,
    featured: row.featured,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    changes: changes
      .filter((change) => change.release_id === row.id)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map(mapReleaseChange),
  };
}
