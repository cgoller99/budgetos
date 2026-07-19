import { cn } from "./cn";

type ProgressBarVariant = "primary" | "muted";

type ProgressBarProps = {
  value: number;
  variant?: ProgressBarVariant;
  className?: string;
};

const fillClasses: Record<ProgressBarVariant, string> = {
  primary: "bg-gradient-to-r from-[#0077ed] to-[#4da3ff]",
  muted: "bg-[var(--text-muted)]",
};

export function ProgressBar({
  value,
  variant = "primary",
  className,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(value, 100));

  return (
    <div
      className={cn(
        "h-1.5 overflow-hidden rounded-full bg-[var(--surface-border)]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          fillClasses[variant],
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
