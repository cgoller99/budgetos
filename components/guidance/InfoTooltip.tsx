type InfoTooltipProps = {
  label: string;
  className?: string;
};

export function InfoTooltip({ label, className = "" }: InfoTooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        className="flex size-5 min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 sm:size-5 sm:min-h-0 sm:min-w-0"
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
