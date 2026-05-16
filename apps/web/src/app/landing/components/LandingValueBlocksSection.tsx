"use client";

import { useTranslation } from "react-i18next";

import { CabCard, CabMediaFrame, CabStack, CabText, cabColors } from "@/design-system";

import {
  landingAssets,
  landingValueCardAssets,
  landingValueCardOrder,
} from "@/app/landing/landingAssets";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/components/LandingValueBlocksSection.module.css";

export function LandingValueBlocksSection() {
  const { t } = useTranslation("landing");
  const sectionBackground = landingAssets.problemSectionBackground;

  return (
    <LandingSectionShell
      id="value-proposition"
      className={styles.section}
      eyebrow={t("value.eyebrow")}
      heading={t("value.heading")}
      description={t("value.body")}
      background={
        <>
          <CabMediaFrame
            src={sectionBackground.src}
            alt=""
            intrinsicWidth={sectionBackground.width}
            intrinsicHeight={sectionBackground.height}
            role="decorative"
            fit="cover"
            sizes="100vw"
            className={styles.sectionBackgroundFrame}
          />
          <div className={styles.sectionBackgroundTint} aria-hidden="true" />
        </>
      }
    >
      <div className={styles.grid}>
        {landingValueCardOrder.map((cardId) => {
          const asset = landingAssets[landingValueCardAssets[cardId]];

          return (
            <div key={cardId} className={styles.card}>
              <CabCard density="spacious">
                <CabStack gap="$4">
                  <div className={styles.imageWrap}>
                    <CabMediaFrame
                      src={asset.src}
                      alt={asset.altKey ? t(asset.altKey) : ""}
                      intrinsicWidth={asset.width}
                      intrinsicHeight={asset.height}
                      role="diagram"
                      fit="contain"
                      sizes="(max-width: 1080px) 100vw, 33vw"
                    />
                  </div>

                  <CabStack gap="$2">
                    <CabText variant="heading" fontSize="$6" style={{ color: cabColors.text.primary }}>
                      {t(`value.cards.${cardId}.title`)}
                    </CabText>
                    <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                      {t(`value.cards.${cardId}.body`)}
                    </CabText>
                  </CabStack>

                  <div className={styles.cardGlow} aria-hidden="true" />
                </CabStack>
              </CabCard>
            </div>
          );
        })}
      </div>
    </LandingSectionShell>
  );
}
