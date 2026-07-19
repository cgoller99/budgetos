import type { Metadata } from "next";
import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/LegalPageLayout";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Terms of Service | Buxme",
  description:
    "Read the Terms of Service governing your use of the Buxme personal finance platform.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description="These Terms of Service govern your access to and use of Buxme. Please read them carefully before using the service."
    >
      <LegalSection title="Acceptance of terms">
        <p>
          By creating an account, accessing, or using Buxme, you agree to these
          Terms of Service and our Privacy Policy. If you do not agree, do not use
          Buxme.
        </p>
      </LegalSection>

      <LegalSection title="User responsibilities">
        <p>
          You are responsible for the accuracy of information you enter, for
          maintaining the confidentiality of your Buxme account credentials, and
          for all activity under your account. You agree to use Buxme only for
          lawful purposes and in compliance with applicable laws and regulations.
        </p>
      </LegalSection>

      <LegalSection title="Account security">
        <p>
          You must provide accurate registration information and keep your
          password secure. Notify us immediately at{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-[var(--accent)] hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>{" "}
          if you suspect unauthorized access to your account.
        </p>
      </LegalSection>

      <LegalSection title="Financial information disclaimer">
        <p>
          Buxme helps you organize and understand your finances. Balances,
          projections, and insights displayed in the app depend on the data you
          provide or authorize and may not reflect real-time account status from
          your financial institutions.
        </p>
        <p>
          Buxme is not a bank, broker-dealer, or financial institution. We do not
          hold your funds.
        </p>
      </LegalSection>

      <LegalSection title="No investment, legal, or tax advice">
        <p>
          Buxme does not provide investment, legal, tax, or accounting advice.
          Content in the app is for informational and organizational purposes
          only. Consult qualified professionals before making financial,
          legal, or tax decisions.
        </p>
      </LegalSection>

      <LegalSection title="Subscription terms">
        <p>
          Some Buxme features may require a paid subscription. If you purchase a
          subscription, you agree to the pricing and billing terms presented at
          checkout. Subscriptions renew automatically unless canceled before the
          renewal date. We may change pricing with reasonable notice where
          required by law.
        </p>
      </LegalSection>

      <LegalSection title="Refund policy">
        <p>
          Unless otherwise stated at purchase or required by applicable law,
          subscription fees are non-refundable. If you believe you were charged in
          error, contact{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-[var(--accent)] hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>{" "}
          within 14 days of the charge.
        </p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          Buxme and its logos, design, software, and content are owned by Buxme
          or its licensors and are protected by intellectual property laws. You
          may not copy, modify, distribute, or reverse engineer any part of the
          service except as permitted by law or with our written consent.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Buxme and its affiliates will
          not be liable for indirect, incidental, special, consequential, or
          punitive damages, or for loss of profits, data, or goodwill arising
          from your use of the service.
        </p>
        <p>
          Our total liability for any claim relating to the service is limited
          to the amount you paid Buxme in the twelve months before the claim, or
          one hundred U.S. dollars if you have not paid Buxme.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          You may stop using Buxme and delete your account at any time. We may
          suspend or terminate access if you violate these Terms, create risk
          to other users, or as required by law. Provisions that by their nature
          should survive termination will remain in effect.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These Terms are governed by the laws of the State of Delaware, United
          States, without regard to conflict-of-law principles, except where
          mandatory consumer protection laws in your jurisdiction apply.
        </p>
      </LegalSection>

      <LegalSection title="Contact information">
        <p>
          For questions about these Terms, contact{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-[var(--accent)] hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
