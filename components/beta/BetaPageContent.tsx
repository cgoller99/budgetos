"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import {
  ScrollReveal,
  SectionHeading,
  landingCardClassName,
  landingSectionClassName,
  PrimaryLink,
} from "@/components/landing/shared";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";
import { cn } from "@/components/ui/cn";

type BetaStatus = {
  inviteOnly: boolean;
  waitlistEnabled: boolean;
  maxBetaUsers: number | null;
  approvedCount: number;
  isFull: boolean;
};

const FAQ = [
  {
    q: "Is Buxme free during beta?",
    a: "Yes. Buxme is free during the beta while we refine the product with early users.",
  },
  {
    q: "What feedback are you looking for?",
    a: "We want to hear about onboarding, income plans, bank sync, household sharing, and anything that feels confusing or broken.",
  },
  {
    q: "How is my data protected?",
    a: "Buxme uses encrypted connections, secure authentication, and industry-standard cloud infrastructure.",
  },
  {
    q: "When will Buxme launch publicly?",
    a: "After the beta, we will roll out paid plans with continued free tier access for core features.",
  },
] as const;

export function BetaPageContent() {
  const [status, setStatus] = useState<BetaStatus | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/beta/waitlist")
      .then((response) => response.json())
      .then((payload) => setStatus(payload as BetaStatus))
      .catch(() => null);
  }, []);

  async function joinWaitlist() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/beta/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to join waitlist.");
        return;
      }

      trackEvent(ANALYTICS_EVENTS.BETA_WAITLIST_JOINED, { email_domain: email.split("@")[1] ?? "" });
      setMessage(payload.message ?? "You're on the waitlist. We'll be in touch soon.");
      setEmail("");
    } finally {
      setIsSubmitting(false);
    }
  }

  const betaFull = status?.isFull ?? false;

  return (
    <div className="app-shell min-h-screen font-sans text-[var(--foreground)]">
      <LandingNav />
      <main>
        <section className="relative overflow-hidden px-6 pb-16 pt-12 sm:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(0,119,237,0.18),transparent)]"
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="text-sm font-medium tracking-wide text-[var(--accent-light)] uppercase">Public Beta</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Help shape the future of personal finance
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              Buxme brings accounts, income plans, bills, goals, and financial health into one calm
              workspace. Join the beta and tell us what to improve.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {betaFull ? (
                <Button size="md" onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}>
                  Join waitlist
                </Button>
              ) : (
                <PrimaryLink href="/register">Join Beta</PrimaryLink>
              )}
              <Link
                href="/"
                className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
              >
                Learn more about Buxme
              </Link>
            </div>
          </div>
        </section>

        <section className={landingSectionClassName}>
          <ScrollReveal>
            <SectionHeading
              eyebrow="Beta status"
              title="What's included in the beta"
              description="Early access to the full Buxme workspace while we polish the experience."
            />
          </ScrollReveal>
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Unified dashboard & net worth",
              "Income Plans & paycheck budgeting",
              "Bills, calendar, and transactions",
              "Savings goals & debt tracking",
              "Household collaboration",
              "Bank sync via Plaid (optional)",
            ].map((item) => (
              <ScrollReveal key={item}>
                <div className={cn(landingCardClassName, "p-6 text-sm text-[var(--text-secondary)]")}>
                  {item}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section id="waitlist" className={landingSectionClassName}>
          <ScrollReveal>
            <div className="mx-auto max-w-xl rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface-soft)] p-8">
              <h2 className="text-2xl font-semibold">
                {betaFull ? "Beta is full — join the waitlist" : "Request beta access"}
              </h2>
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                {status?.inviteOnly
                  ? "Buxme beta is invite-only. Join the waitlist and we'll email you when a spot opens."
                  : "Free during beta. No credit card required."}
              </p>
              <div className="mt-6 space-y-3">
                <Input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Full name (optional)"
                />
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email address"
                />
                <Button
                  className="w-full"
                  size="md"
                  disabled={isSubmitting || status?.waitlistEnabled === false}
                  onClick={() => void joinWaitlist()}
                >
                  {isSubmitting ? "Submitting..." : "Join waitlist"}
                </Button>
                {message ? <p className="text-sm text-[var(--text-muted)]">{message}</p> : null}
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section className={landingSectionClassName}>
          <ScrollReveal>
            <SectionHeading eyebrow="FAQ" title="Beta questions" />
          </ScrollReveal>
          <div className="mx-auto mt-10 max-w-2xl space-y-4">
            {FAQ.map((item) => (
              <ScrollReveal key={item.q}>
                <div className={cn(landingCardClassName, "p-6")}>
                  <h3 className="text-base font-medium text-[var(--foreground)]">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{item.a}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
