export const tokens = {
  accent: "var(--accent)",
  accentHover: "var(--accent-hover)",
  accentLight: "var(--accent-light)",
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
  focusRing: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0077ed]/55 focus-visible:outline-offset-2",
} as const;

export const cardBaseClassName =
  "rounded-[1.35rem] border border-[var(--surface-border)] bg-[var(--surface-soft)] shadow-[var(--card-shadow)] transition-all duration-300 ease-out";

export const cardHoverClassName =
  "hover:-translate-y-0.5 hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-hover)] hover:shadow-[var(--card-shadow-hover)]";

export const cardSubtleHoverClassName =
  "hover:-translate-y-0.5 hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-hover)] hover:shadow-[var(--card-shadow-hover)]";

export const cardPaddingClassName = "p-7 sm:p-8";

export const cardPaddingLgClassName = "p-8 sm:p-10";

export const buttonPrimaryClassName =
  "bg-gradient-to-b from-[#0088ff] to-[#0077ed] text-[#ffffff] shadow-[0_1px_2px_rgba(0,119,237,0.35),0_4px_16px_rgba(0,119,237,0.2)] hover:from-[#0099ff] hover:to-[#0066d6] hover:shadow-[0_4px_24px_rgba(0,119,237,0.38)] hover:scale-[1.02] active:scale-[0.98]";

export const inputBaseClassName =
  "focus-ring min-h-11 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition-all duration-200 ease-out placeholder:text-[var(--text-subtle)] focus:border-[#0077ed]/40 focus:bg-[var(--focus-surface)]";

export const labelClassName =
  "mb-2 block text-sm font-medium text-[var(--text-muted)]";

export const panelTitleClassName =
  "text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl";

export const panelDescriptionClassName =
  "mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]";

export const pageContainerClassName =
  "mx-auto flex w-full max-w-5xl flex-col gap-10 lg:gap-12";

export const pageContainerWideClassName =
  "mx-auto flex w-full max-w-6xl flex-col gap-10 lg:gap-12";

export const dashboardSectionClassName = "grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6";

export const sectionTitleClassName =
  "text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl";

export const metricLabelClassName =
  "text-sm font-medium tracking-wide text-[var(--text-muted)]";

export const metricValueClassName =
  "text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)] sm:text-[2.125rem] lg:text-[2.65rem] lg:leading-none";

export const sidebarActiveClassName =
  "border border-[#0077ed]/25 bg-[#0077ed]/10 text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(0,119,237,0.12)]";

export const sidebarInactiveClassName =
  "border border-transparent text-[var(--text-muted)] hover:border-[var(--surface-border)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]";
