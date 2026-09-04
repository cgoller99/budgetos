"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import {
  sidebarActiveClassName,
  sidebarInactiveClassName,
} from "@/components/ui/tokens";
import {
  IOS_MORE_GROUPS,
  IOS_MORE_NAV,
  MOBILE_MORE_NAV,
} from "@/lib/mobile/navigation";
import { navigateSettingsDeepLink } from "@/lib/native/navigateSettingsHash";
import { triggerHaptic } from "@/lib/native/haptics";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { IosTintIcon } from "@/components/native/ios/IosPrimitives";

const IOS_MORE_ICON_TONE: Record<
  string,
  "accent" | "success" | "warning" | "danger" | "purple" | "muted"
> = {
  Income: "success",
  Goals: "warning",
  Investments: "purple",
  Transactions: "accent",
  Reports: "accent",
  Calendar: "warning",
  Household: "muted",
  Settings: "muted",
  "What's New": "accent",
  Roadmap: "purple",
  Support: "success",
};

type MobileMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  activeHref: string;
};

export function MobileMoreSheet({
  open,
  onClose,
  activeHref,
}: MobileMoreSheetProps) {
  const pathname = usePathname();
  const nativeIos = useNativeIos();
  const routes = nativeIos ? IOS_MORE_NAV : MOBILE_MORE_NAV;
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const iosGroups = useMemo(() => {
    if (!nativeIos) return [];
    return IOS_MORE_GROUPS.map((group) => ({
      ...group,
      items: IOS_MORE_NAV.filter((item) => item.group === group.id),
    })).filter((group) => group.items.length > 0);
  }, [nativeIos]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setAnimating(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setAnimating(false);
    const timeout = window.setTimeout(() => setVisible(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!visible) {
    return null;
  }

  function openFeedback() {
    void triggerHaptic("light");
    onClose();
    window.dispatchEvent(new CustomEvent("buxme:open-feedback"));
  }

  function isActive(href: string) {
    const [hrefPath, hrefHash = ""] = href.split("#");
    const pathMatches =
      activeHref === href ||
      pathname === hrefPath ||
      pathname.startsWith(`${hrefPath}/`);

    if (!pathMatches) {
      return false;
    }

    // Distinguish /settings vs /settings#household so both rows aren't highlighted.
    if (hrefPath === "/settings") {
      const currentHash =
        typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      return (hrefHash || "") === currentHash;
    }

    return true;
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          animating
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[78vh] overflow-y-auto rounded-t-[22px] border border-[var(--surface-border)] bg-[var(--background)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 transition-transform duration-220 ease-out lg:hidden",
          nativeIos &&
            "native-sheet ios-more-sheet max-h-[92vh] rounded-t-[14px] border-white/[0.08] bg-[#0b0f14] px-3 pt-2",
          animating
            ? "pointer-events-auto translate-y-0"
            : "pointer-events-none translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between px-1">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]",
              nativeIos && "text-[17px] font-semibold normal-case tracking-tight text-[var(--foreground)]",
            )}
          >
            More
          </p>
          {nativeIos ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-2 text-[15px] font-semibold text-[var(--accent-light)]"
            >
              Done
            </button>
          ) : null}
        </div>

        {nativeIos ? (
          <div className="space-y-5 pb-2">
            {iosGroups.map((group) => (
              <section key={group.id}>
                <p className="mb-1.5 px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                  {group.label}
                </p>
                <ul className="overflow-hidden rounded-[12px] bg-white/[0.04]">
                  {group.items.map((route) => {
                    const active = isActive(route.href);

                    const tone = IOS_MORE_ICON_TONE[route.label] ?? "muted";
                    const icon = (
                      <IosTintIcon tone={tone}>
                        <NavIcon name={route.icon} className="h-4 w-4" />
                      </IosTintIcon>
                    );

                    if ("action" in route && route.action === "feedback") {
                      return (
                        <li key={route.label}>
                          <button
                            type="button"
                            onClick={openFeedback}
                            className="flex min-h-[52px] w-full items-center gap-3 border-b border-white/[0.06] px-3.5 py-2.5 text-left last:border-b-0 active:bg-white/[0.05]"
                          >
                            {icon}
                            <span className="flex-1 text-[16px] text-[var(--foreground)]">
                              {route.label}
                            </span>
                            <span className="text-[var(--text-subtle)]">›</span>
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li key={route.href}>
                        <Link
                          href={route.href}
                          onClick={(event) => {
                            void triggerHaptic("selection");
                            onClose();

                            if (navigateSettingsDeepLink(route.href, pathname)) {
                              event.preventDefault();
                            }
                          }}
                          className={cn(
                            "flex min-h-[52px] items-center gap-3 border-b border-white/[0.06] px-3.5 py-2.5 last:border-b-0 active:bg-white/[0.05]",
                            active && "bg-[var(--accent-muted)]/40",
                          )}
                        >
                          {icon}
                          <span className="flex-1 text-[16px] text-[var(--foreground)]">
                            {route.label}
                          </span>
                          {route.label === "What's New" ? (
                            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              New
                            </span>
                          ) : null}
                          <span className="text-[var(--text-subtle)]">›</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {routes.map((route) => {
              const active = isActive(route.href);

              if ("action" in route && route.action === "feedback") {
                return (
                  <button
                    key={route.label}
                    type="button"
                    onClick={openFeedback}
                    className={cn(
                      "focus-ring flex min-h-11 items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors",
                      sidebarInactiveClassName,
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)]">
                      <NavIcon name={route.icon} />
                    </span>
                    {route.label}
                  </button>
                );
              }

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  onClick={() => {
                    void triggerHaptic("selection");
                    onClose();
                  }}
                  className={cn(
                    "focus-ring flex min-h-11 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                    active ? sidebarActiveClassName : sidebarInactiveClassName,
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)]">
                    <NavIcon name={route.icon} />
                  </span>
                  {route.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
