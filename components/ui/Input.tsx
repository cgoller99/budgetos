import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";
import { inputBaseClassName } from "./tokens";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(inputBaseClassName, className)} {...props} />;
}
