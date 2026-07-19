import type { Metadata } from "next";
import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/LegalPageLayout";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Security | Buxme",
  description:
    "Learn how Buxme protects your data with encryption, secure authentication, and trusted infrastructure partners.",
};

export default function SecurityPage() {
  return (
    <LegalPageLayout
      title="Security"
      description="Buxme is built with security at the core. This page describes how we protect your account and financial information."
    >
      <LegalSection title="HTTPS / TLS encryption">
        <p>
          All traffic between your browser and Buxme is encrypted in transit
          using HTTPS and modern TLS. This helps prevent unauthorized parties
          from intercepting data while it travels over the internet.
        </p>
      </LegalSection>

      <LegalSection title="Secure authentication">
        <p>
          Buxme uses industry-standard authentication through Supabase Auth,
          including secure password handling and session management. We
          encourage strong, unique passwords and support email verification for
          new accounts.
        </p>
      </LegalSection>

      <LegalSection title="Encryption at rest">
        <p>
          Data stored in Buxme infrastructure is protected with encryption at
          rest provided by our cloud partners. Sensitive fields and database
          storage benefit from platform-level encryption controls.
        </p>
      </LegalSection>

      <LegalSection title="Plaid integration">
        <p>
          When you connect financial accounts, Buxme uses Plaid to securely
          retrieve authorized data. Buxme never receives or stores your online
          banking username or password. You control which accounts and data
          scopes are shared, and you can disconnect at any time.
        </p>
      </LegalSection>

      <LegalSection title="Supabase infrastructure">
        <p>
          Buxme stores application data in Supabase, a managed Postgres platform
          with row-level security (RLS) policies that restrict data access to
          authenticated account owners and authorized household members. Database
          access is limited to operational needs.
        </p>
      </LegalSection>

      <LegalSection title="Vercel hosting">
        <p>
          Buxme is hosted on Vercel, which provides global edge delivery,
          DDoS mitigation, and secure deployment pipelines. Production
          environments use isolated configuration and environment variables for
          secrets.
        </p>
      </LegalSection>

      <LegalSection title="Principle of least privilege">
        <p>
          Internal access to production systems is granted on a need-to-know
          basis. Administrative tools, database access, and deployment
          permissions are limited to authorized personnel only.
        </p>
      </LegalSection>

      <LegalSection title="Security monitoring">
        <p>
          We monitor application health, error rates, and authentication events
          to detect anomalies. We review dependencies for known vulnerabilities
          and apply security updates as part of our release process.
        </p>
      </LegalSection>

      <LegalSection title="Responsible disclosure">
        <p>
          If you discover a security vulnerability, please report it responsibly
          to{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-[var(--accent)] hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>{" "}
          with sufficient detail to reproduce the issue. Do not publicly disclose
          vulnerabilities before we have had a reasonable opportunity to
          investigate and remediate.
        </p>
      </LegalSection>

      <LegalSection title="Future security improvements">
        <p>
          Security is ongoing work. We plan to continue improving Buxme with
          enhanced audit logging, additional account protection options, expanded
          security testing, and tighter integration controls as the product
          evolves.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
