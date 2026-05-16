"use client";

import { useTranslation } from "react-i18next";

import { CabCard, CabMediaFrame, CabStack, CabText, cabColors } from "@/design-system";

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
  const visual = landingAssets.productPromiseVisual;

  return (
    <LandingSectionShell
      id="product-promise"
      eyebrow={t("productPromise.eyebrow")}
      heading={t("productPromise.heading")}
      description={t("productPromise.body")}
    >
      <div className={styles.layout}>
        <div className={styles.visualStage}>
          <div className={styles.visualCard}>
            <CabCard density="spacious">
            <div className={styles.visualWrap}>
              <CabMediaFrame
                src={visual.src}
                alt={t("a11y.productPromiseVisualAlt")}
                intrinsicWidth={visual.width}
                intrinsicHeight={visual.height}
                role="diagram"
                fit="contain"
                sizes="(max-width: 920px) 100vw, 60vw"
                className={styles.visualMedia}
                overlay={
                  <>
                    <div className={styles.visualTint} aria-hidden="true" />
                    <div className={styles.cardsOverlay}>
                      <div className={styles.grid}>
                        {productPromiseCardOrder.map((cardId) => (
                          <div key={cardId} className={styles.card}>
                            <CabCard density="default">
                              <CabStack gap="$2">
                                <CabText
                                  variant="heading"
                                  fontSize="$4"
                                  style={{ color: cabColors.text.primary }}
                                >
                                  {t(`productPromise.cards.${cardId}.title`)}
                                </CabText>
                                <CabText
                                  fontSize="$2"
                                  style={{ color: cabColors.text.secondary, lineHeight: 20 }}
                                >
                                  {t(`productPromise.cards.${cardId}.body`)}
                                </CabText>
                              </CabStack>
                            </CabCard>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                }
              />
            </div>
          </CabCard>
          </div>
        </div>
      </div>
    </LandingSectionShell>
  );
}
