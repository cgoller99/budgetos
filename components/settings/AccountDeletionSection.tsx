"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export function AccountDeletionSection() {
  const { signOut, isConfigured } = useAuth();
  const { showToast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isConfigured) {
    return null;
  }

  async function handleDelete() {
    if (confirmText !== "DELETE") {
      showToast({
        title: "Confirmation required",
        subtitle: 'Type DELETE to permanently remove your account.',
      });
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to delete account.");
      }

      showToast({
        title: "Account deleted",
        subtitle: "Your Buxme account and data have been removed.",
      });
      await signOut();
      window.location.assign("/");
    } catch (error) {
      showToast({
        title: "Deletion failed",
        subtitle:
          error instanceof Error ? error.message : "Unable to delete account.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Delete account"
        description="Permanently delete your Buxme account, finance data, and bank connections. This cannot be undone."
      />
      <CardContent className="space-y-4">
        <p className="text-sm text-white/45">
          Apple App Store guidelines require in-app account deletion. Type{" "}
          <span className="font-semibold text-white">DELETE</span> to confirm.
        </p>
        <Input
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
        />
        <Button
          variant="secondary"
          className="border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger-muted)]"
          disabled={isDeleting || confirmText !== "DELETE"}
          onClick={() => void handleDelete()}
        >
          {isDeleting ? "Deleting..." : "Delete my account"}
        </Button>
      </CardContent>
    </Card>
  );
}
