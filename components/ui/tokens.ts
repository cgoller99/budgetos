export const tokens = {
  accent: "#0077ed",
  accentHover: "#0066d6",
  accentLight: "#4da3ff",
  surface: "#0f1419",
  canvas: "#090b10",
  sidebar: "#07090d",
  border: "border-white/[0.04]",
  borderStrong: "border-white/[0.06]",
  borderHover: "hover:border-white/[0.08]",
  textPrimary: "text-white",
  textSecondary: "text-white/65",
  textMuted: "text-white/40",
  textSubtle: "text-white/32",
  transition: "transition-all duration-200 ease-out",
  focusRing: "focus:border-[#0077ed]/40 focus:bg-white/[0.05]",
} as const;

export const cardBaseClassName =
  "rounded-[1.35rem] border border-white/[0.05] bg-white/[0.025] shadow-[0_1px_2px_rgba(0,0,0,0.28),0_10px_28px_rgba(0,0,0,0.22)] transition-all duration-300 ease-out";

export const cardHoverClassName =
  "hover:-translate-y-0.5 hover:border-white/[0.08] hover:bg-white/[0.035] hover:shadow-[0_2px_4px_rgba(0,0,0,0.32),0_16px_40px_rgba(0,119,237,0.08)]";

export const cardPaddingClassName = "p-7 sm:p-8";

export const cardPaddingLgClassName = "p-8 sm:p-10";

export const buttonPrimaryClassName =
  "bg-gradient-to-b from-[#0088ff] to-[#0077ed] text-white shadow-[0_1px_2px_rgba(0,119,237,0.35),0_4px_16px_rgba(0,119,237,0.2)] hover:from-[#0099ff] hover:to-[#0066d6] hover:shadow-[0_4px_24px_rgba(0,119,237,0.38)] hover:scale-[1.02] active:scale-[0.98]";

export const inputBaseClassName =
  "min-h-11 w-full rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-base text-white outline-none transition-all duration-200 ease-out placeholder:text-white/28 focus:border-[#0077ed]/40 focus:bg-white/[0.05]";

export const labelClassName = "mb-2 block text-sm font-medium text-white/55";

export const panelTitleClassName =
  "text-lg font-semibold tracking-tight text-white sm:text-xl";

export const panelDescriptionClassName = "mt-1.5 text-sm leading-relaxed text-white/35";

export const pageContainerClassName =
  "mx-auto flex w-full max-w-5xl flex-col gap-10 lg:gap-12";

export const pageContainerWideClassName =
  "mx-auto flex w-full max-w-6xl flex-col gap-10 lg:gap-12";

export const dashboardSectionClassName = "grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6";

export const sectionTitleClassName =
  "text-xl font-semibold tracking-tight text-white sm:text-2xl";

export const metricLabelClassName = "text-sm font-medium text-white/42";

export const metricValueClassName =
  "text-3xl font-semibold tracking-tight tabular-nums text-white sm:text-4xl lg:text-[2.75rem] lg:leading-none";

export const sidebarActiveClassName =
  "border border-[#0077ed]/25 bg-[#0077ed]/10 text-white shadow-[inset_0_1px_0_rgba(0,119,237,0.12)]";

export const sidebarInactiveClassName =
  "border border-transparent text-white/45 hover:border-white/[0.04] hover:bg-white/[0.03] hover:text-white/85";
