"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

import {
  landingAssets,
  landingValueCardAssets,
  landingValueCardOrder,
} from "@/app/landing/landingAssets";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/components/LandingValueBlocksSection.module.css";

export function LandingValueBlocksSection() {
  const { t } = useTranslation("landing");

  return (
    <LandingSectionShell
      id="value-proposition"
      className={styles.section}
      eyebrow={t("value.eyebrow")}
      heading={t("value.heading")}
      description={t("value.body")}
      background={
        <>
          <Image
            src={landingAssets.problemSectionBackground.src}
            alt=""
            fill
            sizes="100vw"
            className={styles.sectionBackgroundImage}
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
                    <Image
                      src={asset.src}
                      alt={asset.altKey ? t(asset.altKey) : ""}
                      fill
                      sizes="(max-width: 1080px) 100vw, 33vw"
                      className={styles.image}
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
                </CabStack>
              </CabCard>

              <div className={styles.cardGlow} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </LandingSectionShell>
  );
}