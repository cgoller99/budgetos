type InfoTooltipProps = {
  label: string;
  className?: string;
};

export function InfoTooltip({ label, className = "" }: InfoTooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        className="flex size-5 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[#0077ed]/30 hover:text-[#0077ed] focus:outline-none focus:ring-2 focus:ring-[#0077ed]/30"
        aria-label={label}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-7 z-20 w-56 -translate-x-1/2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-left text-xs leading-relaxed text-[var(--text-secondary)] opacity-0 shadow-[var(--card-shadow)] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
