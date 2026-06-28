import { CTASection } from "./CTASection";
import { FAQSection } from "./FAQSection";
import { FeaturesSection } from "./FeaturesSection";
import { HeroSection } from "./HeroSection";
import { LandingFooter } from "./LandingFooter";
import { LandingNav } from "./LandingNav";
import { PricingSection } from "./PricingSection";
import { ScreenshotsSection } from "./ScreenshotsSection";
import { SecuritySection } from "./SecuritySection";

export function LandingPage() {
  return (
    <div className="app-shell min-h-screen font-sans text-white">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <ScreenshotsSection />
        <SecuritySection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
