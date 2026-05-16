"use client";

import { useTranslation } from "react-i18next";

import { CabBadge, CabButton, CabMediaFrame, CabStack, CabText, cabColors } from "@/design-system";

import { landingAssets } from "@/app/landing/landingAssets";
import { scrollToLandingTarget } from "@/app/landing/landingMotion";
import styles from "@/app/landing/components/LandingHeroSection.module.css";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import { LandingWalletCta } from "@/app/landing/components/LandingWalletCta";

const heroBadgeKeys = ["base", "aerodrome", "mellow", "wallet"] as const;

const panelMetricKeys = [
  ["poolExposureLabel", "poolExposureValue"],
  ["coverageLabel", "coverageValue"],
  ["rewardsLabel", "rewardsValue"],
] as const;

export function LandingHeroSection() {
  const { t } = useTranslation("landing");
  const heroVisual = landingAssets.heroVisual;
  const heroBackground = landingAssets.heroBackground;

  return (
    <LandingSectionShell
      id="hero"
      className={styles.heroSection}
      eyebrow={t("hero.eyebrow")}
      heading={t("hero.title")}
      description={t("hero.body")}
      background={
        <>
          <CabMediaFrame
            src={heroBackground.src}
            alt=""
            intrinsicWidth={heroBackground.width}
            intrinsicHeight={heroBackground.height}
            role="decorative"
            fit="cover"
            priority
            sizes="100vw"
            className={styles.heroBackgroundFrame}
          />
          <div className={styles.heroBackgroundTint} aria-hidden="true" />
        </>
      }
    >
      <div className={styles.heroGrid}>
        <CabStack gap="$5" className={styles.copy}>
          <CabText fontSize="$4" style={{ color: cabColors.text.secondary, lineHeight: 28 }}>
            {t("hero.support")}
          </CabText>

          <LandingWalletCta placement="hero" variant="inline" continueTargetId="final-cta" />

          <div className={styles.badgeRow}>
            {heroBadgeKeys.map((badgeKey) => (
              <CabBadge
                key={badgeKey}
                variant="status"
                size="sm"
                tone={badgeKey === "base" ? "warning" : "info"}
              >
                {t(`hero.badges.${badgeKey}`)}
              </CabBadge>
            ))}
          </div>

          <CabStack row gap="$3" flexWrap="wrap">
            <CabButton
              tone="ghost"
              onPress={() => {
                scrollToLandingTarget("value-proposition");
              }}
            >
              {t("hero.secondaryCta")}
            </CabButton>
          </CabStack>
        </CabStack>

        <div className={styles.visualFrame}>
          <CabMediaFrame
            src={heroVisual.src}
            alt={t("a11y.heroVisualAlt")}
            intrinsicWidth={heroVisual.width}
            intrinsicHeight={heroVisual.height}
            role="diagram"
            fit="contain"
            priority
            sizes="(max-width: 960px) 100vw, 40vw"
            className={styles.visualMediaFrame}
            overlay={<div className={styles.visualOverlay} aria-hidden="true" />}
          />

          <div className={styles.panel}>
            <CabStack gap="$3">
              <CabText variant="mono" fontSize="$2" style={{ color: cabColors.brand.signalTeal }}>
                {t("hero.panel.title")}
              </CabText>

              <CabStack row gap="$2" alignItems="center">
                <CabText variant="heading" fontSize="$6" style={{ color: cabColors.text.primary }}>
                  {t("hero.panel.status")}
                </CabText>
              </CabStack>

              <div className={styles.panelGrid}>
                {panelMetricKeys.map(([labelKey, valueKey]) => (
                  <CabStack key={labelKey} gap="$1" className={styles.panelMetric}>
                    <CabText variant="mono" fontSize="$2" style={{ color: cabColors.text.muted }}>
                      {t(`hero.panel.${labelKey}`)}
                    </CabText>
                    <CabText variant="heading" fontSize="$5" style={{ color: cabColors.text.primary }}>
                      {t(`hero.panel.${valueKey}`)}
                    </CabText>
                  </CabStack>
                ))}
              </div>
            </CabStack>
          </div>
        </div>
      </div>
    </LandingSectionShell>
  );
}
