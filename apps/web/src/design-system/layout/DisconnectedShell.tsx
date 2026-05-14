"use client";

import Image from "next/image";
import type { PropsWithChildren } from "react";

import { cabColors } from "@/design-system/tokens";

type DisconnectedShellProps = PropsWithChildren<{
  backgroundSrc?: string;
  backgroundAlt?: string;
}>;

export function DisconnectedShell({
  children,
  backgroundSrc = "/background.png",
  backgroundAlt = "The Cab background",
}: DisconnectedShellProps) {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "#061221",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <Image
          src={backgroundSrc}
          alt={backgroundAlt}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
      </div>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(160deg, rgba(4,15,28,0.55) 0%, rgba(4,15,28,0.8) 70%, rgba(4,15,28,0.9) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          padding: "32px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: cabColors.text.primary,
        }}
      >
        {children}
      </div>
    </main>
  );
}
