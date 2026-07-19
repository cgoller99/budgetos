import Link from "next/link";
import type { ComponentProps } from "react";
import { panelLinkClassName } from "./tokens";
import { cn } from "./cn";

type PanelLinkProps = ComponentProps<typeof Link>;

export function PanelLink({ className, children, ...props }: PanelLinkProps) {
  return (
    <Link className={cn(panelLinkClassName, className)} {...props}>
      {children}
    </Link>
  );
}
