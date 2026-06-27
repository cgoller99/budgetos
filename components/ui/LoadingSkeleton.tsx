import { cn } from "./cn";
import { cardPaddingClassName } from "./tokens";

type LoadingSkeletonProps = {
  className?: string;
  lines?: number;
};

export function LoadingSkeleton({
  className,
  lines = 3,
}: LoadingSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-5", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-4 rounded-xl bg-white/[0.04]",
            index === 0 && "h-7 w-2/5",
            index === lines - 1 && "w-4/5",
          )}
        />
      ))}
    </div>
  );
}

type SkeletonCardProps = {
  className?: string;
};

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-3xl border border-white/[0.04] bg-white/[0.015]",
        cardPaddingClassName,
        className,
      )}
    >
      <div className="h-4 w-24 rounded-xl bg-white/[0.04]" />
      <div className="mt-5 h-9 w-36 rounded-xl bg-white/[0.05]" />
      <div className="mt-5 h-4 w-28 rounded-xl bg-white/[0.04]" />
    </div>
  );
}

type SkeletonGridProps = {
  count?: number;
  className?: string;
};

export function SkeletonGrid({ count = 4, className }: SkeletonGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
