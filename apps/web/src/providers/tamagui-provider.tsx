"use client";

import type { PropsWithChildren } from "react";
import { CabThemeProvider } from "@/design-system/theme";

export function TamaguiProvider({ children }: PropsWithChildren) {
  return <CabThemeProvider>{children}</CabThemeProvider>;
}
