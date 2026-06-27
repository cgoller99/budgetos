import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { labelClassName } from "./tokens";

type FormFieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: string;
  children: ReactNode;
};

export function FormField({
  label,
  children,
  className,
  ...props
}: FormFieldProps) {
  return (
    <label className={cn("block", className)} {...props}>
      <span className={labelClassName}>{label}</span>
      {children}
    </label>
  );
}
