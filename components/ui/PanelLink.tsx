import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

type PanelLinkProps = ComponentProps<typeof Link>;

export function PanelLink({ className, children, ...props }: PanelLinkProps) {
  return (
    <Link
      className={cn(
        "text-xs font-medium text-[#0077ed] transition-colors hover:text-[#4da3ff] hover:underline",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
