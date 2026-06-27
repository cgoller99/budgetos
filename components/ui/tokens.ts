export const tokens = {
  accent: "#0077ed",
  accentHover: "#0066d6",
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
  "rounded-3xl border border-white/[0.04] bg-white/[0.02] transition-all duration-200 ease-out";

export const cardHoverClassName = "hover:border-white/[0.07] hover:bg-white/[0.025]";

export const cardPaddingClassName = "p-7 sm:p-8";

export const cardPaddingLgClassName = "p-9 sm:p-11";

export const inputBaseClassName =
  "min-h-11 w-full rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-base text-white outline-none transition-all duration-200 ease-out placeholder:text-white/28 focus:border-[#0077ed]/40 focus:bg-white/[0.05]";

export const labelClassName = "mb-2 block text-sm font-medium text-white/55";

export const panelTitleClassName =
  "text-lg font-semibold tracking-tight text-white sm:text-xl";

export const panelDescriptionClassName = "mt-1.5 text-sm leading-relaxed text-white/35";

export const pageContainerClassName =
  "mx-auto flex w-full max-w-5xl flex-col gap-[3.25rem] lg:gap-[4.5rem]";

export const pageContainerWideClassName =
  "mx-auto flex w-full max-w-6xl flex-col gap-[3.25rem] lg:gap-[4.5rem]";

export const sectionTitleClassName =
  "text-xl font-semibold tracking-tight text-white sm:text-2xl";

export const metricLabelClassName = "text-sm text-white/40";

export const metricValueClassName =
  "text-3xl font-semibold tracking-tight tabular-nums text-white sm:text-4xl lg:text-[2.75rem] lg:leading-none";
