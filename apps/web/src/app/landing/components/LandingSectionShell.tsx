"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { CabStack, CabText, cabColors } from "@/design-system";

import styles from "@/app/landing/components/LandingSectionShell.module.css";

type LandingSectionShellProps = PropsWithChildren<{
  id?: string;
  eyebrow?: ReactNode;
  heading?: ReactNode;
  description?: ReactNode;
  className?: string;
  background?: ReactNode;
}>;

export function LandingSectionShell({
  id,
  eyebrow,
  heading,
  description,
  className,
  background,
  children,
}: LandingSectionShellProps) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={heading && headingId ? headingId : undefined}
      className={[styles.section, className].filter(Boolean).join(" ")}
    >
      {background ? <div className={styles.background}>{background}</div> : null}

      <CabStack gap="$4" className={styles.content}>
        {eyebrow ? (
          <CabText
            variant="mono"
            fontSize="$2"
            className={styles.eyebrow}
            style={{ color: cabColors.brand.signalTeal }}
          >
            {eyebrow}
          </CabText>
        ) : null}

        {heading ? (
          <CabText
            id={headingId}
            variant="heading"
            fontSize="$8"
            lineHeight={48}
            className={styles.heading}
            style={{ color: cabColors.text.primary }}
          >
            {heading}
          </CabText>
        ) : null}

        {description ? (
          <CabText
            fontSize="$4"
            className={styles.description}
            style={{ color: cabColors.text.secondary, lineHeight: 28 }}
          >
            {description}
          </CabText>
        ) : null}

        {children}
      </CabStack>
    </section>
  );
}