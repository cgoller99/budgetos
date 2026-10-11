"use client";

import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function IosScreen({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ios-screen flex flex-col gap-4", className)} {...props}>
      {children}
    </div>
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
        <Link href={href} className={cn(className, "w-full active:bg-white/[0.03]")}>
          {body}
        </Link>
      </li>
    );
  }

  if (onClick) {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            className,
            "w-full touch-manipulation text-left active:bg-white/[0.03]",
          )}
        >
          {body}
        </button>
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

export function IosSkeletonScreen({
  rows = 4,
  variant = "list",
}: {
  rows?: number;
  variant?: "list" | "home";
}) {
  return (
    <div className="ios-screen flex flex-col gap-4" aria-busy="true">
      <div
        className={cn(
          "animate-pulse rounded-[16px] bg-white/[0.05]",
          variant === "home" ? "h-[168px]" : "h-[120px]",
        )}
      />
      {variant === "home" ? null : (
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
        <div className="h-[88px] animate-pulse rounded-[16px] bg-white/[0.05]" />
      </div>
      )}
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

const DONUT_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--purple)",
  "var(--danger)",
  "var(--accent-light)",
];

export function IosDonut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { value: number }[];
  centerValue: string;
  centerLabel: string;
}) {
  const size = 148;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0) || 1;
  const arcs = segments.map((segment, index) => {
    const length = (Math.max(segment.value, 0) / total) * circumference;
    const dashOffset = segments
      .slice(0, index)
      .reduce((sum, earlier) => sum + (Math.max(earlier.value, 0) / total) * circumference, 0);
    return { index, length, dashOffset };
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {arcs.map((arc) => {
          if (arc.length <= 0) return null;
          return (
            <circle
              key={arc.index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={DONUT_COLORS[arc.index % DONUT_COLORS.length]}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.dashOffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-semibold tabular-nums text-[var(--foreground)]">
          {centerValue}
        </span>
        <span className="text-[11px] font-medium text-[var(--text-muted)]">{centerLabel}</span>
      </div>
    </div>
  );
}

export function IosSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "bar",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  variant?: "bar" | "pills";
}) {
  if (variant === "pills") {
    return (
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors active:opacity-80",
                active
                  ? "bg-[var(--accent)] text-white shadow-[0_0_16px_rgba(59,130,246,0.35)]"
                  : "bg-white/[0.06] text-[var(--text-secondary)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

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
