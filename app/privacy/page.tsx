import type { Metadata } from "next";
import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/LegalPageLayout";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Privacy Policy | Buxme",
  description:
    "Learn how Buxme collects, uses, and protects your personal and financial information.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="This Privacy Policy explains how Buxme collects, uses, stores, and protects your information when you use our personal finance platform."
    >
      <LegalSection title="Information we collect">
        <p>
          We collect information you provide directly, such as your name, email
          address, account credentials for Buxme (not your bank credentials),
          financial data you enter manually, and preferences you set in the
          app.
        </p>
        <p>
          When you connect financial accounts through Plaid, we receive account
          metadata, balances, and transaction data that you explicitly
          authorize. We may also collect device, browser, and usage information
          to operate and improve the service.
        </p>
      </LegalSection>

      <LegalSection title="How we use data">
        <p>
          Buxme uses your information to provide budgeting, goal tracking,
          income planning, reporting, and related financial organization
          features. We use data to personalize your experience, maintain your
          account, communicate with you about the service, and improve product
          reliability and security.
        </p>
        <p>
          We do not use your financial data for unrelated advertising profiles.
        </p>
      </LegalSection>

      <LegalSection title="Plaid integration">
        <p>
          Buxme uses Plaid Inc. (&quot;Plaid&quot;) to connect financial
          accounts when you choose to link them. Plaid acts as an intermediary
          between Buxme and your financial institution.
        </p>
        <p>
          <strong className="text-[var(--foreground)]">
            Buxme never receives or stores your online banking credentials.
          </strong>{" "}
          Authentication with your bank is handled by Plaid and your financial
          institution.
        </p>
        <p>
          Users explicitly authorize access before any financial data is
          retrieved. You can revoke access at any time through Buxme settings or
          your financial institution.
        </p>
      </LegalSection>

      <LegalSection title="Bank data permissions">
        <p>
          When you connect an account, you grant Buxme permission to access the
          specific data scopes you approve during the Plaid linking flow. Buxme
          only requests permissions needed to provide the features you use, such
          as displaying balances and categorizing transactions.
        </p>
      </LegalSection>

      <LegalSection title="Transaction data">
        <p>
          Transaction data may include amounts, dates, merchants, categories,
          and account identifiers. You may also enter transactions manually.
          Buxme uses this data to power dashboards, reports, bills, income
          plans, and automation features within your account.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Buxme uses cookies and similar technologies to keep you signed in,
          remember preferences (such as theme settings), and maintain session
          security. You can control cookies through your browser settings, though
          some features may not function properly if cookies are disabled.
        </p>
      </LegalSection>

      <LegalSection title="Analytics">
        <p>
          We may use privacy-conscious analytics to understand product usage,
          diagnose errors, and improve performance. Analytics data is aggregated
          where possible and is not sold to third parties.
        </p>
      </LegalSection>

      <LegalSection title="Data sharing">
        <p>
          <strong className="text-[var(--foreground)]">
            Buxme does not sell consumer financial data.
          </strong>
        </p>
        <p>
          We share information only with service providers that help us operate
          Buxme (such as hosting, authentication, email delivery, and Plaid for
          account connectivity), when required by law, or to protect the rights
          and safety of Buxme and our users. Service providers are bound by
          contractual obligations to protect your data.
        </p>
      </LegalSection>

      <LegalSection title="Data security">
        <p>
          We implement administrative, technical, and organizational safeguards
          designed to protect your information. See our{" "}
          <a href="/security" className="text-[#0077ed] hover:underline">
            Security page
          </a>{" "}
          for more detail on how we protect Buxme.
        </p>
      </LegalSection>

      <LegalSection title="User rights">
        <p>
          Depending on your location, you may have rights to access, correct,
          delete, or export your personal data, and to object to or restrict
          certain processing. Contact us to exercise these rights and we will
          respond within a reasonable timeframe.
        </p>
      </LegalSection>

      <LegalSection title="Data deletion requests">
        <p>
          You may delete your Buxme account and associated data from Settings, or
          request deletion by emailing{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-[#0077ed] hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          . We will delete or anonymize your data unless we are required to retain
          it for legal, security, or fraud-prevention purposes.
        </p>
      </LegalSection>

      <LegalSection title="Contact information">
        <p>
          Questions about this Privacy Policy? Contact us at{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-[#0077ed] hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
