"use client";

import type { PropsWithChildren } from "react";

export function CabDashboardGrid({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gap: "16px",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}
