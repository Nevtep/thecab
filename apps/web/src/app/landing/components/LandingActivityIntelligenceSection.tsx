"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

import { landingAssets } from "@/app/landing/landingAssets";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/components/LandingActivityIntelligenceSection.module.css";

const activityIntelligenceCardOrder = [
  "rebalanceDetection",
  "residualAttribution",
  "sourceWaterfall",
] as const;

export function LandingActivityIntelligenceSection() {
  const { t } = useTranslation("landing");

  return (
    <LandingSectionShell
      id="activity-intelligence"
      eyebrow={t("activityIntelligence.eyebrow")}
      heading={t("activityIntelligence.heading")}
      description={t("activityIntelligence.body")}
    >
      <div className={styles.layout}>
        <div className={styles.cards}>
          {activityIntelligenceCardOrder.map((cardId, index) => (
            <div key={cardId} className={styles.card}>
              <CabCard density="spacious">
                <CabStack gap="$3">
                  <CabText
                    variant="mono"
                    fontSize="$2"
                    className={styles.cardIndex}
                    style={{ color: cabColors.brand.cabGold }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </CabText>

                  <CabText variant="heading" fontSize="$5" style={{ color: cabColors.text.primary }}>
                    {t(`activityIntelligence.cards.${cardId}.title`)}
                  </CabText>

                  <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                    {t(`activityIntelligence.cards.${cardId}.body`)}
                  </CabText>
                </CabStack>
              </CabCard>
            </div>
          ))}
        </div>

        <div className={styles.visualCard}>
          <CabCard density="spacious">
            <div className={styles.visualWrap}>
              <Image
                src={landingAssets.activityIntelligenceVisual.src}
                alt={t("a11y.activityIntelligenceVisualAlt")}
                fill
                sizes="(max-width: 1120px) 100vw, 52vw"
                className={styles.visualImage}
              />
            </div>
          </CabCard>
        </div>
      </div>
    </LandingSectionShell>
  );
}