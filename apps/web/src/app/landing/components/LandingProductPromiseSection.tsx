"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

import { landingAssets } from "@/app/landing/landingAssets";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/components/LandingProductPromiseSection.module.css";

const productPromiseCardOrder = [
  "overview",
  "pools",
  "deposits",
  "strategies",
  "rewards",
  "governance",
] as const;

export function LandingProductPromiseSection() {
  const { t } = useTranslation("landing");

  return (
    <LandingSectionShell
      id="product-promise"
      eyebrow={t("productPromise.eyebrow")}
      heading={t("productPromise.heading")}
      description={t("productPromise.body")}
    >
      <div className={styles.layout}>
        <div className={styles.visualCard}>
          <CabCard density="spacious">
            <div className={styles.visualWrap}>
              <Image
                src={landingAssets.productPromiseVisual.src}
                alt={t("a11y.productPromiseVisualAlt")}
                fill
                sizes="(max-width: 920px) 100vw, 1240px"
                className={styles.visualImage}
              />
              <div className={styles.visualTint} aria-hidden="true" />
            </div>
          </CabCard>
        </div>

        <div className={styles.grid}>
          {productPromiseCardOrder.map((cardId, index) => (
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
                    {t(`productPromise.cards.${cardId}.title`)}
                  </CabText>

                  <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                    {t(`productPromise.cards.${cardId}.body`)}
                  </CabText>
                </CabStack>
              </CabCard>
            </div>
          ))}
        </div>
      </div>
    </LandingSectionShell>
  );
}