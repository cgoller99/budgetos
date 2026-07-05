"use client";

import Link from "next/link";
import { Button, Modal } from "@/components/ui";
import { ReleaseCard } from "@/components/whatsNew/ReleaseCard";
import type { AppRelease } from "@/lib/whatsNew/types";

type WhatsNewModalProps = {
  release: AppRelease;
  isOpen: boolean;
  onContinue: () => void;
};

export function WhatsNewModal({
  release,
  isOpen,
  onContinue,
}: WhatsNewModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onContinue}
      title={`Welcome to Buxme v${release.version}`}
    >
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Here&apos;s what changed in this update.
      </p>
      <div className="max-h-[min(50vh,24rem)] overflow-y-auto pr-1">
        <ReleaseCard release={release} highlight />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href="/whats-new" className="sm:order-1">
          <Button variant="secondary" className="w-full sm:w-auto">
            View full release notes
          </Button>
        </Link>
        <Button onClick={onContinue} className="w-full sm:w-auto">
          Continue
        </Button>
      </div>
    </Modal>
  );
}
