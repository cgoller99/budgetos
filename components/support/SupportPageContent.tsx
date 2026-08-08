import Link from "next/link";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/constants";

const HELP_CATEGORIES = [
  {
    title: "Getting Started",
    description:
      "Create your account, complete onboarding, and learn how Home, Accounts, Bills, and More fit together.",
  },
  {
    title: "Account & Login",
    description:
      "Sign in, reset your password, update profile details, and manage subscription or account access.",
  },
  {
    title: "Connecting Financial Accounts",
    description:
      "Link banks and cards securely through Plaid, sync balances, and reconnect institutions when needed.",
  },
  {
    title: "Transactions",
    description:
      "Review imported activity, search and filter history, and understand categories, transfers, and edits.",
  },
  {
    title: "Bills",
    description:
      "Add recurring bills, track due dates, mark payments, and keep upcoming obligations organized.",
  },
  {
    title: "Income & Paycheck Planning",
    description:
      "Set income sources, plan paycheck allocation schedules, and see what remains unallocated.",
  },
  {
    title: "Debt Tracking",
    description:
      "Add balances and APR details, log payments, and estimate payoff progress when payment data is available.",
  },
  {
    title: "Investments",
    description:
      "Track linked investment accounts and portfolio value when brokerage data is connected.",
  },
  {
    title: "Goals",
    description:
      "Create savings goals, track progress toward targets, and keep long-term plans separate from day-to-day cash.",
  },
  {
    title: "Privacy & Security",
    description:
      "Learn how Buxme protects your data, how Plaid handles bank login, and where to find Privacy and Security details.",
  },
] as const;

const FAQS = [
  {
    question: "How do I connect a bank account?",
    answer:
      "Open Accounts (or Settings → Connections) and choose Connect Bank. Buxme uses Plaid to let you securely authorize your financial institution. After you approve access, balances and transactions can sync into Buxme. You can also add accounts manually if you prefer not to link a bank.",
  },
  {
    question: "Why isn’t my account updating?",
    answer:
      "Most often a connection needs a refresh or reconnect, the institution is temporarily unavailable, or a sync is still in progress. Try Sync now from Accounts, confirm you have an internet connection, then check Settings → Connections for any reconnect prompts. If the issue continues, contact support with the institution name and roughly when it last updated.",
  },
  {
    question: "How do I reconnect a financial account?",
    answer:
      "If Buxme shows that a bank needs attention, open Accounts or Settings → Connections and tap Reconnect for that institution. You’ll complete Plaid’s secure login flow again to restore sync. Buxme does not receive or store your online banking username or password.",
  },
  {
    question: "How do I add or edit a bill?",
    answer:
      "Go to Bills and use Add to create a bill with amount, due date, and recurrence. Tap an existing bill to edit details, mark it paid, or update remaining amounts. Upcoming and overdue items also appear on Home and Calendar to help you stay ahead of due dates.",
  },
  {
    question: "How does paycheck planning work?",
    answer:
      "In Income, add your income sources and open the Plan tab. You can set schedules such as weekly, bi-weekly, twice monthly, monthly, or custom, then allocate each paycheck into categories or accounts you define. Buxme shows the remaining unallocated balance so you can see what’s left before the next paycheck.",
  },
  {
    question: "How do I add a debt?",
    answer:
      "Open Debt and add a balance with APR and payment details when you have them. Linked credit accounts from Plaid may appear automatically. With a meaningful monthly payment, Buxme can estimate payoff progress; if payment data is missing, you’ll be prompted to add a payment plan instead of showing an unreliable date.",
  },
  {
    question: "How are investments tracked?",
    answer:
      "When you connect investment or brokerage accounts through Plaid (or add them as investment accounts), Buxme shows portfolio value and holdings on the Investments screen. If no investment data is connected, the screen stays empty instead of inventing a portfolio total. Contribution and Safe to Spend context appear when holdings exist.",
  },
  {
    question: "How do I delete my Buxme account?",
    answer:
      "Sign in, open Settings, and use Delete account. You’ll confirm by typing DELETE. This permanently removes your Buxme account, finance data, and bank connections, and cannot be undone. If you can’t access Settings, email support and we’ll help with next steps.",
  },
  {
    question: "Is my financial information secure?",
    answer:
      "Buxme uses HTTPS/TLS in transit, secure authentication, and encrypted storage with our infrastructure partners. When you connect banks, authentication with your financial institution is handled by Plaid—Buxme never receives or stores your online banking credentials. For more detail, see our Security and Privacy Policy pages.",
  },
] as const;

export function SupportPageContent() {
  const year = new Date().getFullYear();
  const mailtoHref = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent("Buxme Support Request")}`;

  return (
    <div className="app-shell min-h-screen font-sans text-[var(--foreground)]">
      <header className="border-b border-[var(--surface-border)] px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Buxme home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-base">
              💰
            </span>
            <span className="text-sm font-semibold tracking-tight">
              <span className="text-[var(--accent-light)]">bux</span>me
            </span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6" aria-label="Support page">
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
        <section className="border-b border-[var(--surface-border)] px-6 py-14 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
              Support
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              How can we help?
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              Get help with your Buxme account, connected accounts, transactions,
              bills, income plans, debt, investments, and more.
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
                Browse FAQs
              </a>
            </div>
          </div>
        </section>

        <section
          id="help-categories"
          aria-labelledby="help-categories-heading"
          className="px-6 py-14 sm:py-16"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="help-categories-heading"
              className="text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              Help categories
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
              Jump into the area that matches your question. Contact us anytime
              if you need hands-on help.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {HELP_CATEGORIES.map((category) => (
                <li
                  key={category.title}
                  className="rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface)] p-5"
                >
                  <h3 className="text-base font-semibold text-[var(--foreground)]">
                    {category.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {category.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="border-y border-[var(--surface-border)] bg-[var(--surface-soft)]/40 px-6 py-14 sm:py-16"
        >
          <div className="mx-auto max-w-3xl">
            <h2
              id="faq-heading"
              className="text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              Frequently asked questions
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Quick answers based on how Buxme works today.
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
            <p className="mt-6 text-sm text-[var(--text-muted)]">
              Related:{" "}
              <Link href="/privacy" className="text-[var(--accent)] hover:underline">
                Privacy Policy
              </Link>
              {" · "}
              <Link href="/security" className="text-[var(--accent)] hover:underline">
                Security
              </Link>
              {" · "}
              <Link href="/terms" className="text-[var(--accent)] hover:underline">
                Terms of Service
              </Link>
            </p>
          </div>
        </section>

        <section
          id="contact-support"
          aria-labelledby="contact-support-heading"
          className="px-6 py-14 sm:py-16"
        >
          <div className="mx-auto max-w-3xl rounded-[var(--radius-card)] border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-6 sm:p-8">
            <h2
              id="contact-support-heading"
              className="text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              Contact Support
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
              Email us and include a brief description of what you’re seeing,
              the device or browser you’re using, and any relevant screens (for
              example Accounts, Bills, or Income). Never email passwords or
              sensitive banking credentials.
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
              Email Support
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--surface-border)] px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
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
            <Link href="/privacy" className="transition-colors hover:text-[var(--foreground)]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--foreground)]">
              Terms of Service
            </Link>
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              Main Buxme website
            </Link>
            <Link href="/security" className="transition-colors hover:text-[var(--foreground)]">
              Security
            </Link>
          </nav>
        </div>
        <div className="mx-auto mt-8 max-w-5xl border-t border-[var(--surface-border)] pt-6">
          <p className="text-sm text-[var(--text-subtle)]">
            © {year} Buxme. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
