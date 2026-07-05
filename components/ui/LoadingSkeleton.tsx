import { cn } from "./cn";
import { cardPaddingClassName } from "./tokens";

type LoadingSkeletonProps = {
  className?: string;
  lines?: number;
};

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl skeleton-shimmer", className)}
      aria-hidden
    />
  );
}

export function LoadingSkeleton({
  className,
  lines = 3,
}: LoadingSkeletonProps) {
  return (
    <div
      className={cn("space-y-5", className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: lines }).map((_, index) => (
        <ShimmerBlock
          key={index}
          className={cn(
            "h-4",
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
        "rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-subtle)]",
        cardPaddingClassName,
        className,
      )}
      aria-hidden
    >
      <ShimmerBlock className="h-4 w-24" />
      <ShimmerBlock className="mt-5 h-9 w-36" />
      <ShimmerBlock className="mt-5 h-4 w-28" />
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
      role="status"
      aria-label="Loading content"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex justify-end" aria-hidden>
      <ShimmerBlock className="h-11 w-32 rounded-2xl" />
    </div>
  );
}

export function StatRowSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5",
        count > 1 && "sm:grid-cols-2",
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 lg:gap-12"
      role="status"
      aria-label="Loading dashboard"
    >
      <div className="space-y-4" aria-hidden>
        <ShimmerBlock className="h-10 w-48 rounded-2xl" />
        <ShimmerBlock className="h-5 w-72 max-w-full rounded-xl" />
      </div>
      <StatRowSkeleton count={2} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6" aria-hidden>
        <SkeletonCard className="min-h-[220px]" />
        <SkeletonCard className="min-h-[220px]" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6" aria-hidden>
        <SkeletonCard className="min-h-[180px]" />
        <SkeletonCard className="min-h-[180px]" />
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:gap-12"
      role="status"
      aria-label="Loading settings"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonCard key={index} className="min-h-[160px]" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="space-y-3 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-7 sm:p-8"
      role="status"
      aria-label="Loading list"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4" aria-hidden>
          <ShimmerBlock className="size-10 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <ShimmerBlock className="h-4 w-1/3" />
            <ShimmerBlock className="h-3 w-1/4" />
          </div>
          <ShimmerBlock className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PageLoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 rounded-2xl skeleton-shimmer" aria-hidden />
        <p className="text-sm text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}
