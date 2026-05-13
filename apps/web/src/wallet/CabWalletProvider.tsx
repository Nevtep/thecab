"use client";

import { createContext, type PropsWithChildren, useCallback, useMemo } from "react";
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { wagmiConfig } from "@/wallet/createWagmiConfig";
import { isSupportedChain, SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

type CabWalletContextValue = {
  address?: string;
  chainId?: number;
  isConnected: boolean;
  isSupportedChain: boolean;
  connectorName: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToSupportedChain: () => Promise<void>;
};

export const CabWalletContext = createContext<CabWalletContextValue | undefined>(undefined);

function CabWalletStateProvider({ children }: PropsWithChildren) {
  const { address, chainId, isConnected, connector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const connect = useCallback(async () => {
    if (isConnected) return;

    const preferredConnector =
      connectors.find((candidate) => candidate.id === "walletConnect") ?? connectors[0];

    if (!preferredConnector) {
      throw new Error("NO_WALLET_CONNECTOR_AVAILABLE");
    }

    await connectAsync({
      connector: preferredConnector,
      chainId: SUPPORTED_CHAIN_ID,
    });
  }, [connectAsync, connectors, isConnected]);

  const disconnect = useCallback(() => {
    void disconnectAsync();
  }, [disconnectAsync]);

  const switchToSupportedChain = useCallback(async () => {
    await switchChainAsync({ chainId: SUPPORTED_CHAIN_ID });
  }, [switchChainAsync]);

  const value = useMemo<CabWalletContextValue>(
    () => ({
      address,
      chainId,
      isConnected,
      isSupportedChain: isSupportedChain(chainId),
      connectorName: connector?.name ?? null,
      connect,
      disconnect,
      switchToSupportedChain,
    }),
    [address, chainId, connect, connector?.name, disconnect, isConnected, switchToSupportedChain],
  );

  return <CabWalletContext.Provider value={value}>{children}</CabWalletContext.Provider>;
}

export function CabWalletProvider({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <CabWalletStateProvider>{children}</CabWalletStateProvider>
    </WagmiProvider>
  );
}
