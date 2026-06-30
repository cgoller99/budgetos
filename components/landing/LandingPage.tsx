import { CTASection } from "./CTASection";
import { DashboardShowcaseSection } from "./DashboardShowcaseSection";
import { FAQSection } from "./FAQSection";
import { FeaturesGridSection } from "./FeaturesGridSection";
import { HeroSection } from "./HeroSection";
import { IncomePlansSection } from "./IncomePlansSection";
import { LandingFooter } from "./LandingFooter";
import { LandingNav } from "./LandingNav";
import { PricingSection } from "./PricingSection";
import { SocialProofSection } from "./SocialProofSection";
import { WhyBuxmeSection } from "./WhyBuxmeSection";

export function LandingPage() {
  return (
    <div className="app-shell min-h-screen font-sans text-[var(--foreground)]">
      <LandingNav />
      <main>
        <HeroSection />
        <SocialProofSection />
        <WhyBuxmeSection />
        <IncomePlansSection />
        <FeaturesGridSection />
        <DashboardShowcaseSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
