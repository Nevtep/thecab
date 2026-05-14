"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

import {
  landingAssets,
  landingCoverageAssets,
  landingCoverageCardOrder,
} from "@/app/landing/landingAssets";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/components/LandingTrustPrivacySection.module.css";

const trustBulletOrder = [
  "readOnlyAnalytics",
  "noPrivateKeyCustody",
  "noTransactionExecution",
  "coverageVisible",
] as const;

export function LandingTrustPrivacySection() {
  const { t } = useTranslation("landing");

  return (
    <LandingSectionShell
      id="trust-privacy"
      eyebrow={t("trust.eyebrow")}
      heading={t("trust.heading")}
      description={t("trust.body")}
    >
      <div className={styles.layout}>
        <CabCard density="spacious">
          <CabStack gap="$4">
            <div className={styles.trustVisual}>
              <Image
                src={landingAssets.trustReadOnly.src}
                alt={t("a11y.trustReadOnlyAlt")}
                fill
                sizes="(max-width: 1120px) 100vw, 35vw"
                className={styles.trustImage}
              />
            </div>

            <CabStack gap="$2">
              <CabText variant="heading" fontSize="$6" style={{ color: cabColors.text.primary }}>
                {t("trust.title")}
              </CabText>
              <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                {t("trust.support")}
              </CabText>
            </CabStack>

            <div className={styles.trustBullets}>
              {trustBulletOrder.map((bulletId) => (
                <div key={bulletId} className={styles.bullet}>
                  <CabCard density="default">
                    <CabStack gap="$2">
                      <CabText variant="mono" fontSize="$2" style={{ color: cabColors.brand.signalTeal }}>
                        {t(`trust.bullets.${bulletId}.label`)}
                      </CabText>
                      <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                        {t(`trust.bullets.${bulletId}.body`)}
                      </CabText>
                    </CabStack>
                  </CabCard>
                </div>
              ))}
            </div>
          </CabStack>
        </CabCard>

        <CabStack gap="$4">
          <CabStack gap="$2">
            <CabText variant="heading" fontSize="$6" style={{ color: cabColors.text.primary }}>
              {t("coverage.heading")}
            </CabText>
            <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
              {t("coverage.body")}
            </CabText>
          </CabStack>

          <div className={styles.coverageGrid}>
            {landingCoverageCardOrder.map((coverageId) => {
              const asset = landingAssets[landingCoverageAssets[coverageId]];

              return (
                <div key={coverageId} className={styles.coverageCard}>
                  <CabCard density="spacious">
                    <CabStack gap="$3">
                      <div className={styles.coverageVisual}>
                        <Image
                          src={asset.src}
                          alt={asset.altKey ? t(asset.altKey) : ""}
                          fill
                          sizes="(max-width: 720px) 100vw, (max-width: 1120px) 50vw, 25vw"
                          className={styles.coverageImage}
                        />
                      </div>

                      <CabText variant="heading" fontSize="$5" style={{ color: cabColors.text.primary }}>
                        {t(`coverage.cards.${coverageId}.title`)}
                      </CabText>

                      <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                        {t(`coverage.cards.${coverageId}.body`)}
                      </CabText>
                    </CabStack>
                  </CabCard>
                </div>
              );
            })}
          </div>
        </CabStack>
      </div>
    </LandingSectionShell>
  );
}