"use client";

import type { PropsWithChildren } from "react";
import { TamaguiProvider as Provider, Theme } from "@tamagui/core";

import tamaguiConfig from "../../tamagui.config";

export function TamaguiProvider({ children }: PropsWithChildren) {
  return (
    <Provider config={tamaguiConfig} defaultTheme="dark">
      <Theme name="dark">{children}</Theme>
    </Provider>
  );
}
