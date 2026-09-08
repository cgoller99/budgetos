"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Modal,
} from "@/components/ui";
import type { AiTeamPlaybook } from "@/lib/ai-team/types";
import { BUILT_IN_PLAYBOOKS } from "./shared";

type Draft = {
  id?: string;
  title: string;
  description: string;
  category: string;
  goalTemplate: string;
  favorite: boolean;
};

const emptyDraft = (goal: string): Draft => ({
  title: "",
  description: "",
  category: "Operations",
  goalTemplate: goal,
  favorite: false,
});

export function Playbooks({
  playbooks,
  currentGoal,
  onChoose,
  onSave,
  onDelete,
}: {
  playbooks: AiTeamPlaybook[];
  currentGoal: string;
  onChoose: (goal: string) => void;
  onSave: (draft: Draft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AiTeamPlaybook | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function save(next = draft) {
    if (!next) return;
    setSaving(true);
    try {
      await onSave(next);
      setDraft(null);
    } catch {
      // The parent keeps the form visible and reports the API error.
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      // The parent reports the API error.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Playbooks</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Templates fill the composer only. They never start a run automatically.
          </p>
        </div>
        <Button onClick={() => setDraft(emptyDraft(currentGoal))}>Create from goal</Button>
      </div>

      {draft ? (
        <Card>
          <CardHeader
            title={draft.id ? "Edit custom playbook" : "Create custom playbook"}
            description="Store a reusable planning prompt."
          />
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-[var(--text-muted)]">
              Title
              <Input className="mt-2" value={draft.title} maxLength={100} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              Category
              <Input className="mt-2" value={draft.category} maxLength={60} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
            </label>
            <label className="text-xs text-[var(--text-muted)] md:col-span-2">
              Description
              <Input className="mt-2" value={draft.description} maxLength={500} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </label>
            <label className="text-xs text-[var(--text-muted)] md:col-span-2">
              Goal template
              <textarea
                className="focus-ring mt-2 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-sm text-[var(--foreground)] outline-none"
                rows={5}
                maxLength={1000}
                value={draft.goalTemplate}
                onChange={(event) => setDraft({ ...draft, goalTemplate: event.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={draft.favorite}
                onChange={(event) => setDraft({ ...draft, favorite: event.target.checked })}
              />
              Favorite
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
              <Button
                onClick={() => void save()}
                disabled={
                  saving ||
                  draft.title.trim().length < 2 ||
                  draft.category.trim().length < 2 ||
                  draft.goalTemplate.trim().length < 3
                }
              >
                {saving ? "Saving…" : "Save playbook"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section>
        <h4 className="text-sm font-semibold text-[var(--foreground)]">Built-in playbooks</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BUILT_IN_PLAYBOOKS.map((playbook) => (
            <button
              key={playbook.title}
              type="button"
              onClick={() => onChoose(playbook.goalTemplate)}
              className="focus-ring rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4 text-left transition-colors hover:border-[var(--surface-border-strong)]"
            >
              <Badge variant="default">{playbook.category}</Badge>
              <p className="mt-3 font-semibold text-[var(--foreground)]">{playbook.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{playbook.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-[var(--foreground)]">Custom playbooks</h4>
        {playbooks.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {playbooks.map((playbook) => (
              <Card key={playbook.id} padding="compact">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="default">{playbook.category}</Badge>
                  <button
                    type="button"
                    aria-label={playbook.favorite ? "Remove favorite" : "Add favorite"}
                    className="focus-ring rounded-lg px-2 py-1 text-amber-300"
                    onClick={() =>
                      void save({
                        ...playbook,
                        favorite: !playbook.favorite,
                      })
                    }
                  >
                    {playbook.favorite ? "★" : "☆"}
                  </button>
                </div>
                <p className="mt-3 font-semibold text-[var(--foreground)]">{playbook.title}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{playbook.description || "No description"}</p>
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">{playbook.goalTemplate}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onChoose(playbook.goalTemplate)}>Use</Button>
                  <Button variant="secondary" size="sm" onClick={() => setDraft({ ...playbook })}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => setPendingDelete(playbook)}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5 text-sm text-[var(--text-muted)]">
            No custom playbooks yet.
          </p>
        )}
      </section>

      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        title="Delete custom playbook?"
      >
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          “{pendingDelete?.title}” will be permanently deleted. This does not
          affect any existing runs.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setPendingDelete(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void remove()}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete playbook"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
