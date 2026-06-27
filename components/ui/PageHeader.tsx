import type { ReactNode } from "react";
import { cn } from "./cn";

type PageHeaderProps = {
  action?: ReactNode;
  className?: string;
};

export function PageHeader({ action, className }: PageHeaderProps) {
  if (!action) {
    return null;
  }

  return (
    <div className={cn("flex items-center justify-end", className)}>{action}</div>
  );
}
