"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { useWhatsNewOptional } from "@/context/WhatsNewContext";
import type { EnrichedNotification } from "@/lib/notifications/center";
import {
  dedupeNotifications,
  dismissVirtualNotification,
  enrichNotification,
  filterNotifications,
  formatRelativeNotificationTime,
  getNotificationCategoryMeta,
  groupNotificationsByTime,
  readDismissedVirtualNotificationIds,
  sortNotificationsNewestFirst,
} from "@/lib/notifications/center";
import { markReleaseSeen } from "@/lib/whatsNew/clientApi";

const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 12;

function NotificationSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[var(--text-muted)]"
      >
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search notifications"
        aria-label="Search notifications"
        className={cn(
          "focus-ring min-h-11 w-full rounded-2xl border border-[var(--surface-border)]",
          "bg-[var(--surface)] px-4 py-2.5 pl-11 text-sm text-[var(--foreground)]",
          "placeholder:text-[var(--text-subtle)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
          "transition-all duration-200 ease-out",
          "hover:border-[var(--surface-border-strong)] hover:bg-[var(--focus-surface)]",
          "focus:border-[#0077ed]/40 focus:bg-[var(--focus-surface)]",
        )}
      />
    </div>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
  onCompleteAutomation,
  onDismissAutomation,
}: {
  notification: EnrichedNotification;
  onMarkRead: () => void;
  onDelete: () => void;
  onNavigate: () => void;
  onCompleteAutomation?: () => void;
  onDismissAutomation?: () => void;
}) {
  const meta = getNotificationCategoryMeta(notification.category);

  return (
    <article
      className={cn(
        "group rounded-2xl border px-3.5 py-3.5 transition-colors duration-200 sm:px-4 sm:py-4",
        notification.read
          ? "border-[var(--surface-border)] bg-[var(--surface-soft)]"
          : "border-[#0077ed]/20 bg-[#0077ed]/10 shadow-[inset_0_1px_0_rgba(77,163,255,0.08)]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg",
            meta.bgClass,
          )}
          aria-hidden
        >
          {notification.icon || meta.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-semibold leading-snug sm:text-[15px]",
                  meta.accentClass,
                  notification.read && "text-[var(--foreground)]",
                )}
              >
                {notification.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                {notification.subtitle}
              </p>
            </div>
            {!notification.read ? (
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0077ed]"
              />
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-subtle)]">
            <span>{formatRelativeNotificationTime(notification.timestamp)}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {notification.actions ? (
              <>
                <Button size="sm" onClick={() => onCompleteAutomation?.()}>
                  {notification.actions.primary.label}
                </Button>
                {notification.actions.secondary ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onDismissAutomation?.()}
                  >
                    {notification.actions.secondary.label}
                  </Button>
                ) : null}
              </>
            ) : null}

            {notification.href ? (
              <Link
                href={notification.href}
                onClick={() => {
                  onMarkRead();
                  onNavigate();
                }}
                className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-[#0077ed] transition-colors hover:bg-[#0077ed]/10"
              >
                View details
              </Link>
            ) : null}

            {!notification.read && !notification.actions ? (
              <button
                type="button"
                onClick={onMarkRead}
                className="focus-ring min-h-10 rounded-xl px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                Mark read
              </button>
            ) : null}

            <button
              type="button"
              onClick={onDelete}
              className="focus-ring ml-auto min-h-10 rounded-xl px-3 text-sm text-[var(--text-subtle)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-rose-300"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function NotificationCenter() {
  const {
    notifications,
    unreadNotificationCount,
    automationSuggestions,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    dismissAutomationSuggestion,
    completeAutomationSuggestion,
  } = useFinance();
  const whatsNew = useWhatsNewOptional();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [dismissedVirtualIds, setDismissedVirtualIds] = useState<Set<string>>(
    () => new Set(),
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDismissedVirtualIds(readDismissedVirtualNotificationIds());
  }, [isOpen]);

  const mergedNotifications = useMemo(() => {
    const releaseItems = whatsNew?.releaseNotification ? [whatsNew.releaseNotification] : [];
    const combined = dedupeNotifications(
      sortNotificationsNewestFirst([...releaseItems, ...notifications]),
    );

    return combined
      .filter((notification) => !dismissedVirtualIds.has(notification.id))
      .map((notification) =>
        enrichNotification(notification, {
          isVirtual: !notifications.some((item) => item.id === notification.id),
        }),
      );
  }, [dismissedVirtualIds, notifications, whatsNew]);

  const filteredNotifications = useMemo(
    () => filterNotifications(mergedNotifications, searchQuery),
    [mergedNotifications, searchQuery],
  );

  const visibleNotifications = useMemo(
    () => filteredNotifications.slice(0, visibleCount),
    [filteredNotifications, visibleCount],
  );

  const groupedNotifications = useMemo(
    () => groupNotificationsByTime(visibleNotifications),
    [visibleNotifications],
  );

  const mergedUnreadCount =
    unreadNotificationCount + (whatsNew?.releaseNotification ? 1 : 0);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const handleDelete = useCallback(
    (notification: EnrichedNotification) => {
      if (notification.id.startsWith("release-")) {
        const releaseId = notification.id.replace("release-", "");
        void markReleaseSeen(releaseId);
        whatsNew?.dismissReleaseNotification();
        return;
      }

      if (notification.automationSuggestionId) {
        dismissAutomationSuggestion(notification.automationSuggestionId);
        return;
      }

      if (notification.isVirtual) {
        dismissVirtualNotification(notification.id);
        setDismissedVirtualIds(readDismissedVirtualNotificationIds());
        return;
      }

      deleteNotification(notification.id);
    },
    [deleteNotification, dismissAutomationSuggestion, whatsNew],
  );

  const handleOpen = () => {
    setIsOpen((current) => {
      if (!current) {
        setSearchQuery("");
        setVisibleCount(INITIAL_VISIBLE);
      }
      return !current;
    });
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="focus-ring relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        aria-label={`Notifications${mergedUnreadCount > 0 ? `, ${mergedUnreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {mergedUnreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0077ed] px-1 text-[10px] font-semibold text-white shadow-[0_2px_8px_rgba(0,119,237,0.45)]"
            aria-hidden
          >
            {mergedUnreadCount > 9 ? "9+" : mergedUnreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="notification-backdrop-enter fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className={cn(
              "notification-panel-enter fixed z-50 flex flex-col overflow-hidden border border-[var(--surface-border)] bg-[var(--background)] shadow-2xl shadow-black/30",
              "inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] max-h-[calc(100vh-6rem-env(safe-area-inset-top))] rounded-3xl",
              "lg:absolute lg:inset-x-auto lg:inset-y-auto lg:right-0 lg:top-14 lg:max-h-[min(32rem,calc(100vh-6rem))] lg:w-[min(24rem,calc(100vw-2rem))]",
            )}
          >
            <div className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[var(--foreground)]">
                    Notifications
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {mergedUnreadCount > 0
                      ? `${mergedUnreadCount} unread`
                      : "You're all caught up"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {mergedUnreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="focus-ring rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    >
                      Mark all read
                    </button>
                  ) : null}
                  {mergedNotifications.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearAllNotifications();
                        setDismissedVirtualIds(readDismissedVirtualNotificationIds());
                      }}
                      className="focus-ring rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-rose-300"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <NotificationSearchInput value={searchQuery} onChange={setSearchQuery} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-2xl"
                    aria-hidden
                  >
                    {searchQuery.trim() ? "🔍" : "✓"}
                  </span>
                  <p className="mt-4 text-base font-medium text-[var(--foreground)]">
                    {searchQuery.trim() ? "No matching notifications" : "You're all caught up."}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {searchQuery.trim()
                      ? "Try a different search term."
                      : "No new notifications."}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedNotifications.map((group) => (
                    <section key={group.key} aria-label={group.label}>
                      <p className="sticky top-0 z-10 mb-2 bg-[var(--background)] px-1 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                        {group.label}
                      </p>
                      <ul className="space-y-2" role="list">
                        {group.items.map((notification) => (
                          <li key={notification.id}>
                            <NotificationRow
                              notification={notification}
                              onMarkRead={() => markNotificationRead(notification.id)}
                              onDelete={() => handleDelete(notification)}
                              onNavigate={() => setIsOpen(false)}
                              onCompleteAutomation={() => {
                                const suggestion = automationSuggestions.find(
                                  (item) =>
                                    item.id ===
                                    (notification.automationSuggestionId ?? notification.id),
                                );

                                if (suggestion) {
                                  void completeAutomationSuggestion(suggestion);
                                }
                              }}
                              onDismissAutomation={() =>
                                dismissAutomationSuggestion(
                                  notification.automationSuggestionId ?? notification.id,
                                )
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  {visibleCount < filteredNotifications.length ? (
                    <div className="pt-1">
                      <Button
                        variant="secondary"
                        size="md"
                        fullWidth
                        onClick={() =>
                          setVisibleCount((current) => current + LOAD_MORE_STEP)
                        }
                      >
                        Load older notifications
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
