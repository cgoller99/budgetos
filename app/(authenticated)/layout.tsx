import { AuthGate } from "@/components/auth/AuthGate";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { AppLayout } from "@/components/AppLayout";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { WhatsNewProvider } from "@/context/WhatsNewContext";

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <SubscriptionProvider>
        <WhatsNewProvider>
          <OnboardingGate>
            <AppLayout>{children}</AppLayout>
          </OnboardingGate>
        </WhatsNewProvider>
      </SubscriptionProvider>
    </AuthGate>
  );
}
