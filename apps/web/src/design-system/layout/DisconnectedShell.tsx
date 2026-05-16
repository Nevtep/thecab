"use client";

import type { CSSProperties, PropsWithChildren } from "react";

import { cabColors } from "@/design-system/tokens";

import styles from "@/design-system/layout/DisconnectedShell.module.css";

type DisconnectedShellProps = PropsWithChildren<{
  backgroundSrc?: string;
  backgroundAlt?: string;
}>;

export function DisconnectedShell({
  children,
  backgroundSrc = "/background.png",
}: DisconnectedShellProps) {
  const backgroundStyle = {
    "--shell-background-image": `url(${backgroundSrc})`,
  } as CSSProperties;

  return (
    <main className={styles.shell}>
      <div
        className={styles.backgroundLayer}
        style={backgroundStyle}
        aria-hidden="true"
      />
      <div className={styles.content} style={{ color: cabColors.text.primary }}>
        {children}
      </div>
    </main>
  );
}
