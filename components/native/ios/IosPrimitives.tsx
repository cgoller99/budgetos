"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function IosScreen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ios-screen flex flex-col gap-5", className)}>{children}</div>
  );
}

export function IosHeroMetric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  return (
    <section className="ios-hero-metric px-1 pt-1">
      <p className="text-[13px] font-medium text-[var(--text-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums",
          tone === "positive" && "text-emerald-400",
          tone === "warning" && "text-amber-400",
          tone === "danger" && "text-rose-400",
          tone === "default" && "text-[var(--foreground)]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[13px] leading-snug text-[var(--text-subtle)]">{hint}</p>
      ) : null}
    </section>
  );
}

export function IosSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ios-section", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          {title ? (
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function IosList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("ios-list overflow-hidden rounded-[12px] bg-[var(--surface-subtle)]", className)}>
      {children}
    </ul>
  );
}

export function IosListRow({
  title,
  subtitle,
  trailing,
  href,
  onClick,
  danger,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className =
    "ios-list-row flex min-h-11 items-center gap-3 border-b border-white/[0.06] px-3.5 py-2.5 last:border-b-0";

  const label = (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          "truncate text-[15px] font-medium leading-snug",
          danger ? "text-rose-300" : "text-[var(--foreground)]",
        )}
      >
        {title}
      </p>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{subtitle}</p>
      ) : null}
    </div>
  );

  const meta = trailing ? (
    <div className="shrink-0 text-right text-[15px] tabular-nums text-[var(--text-secondary)]">
      {trailing}
    </div>
  ) : null;

  if (href) {
    return (
      <li>
        <Link href={href} className={cn(className, "active:bg-white/[0.04]")}>
          {label}
          {meta}
        </Link>
      </li>
    );
  }

  // Keep trailing actions outside the hit target so nested buttons stay valid.
  if (onClick) {
    return (
      <li className={className}>
        <button
          type="button"
          onClick={onClick}
          className="flex min-h-11 min-w-0 flex-1 items-center text-left active:opacity-80"
        >
          {label}
        </button>
        {meta}
      </li>
    );
  }

  return (
    <li className={className}>
      {label}
      {meta}
    </li>
  );
}

export function IosLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-[13px] font-semibold text-[var(--accent-light)] active:opacity-70",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function IosBanner({
  title,
  subtitle,
  action,
  tone = "accent",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: "accent" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[12px] px-3.5 py-3",
        tone === "accent" && "bg-[var(--accent)]/12",
        tone === "warning" && "bg-amber-500/12",
        tone === "danger" && "bg-rose-500/12",
      )}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--foreground)]">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function IosSkeletonScreen({ rows = 4 }: { rows?: number }) {
  return (
    <div className="ios-screen flex flex-col gap-4" aria-busy="true">
      <div className="h-8 w-28 animate-pulse rounded-md bg-white/[0.06]" />
      <div className="h-12 w-44 animate-pulse rounded-md bg-white/[0.08]" />
      <div className="h-4 w-56 animate-pulse rounded-md bg-white/[0.05]" />
      <div className="overflow-hidden rounded-[12px] bg-[var(--surface-subtle)]">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-3.5 last:border-b-0"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-4 w-16 animate-pulse rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function IosTextButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 px-2 text-[13px] font-semibold text-[var(--accent-light)] active:opacity-70",
        className,
      )}
    >
      {children}
    </button>
  );
}
