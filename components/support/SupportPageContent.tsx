import Link from "next/link";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/constants";

const HELP_TOPICS = [
  {
    id: "account-login",
    title: "Account & login help",
    body: [
      "Sign in at buxme.co with the email you used to create your account. If you forgot your password, use Forgot password on the login page to receive a reset link.",
      "You can update your profile details and notification preferences in Settings after signing in. To permanently delete your account, open Settings → Delete account and confirm by typing DELETE.",
    ],
  },
  {
    id: "bank-plaid",
    title: "Bank / Plaid connection help",
    body: [
      "Buxme connects financial institutions through Plaid. Open Accounts (or Settings → Connections) and choose Connect Bank to authorize access. Buxme never receives or stores your online banking username or password.",
      "If balances stop updating, try Sync now, then check Settings → Connections for a Reconnect prompt. Reconnecting runs Plaid’s secure login flow again for that institution.",
    ],
  },
  {
    id: "subscription-billing",
    title: "Subscription & billing help",
    body: [
      "Manage your Buxme plan in Settings → Billing. Web subscriptions are handled through Stripe; App Store purchases are managed through Apple on your device.",
      "If a payment failed, your plan shows as past due, or you need help switching between App Store and web billing, email support with the email on your Buxme account. Do not send card numbers or banking passwords.",
    ],
  },
  {
    id: "privacy-security",
    title: "Privacy & security help",
    body: [
      "Buxme uses HTTPS/TLS in transit, secure authentication, and encrypted storage with our infrastructure partners. When you link a bank, authentication is handled by Plaid—not by Buxme.",
      "Read the full details on our Privacy Policy and Security pages. To report a security concern, email support@buxme.co with enough detail for us to investigate.",
    ],
  },
] as const;

const FAQS = [
  {
    question: "How do I get help with my Buxme account?",
    answer:
      "Browse the topics on this page first. If you still need assistance, email support@buxme.co with a short description of the issue, the device or browser you’re using, and the screen where it happens. Never include passwords or sensitive banking credentials.",
  },
  {
    question: "How do I reset my password?",
    answer:
      "Go to the login page, choose Forgot password, and enter your account email. We’ll send a secure reset link. If you don’t see the email, check spam or promotions, then contact support.",
  },
  {
    question: "How do I connect or reconnect a bank?",
    answer:
      "Open Accounts or Settings → Connections and use Connect Bank or Reconnect. Linking uses Plaid’s secure flow. Buxme does not store your bank login credentials.",
  },
  {
    question: "How do I manage or cancel my subscription?",
    answer:
      "Open Settings → Billing in the app or on the web. App Store subscriptions are also managed in your Apple ID subscriptions. Contact support if you need help locating the correct billing path for your account.",
  },
  {
    question: "How do I delete my Buxme account?",
    answer:
      "Sign in, open Settings, and use Delete account. Confirm by typing DELETE. This permanently removes your Buxme account, finance data, and bank connections and cannot be undone.",
  },
  {
    question: "Is my financial information secure?",
    answer:
      "Yes—Buxme is built with encryption in transit, secure authentication, and partner infrastructure protections. Bank credentials are handled by Plaid, not stored by Buxme. See Privacy Policy and Security for details.",
  },
] as const;

export function SupportPageContent() {
  const year = new Date().getFullYear();
  const mailtoHref = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent("Buxme Support Request")}`;

  return (
    <div className="app-shell min-h-screen font-sans text-[var(--foreground)]">
      <header className="border-b border-[var(--surface-border)] px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Buxme home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-base">
              💰
            </span>
            <span className="text-sm font-semibold tracking-tight">
              <span className="text-[var(--accent-light)]">bux</span>me
            </span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6" aria-label="Support">
            <Link
              href="/"
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
            >
              Back to Buxme
            </Link>
            <Link
              href="/login"
              className="text-sm text-[var(--accent)] transition-colors hover:underline"
            >
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-[var(--surface-border)] px-6 py-14 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
              Help Center
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Buxme Support
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              Get help with your Buxme account, bank connections, subscriptions,
              and privacy questions. Start with the topics below, or email our
              team and we’ll respond as soon as we can.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact-support"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Contact Support
              </a>
              <a
                href="#faq"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-[var(--surface-border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--surface-border-strong)]"
              >
                View FAQ
              </a>
            </div>
          </div>
        </section>

        <section
          id="contact-support"
          aria-labelledby="contact-support-heading"
          className="px-6 py-12 sm:py-14"
        >
          <div className="mx-auto max-w-4xl rounded-[var(--radius-card)] border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-6 sm:p-8">
            <h2
              id="contact-support-heading"
              className="text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              Contact Support
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
              Email us with a brief description of what you need help with, the
              device or browser you&apos;re using, and where in Buxme it happens.
              Never email passwords or sensitive banking credentials.
            </p>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Support email:{" "}
              <a
                href={mailtoHref}
                className="font-semibold text-[var(--accent-light)] hover:underline"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
            </p>
            <a
              href={mailtoHref}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Email {LEGAL_CONTACT_EMAIL}
            </a>
          </div>
        </section>

        <section
          id="help-topics"
          aria-labelledby="help-topics-heading"
          className="border-y border-[var(--surface-border)] px-6 py-12 sm:py-14"
        >
          <div className="mx-auto max-w-4xl">
            <h2
              id="help-topics-heading"
              className="text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              Help topics
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Common answers for accounts, bank connections, billing, and security.
            </p>
            <div className="mt-8 space-y-6">
              {HELP_TOPICS.map((topic) => (
                <article
                  key={topic.id}
                  id={topic.id}
                  className="rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface)] p-5 sm:p-6"
                >
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {topic.title}
                  </h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {topic.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-6 text-sm text-[var(--text-muted)]">
              Related policies:{" "}
              <Link href="/privacy" className="text-[var(--accent)] hover:underline">
                Privacy Policy
              </Link>
              {" · "}
              <Link href="/terms" className="text-[var(--accent)] hover:underline">
                Terms of Service
              </Link>
              {" · "}
              <Link href="/security" className="text-[var(--accent)] hover:underline">
                Security
              </Link>
            </p>
          </div>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="px-6 py-12 sm:py-14"
        >
          <div className="mx-auto max-w-4xl">
            <h2
              id="faq-heading"
              className="text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              FAQ
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Quick answers for App Store customers and web users.
            </p>
            <div className="mt-8 space-y-3">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1"
                >
                  <summary className="cursor-pointer list-none py-3 text-sm font-semibold text-[var(--foreground)] outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-3">
                      <span>{faq.question}</span>
                      <span
                        aria-hidden
                        className="mt-0.5 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="border-t border-[var(--surface-border)] pb-4 pt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--surface-border)] px-6 py-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Buxme home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface-soft)] text-sm">
              💰
            </span>
            <span className="text-sm font-semibold text-[var(--foreground)]">Buxme</span>
          </Link>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]"
            aria-label="Support footer"
          >
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              Home
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[var(--foreground)]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--foreground)]">
              Terms of Service
            </Link>
            <Link href="/security" className="transition-colors hover:text-[var(--foreground)]">
              Security
            </Link>
            <a
              href={mailtoHref}
              className="transition-colors hover:text-[var(--foreground)]"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
          </nav>
        </div>
        <div className="mx-auto mt-8 max-w-4xl border-t border-[var(--surface-border)] pt-6">
          <p className="text-sm text-[var(--text-subtle)]">
            © {year} Buxme. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
