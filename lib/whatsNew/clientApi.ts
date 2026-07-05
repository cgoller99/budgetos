import type {
  AppRelease,
  LatestReleaseResponse,
  ReleaseChangeCategory,
  ReleaseListResponse,
} from "@/lib/whatsNew/types";

export async function fetchReleaseList(params: {
  offset?: number;
  limit?: number;
  q?: string;
  category?: ReleaseChangeCategory;
}): Promise<ReleaseListResponse> {
  const search = new URLSearchParams();

  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);

  const response = await fetch(`/api/whats-new?${search.toString()}`);

  if (!response.ok) {
    throw new Error("Unable to load release notes.");
  }

  return response.json() as Promise<ReleaseListResponse>;
}

export async function fetchLatestRelease(): Promise<LatestReleaseResponse> {
  const response = await fetch("/api/whats-new/latest");

  if (!response.ok) {
    throw new Error("Unable to load latest release.");
  }

  return response.json() as Promise<LatestReleaseResponse>;
}

export async function markReleaseSeen(releaseId: string): Promise<void> {
  const response = await fetch("/api/whats-new/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ releaseId }),
  });

  if (!response.ok) {
    throw new Error("Unable to save release view.");
  }
}

export async function fetchAdminReleases(): Promise<{ releases: AppRelease[] }> {
  const response = await fetch("/api/admin/releases");

  if (!response.ok) {
    throw new Error("Unable to load admin releases.");
  }

  return response.json() as Promise<{ releases: AppRelease[] }>;
}

export async function createAdminRelease(
  input: Record<string, unknown>,
): Promise<{ release: AppRelease }> {
  const response = await fetch("/api/admin/releases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Unable to create release.");
  }

  return response.json() as Promise<{ release: AppRelease }>;
}

export async function updateAdminRelease(
  releaseId: string,
  input: Record<string, unknown>,
): Promise<{ release: AppRelease }> {
  const response = await fetch(`/api/admin/releases/${releaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Unable to update release.");
  }

  return response.json() as Promise<{ release: AppRelease }>;
}

export async function deleteAdminRelease(releaseId: string): Promise<void> {
  const response = await fetch(`/api/admin/releases/${releaseId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Unable to delete release.");
  }
}
