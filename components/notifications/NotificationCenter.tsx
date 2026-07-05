"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import type { FinanceEventTone } from "@/lib/events/types";
import { formatEventTimestamp } from "@/lib/events";

const toneClasses: Record<FinanceEventTone, string> = {
  positive: "text-emerald-400/90",
  negative: "text-rose-300/90",
  neutral: "text-[var(--foreground)]",
  accent: "text-[#0077ed]",
};

const toneBorderClasses: Record<FinanceEventTone, string> = {
  positive: "border-emerald-500/15",
  negative: "border-rose-500/15",
  neutral: "border-[var(--surface-border)]",
  accent: "border-[#0077ed]/20",
};

export function NotificationCenter() {
  const {
    notifications,
    unreadNotificationCount,
    automationSuggestions,
    markNotificationRead,
    markAllNotificationsRead,
    dismissAutomationSuggestion,
    completeAutomationSuggestion,
  } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function handleOpen() {
    setIsOpen((current) => !current);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="focus-ring relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-border)] hover:text-[var(--foreground)]"
        aria-label={`Notifications${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {unreadNotificationCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0077ed] px-1 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="notification-panel-enter absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--background)] shadow-2xl shadow-black/40"
        >
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
            <p className="text-base font-semibold text-[var(--foreground)]">
              Notifications
            </p>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="focus-ring rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-3">
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <span className="text-2xl opacity-50" aria-hidden>
                  ✓
                </span>
                <p className="mt-3 text-base text-[var(--text-muted)]">
                  You&apos;re all caught up.
                </p>
              </div>
            ) : (
              <ul className="space-y-1" role="list">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <div
                      className={cn(
                        "rounded-2xl border px-4 py-4 transition-colors",
                        toneBorderClasses[notification.tone],
                        !notification.read && "bg-[#0077ed]/10",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-xl" aria-hidden>
                          {notification.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-base font-medium",
                              toneClasses[notification.tone],
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">
                            {notification.subtitle}
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-muted)]">
                            {formatEventTimestamp(notification.timestamp)}
                          </p>

                          {notification.actions ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  const suggestion = automationSuggestions.find(
                                    (item) =>
                                      item.id ===
                                      (notification.automationSuggestionId ??
                                        notification.id),
                                  );

                                  if (suggestion) {
                                    void completeAutomationSuggestion(suggestion);
                                  }
                                }}
                              >
                                {notification.actions.primary.label}
                              </Button>
                              {notification.actions.secondary && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    dismissAutomationSuggestion(
                                      notification.automationSuggestionId ??
                                        notification.id,
                                    )
                                  }
                                >
                                  {notification.actions.secondary.label}
                                </Button>
                              )}
                              {notification.detailHref && (
                                <Link
                                  href={notification.detailHref}
                                  className="self-center text-sm text-[#0077ed] hover:underline"
                                >
                                  View details
                                </Link>
                              )}
                            </div>
                          ) : (
                            !notification.read && (
                              <button
                                type="button"
                                onClick={() =>
                                  markNotificationRead(notification.id)
                                }
                                className="focus-ring mt-3 rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
                              >
                                Mark read
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
