import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { inputBaseClassName } from "./tokens";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(inputBaseClassName, "appearance-none", className)}
      {...props}
    >
      {children}
    </select>
  );
}
