"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OverlayPortal } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useFloatingPanelPosition } from "@/lib/ui/useFloatingPanelPosition";

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { isMobile, desktopStyle } = useFloatingPanelPosition({
    isOpen: open,
    triggerRef,
    panelWidth: 224,
  });

  const initials =
    user?.email?.slice(0, 2).toUpperCase() ??
    user?.user_metadata?.full_name?.slice(0, 2)?.toUpperCase() ??
    "ME";

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace("/login");
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="focus-ring flex h-11 w-11 items-center justify-center rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-sm font-semibold text-[var(--accent-light)] transition-colors hover:bg-[var(--surface-hover)]"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {initials}
      </button>

      {open ? (
        <OverlayPortal>
          <button
            type="button"
            aria-label="Close profile menu"
            className="pointer-events-auto fixed inset-0 bg-black/20 lg:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            role="menu"
            className="notification-panel-enter pointer-events-auto fixed z-[1] overflow-hidden rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--background)] shadow-2xl shadow-black/50"
            style={
              isMobile
                ? {
                    top: triggerRef.current
                      ? triggerRef.current.getBoundingClientRect().bottom + 8
                      : 64,
                    right: 12,
                    width: "min(14rem, calc(100vw - 24px))",
                  }
                : desktopStyle
            }
          >
            <div className="border-b border-[var(--surface-border)] px-4 py-3">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                {user?.user_metadata?.full_name ?? "Your account"}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">{user?.email}</p>
            </div>
            <div className="p-2">
              {[
                { href: "/settings", label: "Settings" },
                { href: "/whats-new", label: "What's New" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "focus-ring block min-h-10 rounded-[var(--radius-button)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleSignOut()}
                className="focus-ring mt-1 block min-h-10 w-full rounded-[var(--radius-button)] px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                Sign out
              </button>
            </div>
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}
