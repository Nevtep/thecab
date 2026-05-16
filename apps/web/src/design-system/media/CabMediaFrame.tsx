"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import styles from "@/design-system/media/CabMediaFrame.module.css";

export type CabMediaFit = "contain" | "cover";
export type CabMediaRole = "diagram" | "photo" | "decorative";

export type CabMediaFrameProps = {
  src: string;
  alt: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  fit?: CabMediaFit;
  role?: CabMediaRole;
  priority?: boolean;
  sizes?: string;
  className?: string;
  overlay?: ReactNode;
};

function resolveFit(fit: CabMediaFit | undefined, role: CabMediaRole): CabMediaFit {
  if (fit) {
    return fit;
  }

  if (role === "decorative" || role === "photo") {
    return "cover";
  }

  return "contain";
}

export function CabMediaFrame({
  src,
  alt,
  intrinsicWidth,
  intrinsicHeight,
  fit,
  role = "diagram",
  priority = false,
  sizes = "100vw",
  className,
  overlay,
}: CabMediaFrameProps) {
  const resolvedFit = resolveFit(fit, role);
  const resolvedAlt = role === "decorative" ? "" : alt;

  const frameStyle = {
    aspectRatio: `${intrinsicWidth} / ${intrinsicHeight}`,
  } as CSSProperties;

  const imageClassName = [
    styles.image,
    resolvedFit === "contain" ? styles.imageContain : styles.imageCover,
  ].join(" ");

  const frameClassName = [styles.frame, className].filter(Boolean).join(" ");

  return (
    <div className={frameClassName} style={frameStyle}>
      <Image
        src={src}
        alt={resolvedAlt}
        fill
        priority={priority}
        sizes={sizes}
        className={imageClassName}
      />
      {overlay ? <div className={styles.overlay}>{overlay}</div> : null}
    </div>
  );
}
