"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

import {
  DEFAULT_RPC_REQUESTS_PER_SECOND,
  getRateLimitedFetchFn
} from "@/infrastructure/chain/rpc-rate-limit";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const publicBaseRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || "https://mainnet.base.org";

type WagmiRuntimeConfig = ReturnType<typeof createWagmiRuntimeConfig>;

declare global {
  var __theCabWagmiRuntimeConfig__: WagmiRuntimeConfig | undefined;
}

function createWagmiRuntimeConfig() {
  const walletConnectMetadataUrl = typeof window === "undefined"
    ? "https://the-cab.local"
    : window.location.origin;
  const connectors = typeof window === "undefined"
    ? []
    : [
        ...(walletConnectProjectId
          ? [
              walletConnect({
                projectId: walletConnectProjectId,
                metadata: {
                  name: "The Cab",
                  description: "Connected-wallet ledger reconstruction on Base.",
                  url: walletConnectMetadataUrl,
                  icons: []
                },
                showQrModal: true
              })
            ]
          : []),
        injected({ shimDisconnect: true })
      ];

  return createConfig({
    chains: [base],
    connectors,
    transports: {
      [base.id]: http(publicBaseRpcUrl, {
        fetchFn: getRateLimitedFetchFn(publicBaseRpcUrl, DEFAULT_RPC_REQUESTS_PER_SECOND)
      })
    }
  });
}

function getWagmiRuntimeConfig() {
  if (!globalThis.__theCabWagmiRuntimeConfig__) {
    globalThis.__theCabWagmiRuntimeConfig__ = createWagmiRuntimeConfig();
  }

  return globalThis.__theCabWagmiRuntimeConfig__;
}

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [wagmiConfig] = useState(() => getWagmiRuntimeConfig());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}