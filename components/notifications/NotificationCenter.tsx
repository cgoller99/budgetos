"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import type { FinanceEventTone } from "@/lib/events/types";
import { formatEventTimestamp } from "@/lib/events";

const toneClasses: Record<FinanceEventTone, string> = {
  positive: "text-emerald-400/90",
  negative: "text-rose-300/90",
  neutral: "text-white/70",
  accent: "text-[#0077ed]",
};

export function NotificationCenter() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  function handleOpen() {
    setIsOpen((current) => !current);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.02] text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unreadNotificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0077ed] px-1 text-[10px] font-semibold text-white">
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/[0.04] bg-[#0f1419] shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
            <p className="text-base font-semibold text-white">Notifications</p>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="text-sm text-white/45 transition-colors hover:text-white/70"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-3">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-base text-white/38">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="space-y-1">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => markNotificationRead(notification.id)}
                      className={cn(
                        "w-full rounded-2xl px-4 py-4 text-left transition-colors hover:bg-white/[0.03]",
                        !notification.read && "bg-[#0077ed]/10",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-xl">{notification.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-base font-medium",
                              toneClasses[notification.tone],
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="mt-1 text-sm text-white/38">
                            {notification.subtitle}
                          </p>
                          <p className="mt-2 text-sm text-white/28">
                            {formatEventTimestamp(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </button>
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
