import { AuthGate } from "@/components/auth/AuthGate";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { AppLayout } from "@/components/AppLayout";
import { SubscriptionProvider } from "@/context/SubscriptionContext";

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <SubscriptionProvider>
        <OnboardingGate>
          <AppLayout>{children}</AppLayout>
        </OnboardingGate>
      </SubscriptionProvider>
    </AuthGate>
  );
}
