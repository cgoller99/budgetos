"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormField,
  Input,
  Select,
} from "@/components/ui";
import {
  createAdminRelease,
  deleteAdminRelease,
  fetchAdminReleases,
  updateAdminRelease,
} from "@/lib/whatsNew/clientApi";
import { RELEASE_CATEGORY_META } from "@/lib/whatsNew/constants";
import type {
  AppRelease,
  ReleaseChangeCategory,
} from "@/lib/whatsNew/types";

const EMPTY_CHANGE = {
  category: "feature" as ReleaseChangeCategory,
  description: "",
};

export function AdminReleasesSection() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    version: "",
    releaseDate: new Date().toISOString().slice(0, 10),
    title: "",
    summary: "",
    featured: false,
    published: false,
    changes: [{ ...EMPTY_CHANGE }],
  });

  const loadReleases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAdminReleases();
      setReleases(result.releases);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load releases.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await createAdminRelease({
        ...form,
        changes: form.changes.filter((change) => change.description.trim()),
      });
      setForm({
        version: "",
        releaseDate: new Date().toISOString().slice(0, 10),
        title: "",
        summary: "",
        featured: false,
        published: false,
        changes: [{ ...EMPTY_CHANGE }],
      });
      await loadReleases();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save release.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish(releaseId: string) {
    await updateAdminRelease(releaseId, { action: "publish" });
    await loadReleases();
  }

  async function handleUnpublish(releaseId: string) {
    await updateAdminRelease(releaseId, { action: "unpublish" });
    await loadReleases();
  }

  async function handleDelete(releaseId: string) {
    if (!window.confirm("Delete this release?")) {
      return;
    }

    await deleteAdminRelease(releaseId);
    await loadReleases();
  }

  return (
    <section id="releases" className="scroll-mt-24 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Release manager
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Publish What&apos;s New entries without a code deployment.
        </p>
      </div>

      <Card padding="lg">
        <CardHeader title="Create release" />
        <CardContent>
          <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Version">
                <Input
                  value={form.version}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      version: event.target.value,
                    }))
                  }
                  placeholder="1.1.0"
                  required
                />
              </FormField>
              <FormField label="Release date">
                <Input
                  type="date"
                  value={form.releaseDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      releaseDate: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>
            </div>

            <FormField label="Title">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </FormField>

            <FormField label="Summary">
              <textarea
                value={form.summary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]/40"
              />
            </FormField>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Changes
              </p>
              {form.changes.map((change, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--surface-border)] p-4 md:grid-cols-[10rem_1fr_auto]"
                >
                  <Select
                    value={change.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        changes: current.changes.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                category: event.target
                                  .value as ReleaseChangeCategory,
                              }
                            : item,
                        ),
                      }))
                    }
                  >
                    {Object.entries(RELEASE_CATEGORY_META).map(
                      ([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.emoji} {meta.label}
                        </option>
                      ),
                    )}
                  </Select>
                  <Input
                    value={change.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        changes: current.changes.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, description: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    placeholder="Describe the change"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        changes: current.changes.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    changes: [...current.changes, { ...EMPTY_CHANGE }],
                  }))
                }
              >
                Add change
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      featured: event.target.checked,
                    }))
                  }
                />
                Featured
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      published: event.target.checked,
                    }))
                  }
                />
                Publish immediately
              </label>
            </div>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Create release"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card padding="lg">
        <CardHeader title="All releases" />
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No releases yet.</p>
          ) : (
            releases.map((release) => (
              <div
                key={release.id}
                className="rounded-2xl border border-[var(--surface-border)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      v{release.version} · {release.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {release.summary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={release.published ? "success" : "default"}>
                      {release.published ? "Published" : "Draft"}
                    </Badge>
                    {release.featured ? (
                      <Badge variant="accent">Featured</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {release.published ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleUnpublish(release.id)}
                    >
                      Unpublish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void handlePublish(release.id)}
                    >
                      Publish
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleDelete(release.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
