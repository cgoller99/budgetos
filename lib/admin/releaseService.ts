import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { mapAppRelease } from "@/lib/whatsNew/mappers";
import type {
  AppRelease,
  CreateReleaseInput,
  ReleaseChangeCategory,
  UpdateReleaseInput,
} from "@/lib/whatsNew/types";

export async function listAllReleases(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AppRelease[]> {
  const { data: releaseRows, error } = await adminSupabase
    .from("app_releases")
    .select(
      "id, version, release_date, title, summary, published, featured, published_at, created_at, updated_at",
    )
    .order("release_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = releaseRows ?? [];

  if (rows.length === 0) {
    return [];
  }

  const releaseIds = rows.map((row) => row.id);

  const { data: changes, error: changeError } = await adminSupabase
    .from("app_release_changes")
    .select("id, release_id, category, description, sort_order")
    .in("release_id", releaseIds)
    .order("sort_order", { ascending: true });

  if (changeError) {
    throw changeError;
  }

  return rows.map((row) => mapAppRelease(row, changes ?? []));
}

async function insertChanges(
  adminSupabase: BuxmeSupabaseClient,
  releaseId: string,
  changes: CreateReleaseInput["changes"],
): Promise<void> {
  if (changes.length === 0) {
    return;
  }

  const { error } = await adminSupabase.from("app_release_changes").insert(
    changes.map((change, index) => ({
      release_id: releaseId,
      category: change.category,
      description: change.description,
      sort_order: change.sortOrder ?? index,
    })),
  );

  if (error) {
    throw error;
  }
}

export async function createRelease(
  adminSupabase: BuxmeSupabaseClient,
  input: CreateReleaseInput,
): Promise<AppRelease> {
  const now = new Date().toISOString();
  const published = Boolean(input.published);

  const { data, error } = await adminSupabase
    .from("app_releases")
    .insert({
      version: input.version.trim(),
      release_date: input.releaseDate,
      title: input.title.trim(),
      summary: input.summary.trim(),
      featured: Boolean(input.featured),
      published,
      published_at: published ? now : null,
      updated_at: now,
    })
    .select(
      "id, version, release_date, title, summary, published, featured, published_at, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  await insertChanges(adminSupabase, data.id, input.changes);

  const releases = await listAllReleases(adminSupabase);
  return releases.find((release) => release.id === data.id) ?? mapAppRelease(data);
}

export async function updateRelease(
  adminSupabase: BuxmeSupabaseClient,
  releaseId: string,
  input: UpdateReleaseInput,
): Promise<AppRelease> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.version !== undefined) patch.version = input.version.trim();
  if (input.releaseDate !== undefined) patch.release_date = input.releaseDate;
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.summary !== undefined) patch.summary = input.summary.trim();
  if (input.featured !== undefined) patch.featured = input.featured;

  if (input.published !== undefined) {
    patch.published = input.published;
    patch.published_at = input.published ? new Date().toISOString() : null;
  }

  const { error } = await adminSupabase
    .from("app_releases")
    .update(patch)
    .eq("id", releaseId);

  if (error) {
    throw error;
  }

  if (input.changes) {
    await adminSupabase
      .from("app_release_changes")
      .delete()
      .eq("release_id", releaseId);
    await insertChanges(adminSupabase, releaseId, input.changes);
  }

  const releases = await listAllReleases(adminSupabase);
  const updated = releases.find((release) => release.id === releaseId);

  if (!updated) {
    throw new Error("Release not found after update.");
  }

  return updated;
}

export async function deleteRelease(
  adminSupabase: BuxmeSupabaseClient,
  releaseId: string,
): Promise<void> {
  const { error } = await adminSupabase
    .from("app_releases")
    .delete()
    .eq("id", releaseId);

  if (error) {
    throw error;
  }
}

export async function publishRelease(
  adminSupabase: BuxmeSupabaseClient,
  releaseId: string,
): Promise<AppRelease> {
  return updateRelease(adminSupabase, releaseId, { published: true });
}

export async function unpublishRelease(
  adminSupabase: BuxmeSupabaseClient,
  releaseId: string,
): Promise<AppRelease> {
  return updateRelease(adminSupabase, releaseId, { published: false });
}

export type { ReleaseChangeCategory };
