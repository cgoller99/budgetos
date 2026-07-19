"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const initials =
    user?.email?.slice(0, 2).toUpperCase() ??
    user?.user_metadata?.full_name?.slice(0, 2)?.toUpperCase() ??
    "ME";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="focus-ring flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-sm font-semibold text-[var(--accent-light)] transition-colors hover:bg-[var(--surface-border)]"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {initials}
      </button>

      {open ? (
        <div
          role="menu"
          className="notification-panel-enter absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--background)] shadow-2xl shadow-black/40"
        >
          <div className="border-b border-[var(--surface-border)] px-4 py-3">
            <p className="truncate text-sm font-medium text-[var(--foreground)]">
              {user?.user_metadata?.full_name ?? "Your account"}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {user?.email}
            </p>
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
                  "focus-ring block min-h-11 rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              className="focus-ring mt-1 block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
