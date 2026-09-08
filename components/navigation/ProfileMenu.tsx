"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OverlayPortal } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useFloatingPanelPosition } from "@/lib/ui/useFloatingPanelPosition";
import { navigateSettingsDeepLink } from "@/lib/native/navigateSettingsHash";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { triggerHaptic } from "@/lib/native/haptics";

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const nativeIos = useNativeIos();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { panelStyle } = useFloatingPanelPosition({
    isOpen: open && !nativeIos,
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
        onClick={() => {
          void triggerHaptic("selection");
          setOpen((current) => !current);
        }}
        className={cn(
          "focus-ring flex h-11 w-11 items-center justify-center rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-sm font-semibold text-[var(--accent-light)] transition-colors hover:bg-[var(--surface-hover)]",
          nativeIos && "size-9 rounded-full border-white/[0.08]",
        )}
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
            className={cn(
              "pointer-events-auto fixed inset-0 bg-black/20 lg:bg-transparent",
              nativeIos && "bg-black/50 backdrop-blur-sm",
            )}
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            role="menu"
            className={cn(
              "notification-panel-enter pointer-events-auto fixed z-10 overflow-hidden rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--background)] shadow-2xl shadow-black/50",
              nativeIos &&
                "native-sheet inset-x-0 bottom-0 z-50 max-h-[70vh] w-auto rounded-t-[16px] border-white/[0.08] pb-[calc(1rem+env(safe-area-inset-bottom))]",
            )}
            style={nativeIos ? undefined : panelStyle}
          >
            {nativeIos ? (
              <div className="mx-auto mb-2 mt-2 h-1 w-10 rounded-full bg-white/20" />
            ) : null}
            <div className="border-b border-[var(--surface-border)] px-4 py-3">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                {user?.user_metadata?.full_name ?? "Your account"}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">{user?.email}</p>
            </div>
            <div className={cn("p-2", nativeIos && "space-y-1 p-3")}>
              {[
                { href: "/settings", label: "Settings" },
                { href: "/whats-new", label: "What's New" },
                { href: "/settings#billing", label: "Subscription" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={(event) => {
                    void triggerHaptic("selection");
                    setOpen(false);
                    if (navigateSettingsDeepLink(item.href, pathname)) {
                      event.preventDefault();
                    }
                  }}
                  className={cn(
                    "focus-ring block min-h-10 rounded-[var(--radius-button)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                    nativeIos &&
                      "min-h-12 rounded-[12px] bg-white/[0.04] px-3.5 text-[16px] text-[var(--foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void triggerHaptic("warning");
                  void handleSignOut();
                }}
                className={cn(
                  "focus-ring mt-1 block min-h-10 w-full rounded-[var(--radius-button)] px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  nativeIos &&
                    "min-h-12 rounded-[12px] bg-[var(--danger)]/10 px-3.5 text-[16px] font-semibold text-[var(--danger)]",
                )}
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
