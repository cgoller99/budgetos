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
    <div className={cn("ios-screen flex flex-col gap-4", className)}>{children}</div>
  );
}

export function IosCard({
  children,
  className,
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}) {
  return (
    <section
      className={cn(
        "ios-card rounded-[16px] border border-white/[0.05] bg-[var(--surface)]",
        padding === "sm" && "p-3",
        padding === "md" && "p-4",
        padding === "lg" && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function IosHeroMetric({
  label,
  value,
  hint,
  tone = "default",
  trailing,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "danger";
  trailing?: ReactNode;
}) {
  return (
    <div className="ios-hero-metric flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text-muted)]">{label}</p>
        <p
          className={cn(
            "mt-1.5 text-[34px] font-semibold leading-none tracking-tight tabular-nums",
            tone === "positive" && "text-[var(--success)]",
            tone === "warning" && "text-[var(--warning)]",
            tone === "danger" && "text-[var(--danger)]",
            tone === "default" && "text-[var(--foreground)]",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-2 text-[13px] leading-snug text-[var(--text-secondary)]">{hint}</p>
        ) : null}
      </div>
      {trailing}
    </div>
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
        <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
          {title ? (
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
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
    <ul
      className={cn(
        "ios-list overflow-hidden rounded-[16px] border border-white/[0.05] bg-[var(--surface)]",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function IosListRow({
  title,
  subtitle,
  leading,
  trailing,
  href,
  onClick,
  danger,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className =
    "ios-list-row flex min-h-[52px] items-center gap-3 border-b border-white/[0.05] px-3.5 py-3 last:border-b-0";

  const label = (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          "truncate text-[15px] font-medium leading-snug",
          danger ? "text-[var(--danger)]" : "text-[var(--foreground)]",
        )}
      >
        {title}
      </p>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{subtitle}</p>
      ) : null}
    </div>
  );

  const body = (
    <>
      {leading}
      {label}
      {trailing ? (
        <div className="shrink-0 text-right text-[15px] font-medium tabular-nums text-[var(--text-secondary)]">
          {trailing}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <li>
        <Link href={href} className={cn(className, "active:bg-white/[0.03]")}>
          {body}
        </Link>
      </li>
    );
  }

  if (onClick) {
    return (
      <li className={className}>
        <button
          type="button"
          onClick={onClick}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left active:opacity-80"
        >
          {leading}
          {label}
        </button>
        {trailing ? (
          <div className="shrink-0 text-right text-[15px] font-medium tabular-nums text-[var(--text-secondary)]">
            {trailing}
          </div>
        ) : null}
      </li>
    );
  }

  return <li className={className}>{body}</li>;
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
        "flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-3.5",
        tone === "accent" && "bg-[var(--accent)]/14 border border-[var(--accent)]/25",
        tone === "warning" && "bg-[var(--warning)]/12 border border-[var(--warning)]/25",
        tone === "danger" && "bg-[var(--danger)]/12 border border-[var(--danger)]/25",
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
      <div className="h-[120px] animate-pulse rounded-[16px] bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
      </div>
      <div className="overflow-hidden rounded-[16px] bg-[var(--surface)]">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between border-b border-white/[0.05] px-3.5 py-3.5 last:border-b-0"
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

export function IosIconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_0_16px_rgba(59,130,246,0.35)] active:opacity-85",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IosPrimaryButton({
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
        "flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[var(--accent)] px-4 text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(59,130,246,0.28)] active:opacity-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IosProgressBar({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "success" | "warning" | "danger";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-white/[0.08]", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          tone === "accent" && "bg-[var(--accent)]",
          tone === "success" && "bg-[var(--success)]",
          tone === "warning" && "bg-[var(--warning)]",
          tone === "danger" && "bg-[var(--danger)]",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function IosRing({
  value,
  size = 56,
  stroke = 5,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {label ? (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-[var(--foreground)]">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function IosSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-[12px] bg-white/[0.05] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 flex-1 rounded-[10px] px-2 text-[13px] font-semibold transition-colors",
              active
                ? "bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(59,130,246,0.35)]"
                : "text-[var(--text-muted)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function IosAvatar({
  src,
  fallback,
  tone = "accent",
}: {
  src?: string | null;
  fallback: string;
  tone?: "accent" | "success" | "warning" | "danger" | "purple" | "muted";
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="size-9 shrink-0 rounded-[10px] bg-white/10 object-contain p-1"
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold",
        tone === "accent" && "bg-[var(--accent-muted)] text-[var(--accent-light)]",
        tone === "success" && "bg-[var(--success-muted)] text-[var(--success)]",
        tone === "warning" && "bg-[var(--warning-muted)] text-[var(--warning)]",
        tone === "danger" && "bg-[var(--danger-muted)] text-[var(--danger)]",
        tone === "purple" && "bg-[var(--purple-muted)] text-[var(--purple)]",
        tone === "muted" && "bg-white/[0.06] text-[var(--text-secondary)]",
      )}
    >
      {fallback}
    </span>
  );
}

export function IosTintIcon({
  tone = "accent",
  children,
}: {
  tone?: "accent" | "success" | "warning" | "danger" | "purple" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
        tone === "accent" && "bg-[var(--accent-muted)] text-[var(--accent-light)]",
        tone === "success" && "bg-[var(--success-muted)] text-[var(--success)]",
        tone === "warning" && "bg-[var(--warning-muted)] text-[var(--warning)]",
        tone === "danger" && "bg-[var(--danger-muted)] text-[var(--danger)]",
        tone === "purple" && "bg-[var(--purple-muted)] text-[var(--purple)]",
        tone === "muted" && "bg-white/[0.06] text-[var(--text-secondary)]",
      )}
    >
      {children}
    </span>
  );
}
