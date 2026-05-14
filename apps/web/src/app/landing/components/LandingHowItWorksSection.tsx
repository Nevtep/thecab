"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

import {
  landingAssets,
  landingHowItWorksAssets,
  landingHowItWorksStepOrder,
} from "@/app/landing/landingAssets";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/components/LandingHowItWorksSection.module.css";

export function LandingHowItWorksSection() {
  const { t } = useTranslation("landing");

  return (
    <LandingSectionShell
      id="how-it-works"
      eyebrow={t("howItWorks.eyebrow")}
      heading={t("howItWorks.heading")}
      description={t("howItWorks.body")}
    >
      <div className={styles.grid}>
        {landingHowItWorksStepOrder.map((stepId) => {
          const asset = landingAssets[landingHowItWorksAssets[stepId]];

          return (
            <div key={stepId} className={styles.card}>
              <CabCard density="spacious">
                <CabStack gap="$4">
                  <div className={styles.visual}>
                    <Image
                      src={asset.src}
                      alt={asset.altKey ? t(asset.altKey) : ""}
                      fill
                      sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 20vw"
                      className={styles.image}
                    />
                  </div>

                  <CabStack gap="$2">
                    <div className={styles.stepLabel}>
                      <CabText
                        variant="mono"
                        fontSize="$2"
                        className={styles.stepNumber}
                        style={{ color: cabColors.brand.cabGold }}
                      >
                        {t(`howItWorks.${stepId}.label`)}
                      </CabText>
                      <CabText variant="heading" fontSize="$5" style={{ color: cabColors.text.primary }}>
                        {t(`howItWorks.${stepId}.title`)}
                      </CabText>
                    </div>

                    <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                      {t(`howItWorks.${stepId}.body`)}
                    </CabText>
                  </CabStack>
                </CabStack>
              </CabCard>
            </div>
          );
        })}
      </div>
    </LandingSectionShell>
  );
}