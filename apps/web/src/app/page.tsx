"use client";

import { useTranslation } from "react-i18next";

import { DisconnectedShell } from "@/design-system";

import {
  LandingActivityIntelligenceSection,
  LandingCtaSection,
  LandingHeroSection,
  LandingHowItWorksSection,
  LandingModelClaritySection,
  LandingProductPromiseSection,
  LandingTrustPrivacySection,
  LandingValueBlocksSection,
} from "@/app/landing/components";
import { landingAssets } from "@/app/landing/landingAssets";

import styles from "@/app/page.module.css";

export default function Home() {
  const { t } = useTranslation("landing");

  return (
    <DisconnectedShell
      backgroundSrc={landingAssets.pageBackground.src}
      backgroundAlt=""
    >
      <a href="#landing-content" className={styles.skipLink}>
        {t("a11y.skipToContent")}
      </a>

      <div className={styles.page}>
        <main
          id="landing-content"
          className={styles.main}
          tabIndex={-1}
          aria-label={t("a11y.mainLandmark")}
        >
          <header className={styles.landmark} aria-label={t("a11y.heroLandmark")}>
            <LandingHeroSection />
          </header>

          <LandingValueBlocksSection />
          <LandingProductPromiseSection />
          <LandingHowItWorksSection />
          <LandingModelClaritySection />
          <LandingActivityIntelligenceSection />
          <LandingTrustPrivacySection />

          <footer className={styles.landmark} aria-label={t("a11y.footerLandmark")}>
            <LandingCtaSection />
          </footer>
        </main>
      </div>
    </DisconnectedShell>
  );
}
