"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, OverlayPortal } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { useWhatsNewOptional } from "@/context/WhatsNewContext";
import { useFloatingPanelPosition } from "@/lib/ui/useFloatingPanelPosition";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/ui/bodyScrollLock";
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
import {
  DASHBOARD_SECTIONS,
  focusWeeklyPlanSection,
  getWeeklyPlanHref,
  isWeeklySummaryNotification,
  retryScrollToDashboardSection,
} from "@/lib/ui/dashboardSections";

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
          "focus-ring min-h-10 w-full rounded-[var(--radius-input)] border border-[var(--surface-border)]",
          "bg-[var(--surface)] px-4 py-2 pl-11 text-sm text-[var(--foreground)]",
          "placeholder:text-[var(--text-subtle)]",
          "transition-all duration-200 ease-out",
          "hover:border-[var(--surface-border-strong)] hover:bg-[var(--focus-surface)]",
          "focus:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] focus:bg-[var(--focus-surface)]",
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
  onViewDetails,
  onCompleteAutomation,
  onDismissAutomation,
}: {
  notification: EnrichedNotification;
  onMarkRead: () => void;
  onDelete: () => void;
  onNavigate: () => void;
  onViewDetails: (notification: EnrichedNotification) => void;
  onCompleteAutomation?: () => void;
  onDismissAutomation?: () => void;
}) {
  const meta = getNotificationCategoryMeta(notification.category);

  return (
    <article
      className={cn(
        "group rounded-[var(--radius-card)] border px-3.5 py-3 transition-colors duration-200 sm:px-4 sm:py-3.5",
        notification.read
          ? "border-[var(--surface-border)] bg-[var(--surface-soft)]"
          : "border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[var(--accent-muted)]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-base",
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
                  "text-sm font-semibold leading-snug",
                  meta.accentClass,
                  notification.read && "text-[var(--foreground)]",
                )}
              >
                {notification.title}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-muted)]">
                {notification.subtitle}
              </p>
            </div>
            {!notification.read ? (
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
              />
            ) : null}
          </div>

          <div className="mt-1.5 text-xs text-[var(--text-subtle)]">
            {formatRelativeNotificationTime(notification.timestamp)}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
              isWeeklySummaryNotification(notification) ? (
                <Link
                  href={getWeeklyPlanHref()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onViewDetails(notification);
                  }}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-button)] px-3 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-muted)]"
                >
                  View details
                </Link>
              ) : (
                <Link
                  href={notification.href}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onViewDetails(notification);
                  }}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-button)] px-3 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-muted)]"
                >
                  View details
                </Link>
              )
            ) : null}

            {!notification.read && !notification.actions ? (
              <button
                type="button"
                onClick={onMarkRead}
                className="focus-ring min-h-9 rounded-[var(--radius-button)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                Mark read
              </button>
            ) : null}

            <button
              type="button"
              onClick={onDelete}
              className="focus-ring ml-auto min-h-9 rounded-[var(--radius-button)] px-3 text-sm text-[var(--text-subtle)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]"
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
  const router = useRouter();
  const {
    notifications,
    unreadNotificationCount,
    automationSuggestions,
    markNotificationRead,
    acknowledgeWeeklySummary,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    requestDashboardSection,
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

  const { isMobile, desktopStyle } = useFloatingPanelPosition({
    isOpen,
    triggerRef,
    panelWidth: 384,
  });

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

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
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
    if (!isOpen) return;

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  const handleMarkRead = useCallback(
    (notification: EnrichedNotification) => {
      if (
        notification.isVirtual &&
        isWeeklySummaryNotification(notification)
      ) {
        acknowledgeWeeklySummary();
        return;
      }

      markNotificationRead(notification.id);
    },
    [acknowledgeWeeklySummary, markNotificationRead],
  );

  const handleViewDetails = useCallback(
    (notification: EnrichedNotification) => {
      const isWeeklyPlan = isWeeklySummaryNotification(notification);

      handleMarkRead(notification);
      setIsOpen(false);

      if (isWeeklyPlan) {
        requestDashboardSection(DASHBOARD_SECTIONS.weeklyPlan);

        if (window.location.pathname !== "/dashboard") {
          router.push(getWeeklyPlanHref());
        } else {
          focusWeeklyPlanSection();
        }

        window.setTimeout(() => {
          retryScrollToDashboardSection(DASHBOARD_SECTIONS.weeklyPlan);
        }, 200);

        return;
      }

      if (notification.href) {
        router.push(notification.href);
      }
    },
    [handleMarkRead, requestDashboardSection, router],
  );

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
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="focus-ring relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        aria-label={`Notifications${mergedUnreadCount > 0 ? `, ${mergedUnreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {mergedUnreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {mergedUnreadCount > 9 ? "9+" : mergedUnreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <OverlayPortal>
          <button
            type="button"
            aria-label="Close notifications"
            className="notification-backdrop-enter pointer-events-auto fixed inset-0 z-0 bg-black/45 backdrop-blur-[2px] lg:bg-black/30"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "notification-panel-enter pointer-events-auto fixed z-10 flex flex-col overflow-hidden",
              "border border-[var(--surface-border)] bg-[var(--background)] shadow-2xl shadow-black/50",
              "max-lg:inset-x-3 max-lg:top-[calc(4.25rem+env(safe-area-inset-top))]",
              "max-lg:max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top))] max-lg:rounded-[var(--radius-card)]",
              "lg:rounded-[var(--radius-card)]",
            )}
            style={isMobile ? undefined : desktopStyle}
          >
            <div className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-3.5 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
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
                      className="focus-ring rounded-[var(--radius-button)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
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
                      className="focus-ring rounded-[var(--radius-button)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                <NotificationSearchInput value={searchQuery} onChange={setSearchQuery} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)] bg-[var(--surface-soft)] text-xl"
                    aria-hidden
                  >
                    {searchQuery.trim() ? "🔍" : "✓"}
                  </span>
                  <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                    {searchQuery.trim() ? "No matching notifications" : "You're all caught up."}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {searchQuery.trim()
                      ? "Try a different search term."
                      : "No new notifications."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedNotifications.map((group) => (
                    <section key={group.key} aria-label={group.label}>
                      <p className="sticky top-0 z-10 mb-2 bg-[var(--background)] px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                        {group.label}
                      </p>
                      <ul className="space-y-2" role="list">
                        {group.items.map((notification) => (
                          <li key={notification.id}>
                            <NotificationRow
                              notification={notification}
                              onMarkRead={() => handleMarkRead(notification)}
                              onDelete={() => handleDelete(notification)}
                              onNavigate={() => setIsOpen(false)}
                              onViewDetails={() => handleViewDetails(notification)}
                              onCompleteAutomation={() => {
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
                        size="sm"
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
        </OverlayPortal>
      ) : null}
    </>
  );
}
