"use client";

import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslation } from "react-i18next";

import {
  HowItWorksScrollStepperComponent,
  type HowItWorksResolvedStep,
} from "@/app/landing/how-it-works/HowItWorksScrollStepper.component";
import { howItWorksSteps } from "@/app/landing/how-it-works/howItWorks.steps";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const INTERACTIVE_QUERY = "(min-width: 960px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function HowItWorksScrollStepperContainer() {
  const { t } = useTranslation("landing");
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const desktopQuery = window.matchMedia(INTERACTIVE_QUERY);
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

    const updateMode = () => {
      const nextInteractive = desktopQuery.matches && !reducedMotionQuery.matches;
      setInteractive(nextInteractive);
      if (!nextInteractive) {
        setActiveStepIndex(0);
      }
    };

    updateMode();
    desktopQuery.addEventListener("change", updateMode);
    reducedMotionQuery.addEventListener("change", updateMode);

    return () => {
      desktopQuery.removeEventListener("change", updateMode);
      reducedMotionQuery.removeEventListener("change", updateMode);
    };
  }, []);

  const steps: HowItWorksResolvedStep[] = howItWorksSteps.map((step) => ({
    id: step.id,
    label: t(step.labelKey),
    title: t(step.titleKey),
    body: t(step.bodyKey),
    imageSrc: step.asset.src,
    imageAlt: step.asset.altKey ? t(step.asset.altKey) : "",
    imageWidth: step.asset.width,
    imageHeight: step.asset.height,
  }));

  useGSAP(
    () => {
      if (!interactive || !pinRef.current || !trackRef.current || steps.length <= 1) {
        return;
      }

      setActiveStepIndex(0);

      const stepCount = steps.length;
      const tween = gsap.to(trackRef.current, {
        xPercent: -100 * (stepCount - 1),
        ease: "none",
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          end: () => `+=${window.innerHeight * (stepCount - 1)}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: {
            snapTo: 1 / (stepCount - 1),
            duration: { min: 0.15, max: 0.35 },
            ease: "power1.inOut",
          },
          onUpdate: (self) => {
            const nextStep = Math.round(self.progress * (stepCount - 1));
            setActiveStepIndex(nextStep);
          },
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: scopeRef, dependencies: [interactive, steps.length] },
  );

  return (
    <HowItWorksScrollStepperComponent
      eyebrow={t("howItWorks.eyebrow")}
      heading={t("howItWorks.title")}
      description={t("howItWorks.body")}
      steps={steps}
      activeStepIndex={activeStepIndex}
      interactive={interactive}
      scopeRef={scopeRef}
      pinRef={pinRef}
      trackRef={trackRef}
    />
  );
}
