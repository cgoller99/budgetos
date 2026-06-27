import { AuthGate } from "@/components/auth/AuthGate";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { AppLayout } from "@/components/AppLayout";

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <OnboardingGate>
        <AppLayout>{children}</AppLayout>
      </OnboardingGate>
    </AuthGate>
  );
}
