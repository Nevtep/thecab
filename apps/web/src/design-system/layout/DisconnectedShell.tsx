"use client";

import Image from "next/image";
import type { PropsWithChildren } from "react";

import { cabColors } from "@/design-system/tokens";

export function DisconnectedShell({ children }: PropsWithChildren) {
  return (
    <main style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden" }}>
      <Image
        src="/LandingBackground.png"
        alt="The Cab background"
        fill
        priority
        style={{ objectFit: "cover", objectPosition: "center" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
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
