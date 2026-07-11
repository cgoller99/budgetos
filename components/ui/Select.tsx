import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { inputBaseClassName } from "./tokens";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          inputBaseClassName,
          "select-themed appearance-none pr-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--text-muted)]"
      >
        ▾
      </span>
    </div>
  );
}
