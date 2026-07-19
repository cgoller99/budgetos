"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type MobileCollapsibleSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function MobileCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: MobileCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-subtle)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex min-h-12 w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">{title}</p>
          {description ? (
            <p className="mt-1 text-sm text-white/45">{description}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-medium text-[var(--accent-light)]">
          {open ? "Hide" : "View more"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}
