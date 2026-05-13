"use client";

import type { PropsWithChildren } from "react";

import { I18nProvider } from "@/providers/i18n-provider";
import { QueryProvider } from "@/providers/query-provider";
import { TamaguiProvider } from "@/providers/tamagui-provider";
import { CabWalletProvider } from "@/wallet/CabWalletProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>
        <CabWalletProvider>
          <TamaguiProvider>{children}</TamaguiProvider>
        </CabWalletProvider>
      </QueryProvider>
    </I18nProvider>
  );
}
