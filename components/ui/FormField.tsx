import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { labelClassName } from "./tokens";

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  children: ReactNode;
  htmlFor?: string;
};

export function FormField({
  label,
  children,
  className,
  htmlFor,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn("block", className)} {...props}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClassName}>
          {label}
        </label>
      ) : (
        <span className={labelClassName}>{label}</span>
      )}
      {children}
    </div>
  );
}
