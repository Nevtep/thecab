"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { CabButton, CabStack, CabText, cabColors } from "@/design-system";

import { landingAssets } from "@/app/landing/landingAssets";
import { scrollToLandingTarget } from "@/app/landing/landingMotion";
import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import { LandingWalletCta } from "@/app/landing/components/LandingWalletCta";
import styles from "@/app/landing/components/LandingCtaSection.module.css";

export function LandingCtaSection() {
  const { t } = useTranslation("landing");

  return (
    <LandingSectionShell
      id="final-cta"
      className={styles.shell}
      eyebrow={t("cta.eyebrow")}
      heading={t("cta.heading")}
      description={t("cta.body")}
    >
      <div className={styles.background} aria-hidden="true">
        <Image
          src={landingAssets.finalCtaBackground.src}
          alt=""
          fill
          sizes="(max-width: 920px) 100vw, 1240px"
          style={{ objectFit: "cover" }}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.grid}>
          <CabStack gap="$4">
            <CabText fontSize="$4" style={{ color: cabColors.text.secondary, lineHeight: 28 }}>
              {t("cta.supportText")}
            </CabText>

            <div className={styles.actions}>
              <CabButton
                tone="ghost"
                onPress={() => {
                  scrollToLandingTarget("how-it-works");
                }}
              >
                {t("cta.secondary")}
              </CabButton>
            </div>
          </CabStack>

          <LandingWalletCta placement="finalCta" continueTargetId="hero" />
        </div>
      </div>
    </LandingSectionShell>
  );
}