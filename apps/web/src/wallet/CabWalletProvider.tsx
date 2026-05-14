"use client";

import { createContext, type PropsWithChildren, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { stringToHex } from "viem";
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

type PersonalSignProvider = {
  request: (args: {
    method: "personal_sign";
    params: [message: `0x${string}`, account: string];
  }) => Promise<string>;
};

export const CabWalletContext = createContext<CabWalletContextValue | undefined>(undefined);

function CabWalletStateProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation("wallet");
  const { address, chainId, isConnected, connector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const connect = useCallback(async () => {
    if (isConnected) return;

    const injectedConnector = connectors.find((candidate) => candidate.id === "injected");
    let injectedProvider: unknown;

    if (injectedConnector) {
      try {
        injectedProvider = await injectedConnector.getProvider();
      } catch {
        injectedProvider = undefined;
      }
    }

    const preferredConnector =
      (injectedProvider ? injectedConnector : undefined) ??
      connectors.find((candidate) => candidate.id === "walletConnect") ??
      connectors[0];

    if (!preferredConnector) {
      throw new Error("NO_WALLET_CONNECTOR_AVAILABLE");
    }

    const connection = await connectAsync({
      connector: preferredConnector,
      chainId: SUPPORTED_CHAIN_ID,
    });

    const connectedAddress = connection.accounts[0];
    const signerProvider = await preferredConnector.getProvider();

    if (
      !signerProvider ||
      typeof signerProvider !== "object" ||
      !("request" in signerProvider) ||
      typeof signerProvider.request !== "function"
    ) {
      await disconnectAsync();
      throw new Error("WALLET_SIGNATURE_UNAVAILABLE");
    }

    try {
      await (signerProvider as PersonalSignProvider).request({
        method: "personal_sign",
        params: [
          stringToHex(
            t("signature.welcomeMessage", {
              address: connectedAddress,
            }),
          ),
          connectedAddress,
        ],
      });
    } catch (error) {
      await disconnectAsync();
      throw error;
    }
  }, [connectAsync, connectors, disconnectAsync, isConnected, t]);

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
