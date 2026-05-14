"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

import { landingAssets } from "@/app/landing/landingAssets";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/components/LandingModelClaritySection.module.css";

const modelClarityBlockOrder = ["pool", "deposit", "strategy"] as const;

export function LandingModelClaritySection() {
  const { t } = useTranslation("landing");

  return (
    <LandingSectionShell
      id="model-clarity"
      eyebrow={t("modelClarity.eyebrow")}
      heading={t("modelClarity.heading")}
      description={t("modelClarity.body")}
    >
      <div className={styles.layout}>
        <div className={styles.visualCard}>
          <CabCard density="spacious">
            <div className={styles.visualWrap}>
              <Image
                src={landingAssets.modelClarityDiagram.src}
                alt={t("a11y.modelClarityVisualAlt")}
                fill
                sizes="(max-width: 1120px) 100vw, 48vw"
                className={styles.visualImage}
              />
            </div>
          </CabCard>
        </div>

        <div className={styles.blocks}>
          {modelClarityBlockOrder.map((blockId, index) => (
            <div key={blockId} className={styles.block}>
              <CabCard density="spacious">
                <CabStack gap="$3">
                  <CabText
                    variant="mono"
                    fontSize="$2"
                    className={styles.blockIndex}
                    style={{ color: cabColors.brand.signalTeal }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </CabText>

                  <CabText variant="heading" fontSize="$6" style={{ color: cabColors.text.primary }}>
                    {t(`modelClarity.blocks.${blockId}.title`)}
                  </CabText>

                  <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
                    {t(`modelClarity.blocks.${blockId}.body`)}
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