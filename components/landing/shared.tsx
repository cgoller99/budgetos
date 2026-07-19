"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import {
  buttonPrimaryClassName,
  cardBaseClassName,
  cardHoverClassName,
} from "@/components/ui/tokens";

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
        "inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-6 py-3.5 text-base font-medium text-[var(--text-secondary)] transition-all duration-200 ease-out hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-medium tracking-wide text-[var(--accent)] uppercase">
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
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}

export const landingSectionClassName = "px-6 py-20 sm:py-28";
export const landingContainerClassName = "mx-auto max-w-6xl";

export const landingCardClassName = cn(
  cardBaseClassName,
  cardHoverClassName,
);

export const landingCardStaticClassName = cn(cardBaseClassName);

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "landing-scroll-reveal",
        visible && "landing-scroll-reveal-visible",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
