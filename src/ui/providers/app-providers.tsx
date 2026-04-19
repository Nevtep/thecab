"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const publicBaseRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || "https://mainnet.base.org";

function createWagmiRuntimeConfig() {
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
                  url: "https://the-cab.local",
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
      [base.id]: http(publicBaseRpcUrl)
    }
  });
}

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [wagmiConfig] = useState(() => createWagmiRuntimeConfig());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}