export const tokens = {
  accent: "var(--accent)",
  accentHover: "var(--accent-hover)",
  accentLight: "var(--accent-light)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  purple: "var(--purple)",
  surface: "var(--surface)",
  canvas: "var(--background)",
  sidebar: "var(--sidebar-bg)",
  border: "border-[var(--surface-border)]",
  borderStrong: "border-[var(--surface-border-strong)]",
  borderHover: "hover:border-[var(--surface-border-strong)]",
  textPrimary: "text-[var(--foreground)]",
  textSecondary: "text-[var(--text-secondary)]",
  textMuted: "text-[var(--text-muted)]",
  textSubtle: "text-[var(--text-subtle)]",
  transition: "transition-all duration-200 ease-out",
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)] focus-visible:outline-offset-2",
} as const;

export const cardBaseClassName =
  "rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface-soft)] transition-colors duration-200 ease-out";

export const cardHoverClassName =
  "hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-hover)]";

export const cardSubtleHoverClassName = cardHoverClassName;

export const cardPaddingClassName = "p-5 sm:p-6";

export const cardPaddingLgClassName = "p-6 sm:p-7";

export const cardPaddingCompactClassName = "p-4 sm:p-5";

export const buttonPrimaryClassName =
  "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]";

export const buttonSecondaryClassName =
  "border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] active:scale-[0.98]";

export const buttonDangerClassName =
  "bg-[var(--danger)] text-white hover:bg-[color-mix(in_srgb,var(--danger)_88%,black)] active:scale-[0.98]";

export const buttonGhostClassName =
  "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] active:scale-[0.98]";

export const buttonTextClassName =
  "border border-transparent bg-transparent px-0 text-[var(--accent)] hover:text-[var(--accent-light)] active:scale-[0.98]";

export const inputBaseClassName =
  "focus-ring min-h-11 w-full rounded-[var(--radius-input)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition-all duration-200 ease-out placeholder:text-[var(--text-muted)] focus:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] focus:bg-[var(--focus-surface)]";

export const labelClassName =
  "mb-2 block text-xs font-medium text-[var(--text-muted)]";

export const panelTitleClassName =
  "text-sm font-semibold tracking-tight text-[var(--foreground)] sm:text-base";

export const panelDescriptionClassName =
  "mt-0.5 text-xs text-[var(--text-muted)]";

export const panelLinkClassName =
  "text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-light)]";

export const pageContainerClassName =
  "mx-auto flex w-full max-w-5xl flex-col gap-6 lg:gap-8";

export const pageContainerWideClassName =
  "mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8";

export const dashboardSectionClassName =
  "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5";

export const dashboardKpiGridClassName =
  "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5 xl:gap-4";

export const listRowClassName =
  "flex items-center justify-between gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-[var(--surface-hover)]";

export const listRowAmountClassName =
  "shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]";

export const listRowLabelClassName =
  "truncate text-sm text-[var(--text-secondary)]";

export const sectionTitleClassName =
  "text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl";

export const metricLabelClassName =
  "text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase";

export const metricValueClassName =
  "text-xl font-semibold tracking-tight tabular-nums text-[var(--foreground)] sm:text-2xl lg:text-[1.625rem] lg:leading-none";

export const metricChangeClassName =
  "mt-1.5 text-[11px] tabular-nums text-[var(--text-muted)]";

export const iconBadgeClassName =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]";

export const sidebarActiveClassName =
  "bg-[var(--surface-elevated)] text-[var(--foreground)]";

export const sidebarInactiveClassName =
  "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]";
