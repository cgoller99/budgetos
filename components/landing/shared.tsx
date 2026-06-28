import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { buttonPrimaryClassName } from "@/components/ui/tokens";

type LandingLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function PrimaryLink({ href, children, className }: LandingLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-2xl px-6 py-3.5 text-base font-medium transition-all duration-200 ease-out",
        buttonPrimaryClassName,
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children, className }: LandingLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025] px-6 py-3.5 text-base font-medium text-white/75 transition-all duration-200 ease-out hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-white active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-medium tracking-wide text-[#0077ed] uppercase">
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow ? <SectionLabel>{eyebrow}</SectionLabel> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-white/45 sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
