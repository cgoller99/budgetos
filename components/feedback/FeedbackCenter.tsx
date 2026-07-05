"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Input, Modal, Select } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ANALYTICS_EVENTS, APP_VERSION, trackEvent } from "@/lib/analytics/client";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_TYPES,
  type FeedbackCategory,
  type FeedbackPriority,
  type FeedbackReportType,
} from "@/lib/feedback/types";

function getBrowserLabel(): string {
  if (typeof navigator === "undefined") {
    return "Unknown";
  }

  return navigator.userAgent;
}

function getDeviceLabel(): string {
  if (typeof navigator === "undefined") {
    return "Unknown";
  }

  const platform = navigator.platform || "unknown";
  const width = window.innerWidth;
  const type = width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
  return `${type} · ${platform}`;
}

export function FeedbackCenter() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<FeedbackReportType>("feedback");
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [priority, setPriority] = useState<FeedbackPriority>("normal");
  const [message, setMessage] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const autoContext = useMemo(
    () => ({
      pagePath: pathname,
      browser: getBrowserLabel(),
      device: getDeviceLabel(),
      appVersion: APP_VERSION,
      userId: user?.id ?? null,
      email: user?.email ?? null,
    }),
    [pathname, user?.email, user?.id],
  );

  const resetForm = useCallback(() => {
    setReportType("feedback");
    setCategory("general");
    setPriority("normal");
    setMessage("");
    setScreenshotFile(null);
    setRecordingFile(null);
  }, []);

  async function uploadAttachment(file: File, kind: "screenshot" | "recording") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const response = await fetch("/api/feedback/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Attachment upload failed.");
    }

    const payload = (await response.json()) as { url?: string };
    return payload.url ?? null;
  }

  async function handleSubmit() {
    if (!message.trim()) {
      showToast({ title: "Message required", subtitle: "Tell us what happened or what you'd like to see." });
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotUrl: string | null = null;
      let recordingUrl: string | null = null;

      if (screenshotFile) {
        screenshotUrl = await uploadAttachment(screenshotFile, "screenshot");
      }

      if (recordingFile) {
        recordingUrl = await uploadAttachment(recordingFile, "recording");
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          message: message.trim(),
          category,
          priority,
          screenshotUrl,
          recordingUrl,
          pagePath: autoContext.pagePath,
          browser: autoContext.browser,
          device: autoContext.device,
          appVersion: autoContext.appVersion,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to submit feedback.");
      }

      trackEvent(
        ANALYTICS_EVENTS.COMPLETED_FEEDBACK,
        {
          report_type: reportType,
          category,
          priority,
          page_path: autoContext.pagePath,
        },
        { dedupeKey: `feedback-${Date.now()}` },
      );

      showToast({
        title: "Feedback sent",
        subtitle: "Thanks — our team will review it soon.",
      });
      resetForm();
      setIsOpen(false);
    } catch (error) {
      showToast({
        title: "Submission failed",
        subtitle: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 min-w-12 items-center justify-center rounded-full border border-[#0077ed]/30 bg-[#0077ed] px-4 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,119,237,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:bottom-6 sm:right-6",
        )}
        aria-label="Open feedback center"
      >
        Feedback
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Feedback Center">
        <div className="space-y-4">
          <p className="text-sm text-white/55">
            Share feedback, report bugs, or request features. Context is captured automatically.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block text-white/45">Type</span>
              <Select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as FeedbackReportType)}
              >
                {FEEDBACK_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-white/45">Category</span>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
              >
                {FEEDBACK_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-2 block text-white/45">Priority</span>
            <Select
              value={priority}
              onChange={(event) => setPriority(event.target.value as FeedbackPriority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-white/45">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#0077ed]/40"
              placeholder="Describe your feedback, bug, or feature idea..."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block text-white/45">Screenshot (optional)</span>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => setScreenshotFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block text-white/45">Screen recording (optional)</span>
              <Input
                type="file"
                accept="video/*"
                onChange={(event) => setRecordingFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-white/40">
            <p>Page: {autoContext.pagePath}</p>
            <p className="mt-1 truncate">Device: {autoContext.device}</p>
            <p className="mt-1">Version: {autoContext.appVersion}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button size="md" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Submit feedback"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
