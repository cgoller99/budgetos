export type ReleaseChangeCategory =
  | "feature"
  | "improvement"
  | "bugfix"
  | "security"
  | "performance";

export type ReleaseChange = {
  id: string;
  releaseId: string;
  category: ReleaseChangeCategory;
  description: string;
  sortOrder: number;
};

export type AppRelease = {
  id: string;
  version: string;
  releaseDate: string;
  title: string;
  summary: string;
  published: boolean;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  changes: ReleaseChange[];
};

export type ReleaseListResponse = {
  releases: AppRelease[];
  hasMore: boolean;
  nextOffset: number;
};

export type LatestReleaseResponse = {
  release: AppRelease | null;
  seen: boolean;
};

export type CreateReleaseInput = {
  version: string;
  releaseDate: string;
  title: string;
  summary: string;
  featured?: boolean;
  published?: boolean;
  changes: Array<{
    category: ReleaseChangeCategory;
    description: string;
    sortOrder?: number;
  }>;
};

export type UpdateReleaseInput = Partial<
  Omit<CreateReleaseInput, "changes">
> & {
  changes?: CreateReleaseInput["changes"];
};
