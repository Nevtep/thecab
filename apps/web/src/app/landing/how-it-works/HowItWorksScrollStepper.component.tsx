"use client";

import type { RefObject } from "react";

import Image from "next/image";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

import { LandingSectionShell } from "@/app/landing/components/LandingSectionShell";
import styles from "@/app/landing/how-it-works/HowItWorksScrollStepper.module.css";

export type HowItWorksResolvedStep = {
  id: string;
  label: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  imageObjectPosition?: string;
};

type HowItWorksScrollStepperProps = {
  eyebrow: string;
  heading: string;
  description: string;
  steps: HowItWorksResolvedStep[];
  activeStepIndex: number;
  interactive: boolean;
  scopeRef: RefObject<HTMLDivElement | null>;
  pinRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
};

export function HowItWorksScrollStepperComponent({
  eyebrow,
  heading,
  description,
  steps,
  activeStepIndex,
  interactive,
  scopeRef,
  pinRef,
  trackRef,
}: HowItWorksScrollStepperProps) {
  return (
    <LandingSectionShell
      id="how-it-works"
      eyebrow={eyebrow}
      heading={heading}
      description={description}
      className={styles.section}
    >
      <div ref={scopeRef} className={styles.root}>
        {interactive ? (
          <div ref={pinRef} className={styles.pinnedViewport}>
            <div className={styles.stageHeader}>
              <CabStack gap="$2" className={styles.stageCopy}>
                <CabText variant="mono" fontSize="$2" className={styles.stageKicker}>
                  {steps[activeStepIndex]?.label}
                </CabText>
                <CabText variant="heading" fontSize="$7" className={styles.stageHeading}>
                  {steps[activeStepIndex]?.title}
                </CabText>
                <CabText fontSize="$3" className={styles.stageBody}>
                  {steps[activeStepIndex]?.body}
                </CabText>
              </CabStack>

              <div className={styles.progressCluster}>
                <CabText variant="mono" fontSize="$2" className={styles.progressCount}>
                  {String(activeStepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </CabText>

                <div className={styles.progressDots} aria-hidden="true">
                  {steps.map((step, index) => (
                    <span
                      key={step.id}
                      className={[
                        styles.progressDot,
                        index === activeStepIndex ? styles.progressDotActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.viewportFrame}>
              <div ref={trackRef} data-how-it-works-track className={styles.track}>
                {steps.map((step) => (
                  <article key={step.id} className={styles.panel}>
                    <div className={styles.panelVisual}>
                      <div className={styles.visualMedia}>
                        <Image
                          src={step.imageSrc}
                          alt={step.imageAlt}
                          fill
                          sizes="(max-width: 1100px) 100vw, 58vw"
                          className={styles.visualImage}
                          style={step.imageObjectPosition ? { objectPosition: step.imageObjectPosition } : undefined}
                        />
                      </div>
                      <div className={styles.visualLabel}>
                        <CabText
                          variant="mono"
                          fontSize="$2"
                          className={styles.panelStepLabel}
                          style={{ color: cabColors.brand.cabGold }}
                        >
                          {step.label}
                        </CabText>
                      </div>
                      <div className={styles.visualGlow} aria-hidden="true" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.staticStack}>
            {steps.map((step) => (
              <article key={step.id} className={styles.staticPanel}>
                <div className={styles.staticVisual}>
                  <Image
                    src={step.imageSrc}
                    alt={step.imageAlt}
                    fill
                    sizes="(max-width: 900px) 100vw, 50vw"
                    className={styles.staticImage}
                    style={step.imageObjectPosition ? { objectPosition: step.imageObjectPosition } : undefined}
                  />
                </div>

                <div className={styles.staticCopyCard}>
                  <CabCard density="spacious">
                    <CabStack gap="$3">
                      <CabText
                        variant="mono"
                        fontSize="$2"
                        className={styles.staticStepLabel}
                        style={{ color: cabColors.brand.cabGold }}
                      >
                        {step.label}
                      </CabText>

                      <CabText variant="heading" fontSize="$6" className={styles.staticHeading}>
                        {step.title}
                      </CabText>

                      <CabText fontSize="$3" className={styles.staticBody}>
                        {step.body}
                      </CabText>
                    </CabStack>
                  </CabCard>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </LandingSectionShell>
  );
}
