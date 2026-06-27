import { cn } from "./cn";

type ProgressBarVariant = "primary" | "muted";

type ProgressBarProps = {
  value: number;
  variant?: ProgressBarVariant;
  className?: string;
};

const fillClasses: Record<ProgressBarVariant, string> = {
  primary: "bg-[#0077ed]",
  muted: "bg-white/30",
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
        "h-2 overflow-hidden rounded-full bg-white/[0.06]",
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
