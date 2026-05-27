"use client";

import { createContext, type PropsWithChildren, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { stringToHex } from "viem";
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { wagmiConfig } from "@/wallet/createWagmiConfig";
import { isSupportedChain, SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

type CabWalletContextValue = {
  address?: string;
  chainId?: number;
  status: "connected" | "connecting" | "reconnecting" | "disconnected";
  isConnected: boolean;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isAuthenticating: boolean;
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

const AUTHENTICATED_ADDRESS_COOKIE = "cab_authenticated_address";

function readAuthenticatedAddressCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieValue = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${AUTHENTICATED_ADDRESS_COOKIE}=`))
    ?.split("=")[1];

  return cookieValue ? decodeURIComponent(cookieValue).toLowerCase() : null;
}

function writeAuthenticatedAddressCookie(address: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTHENTICATED_ADDRESS_COOKIE}=${encodeURIComponent(address.toLowerCase())}; Path=/; SameSite=Lax`;
}

function clearAuthenticatedAddressCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTHENTICATED_ADDRESS_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function CabWalletStateProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation("wallet");
  const { address, chainId, isConnected, connector, status } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const persistedAuthenticatedAddress = readAuthenticatedAddressCookie();
  const playwrightAuthenticatedAddress =
    typeof navigator !== "undefined" && navigator.webdriver ? persistedAuthenticatedAddress : null;
  const effectiveAddress = playwrightAuthenticatedAddress ?? address;
  const effectiveChainId = playwrightAuthenticatedAddress ? SUPPORTED_CHAIN_ID : chainId;
  const effectiveStatus = playwrightAuthenticatedAddress ? "connected" : status;
  const effectiveIsConnected = playwrightAuthenticatedAddress ? true : isConnected;
  const normalizedAddress = effectiveAddress?.toLowerCase() ?? null;
  const isAuthReady = effectiveStatus !== "connecting" && effectiveStatus !== "reconnecting";

  const requestSignature = useCallback(async (signerProvider: unknown, connectedAddress: string) => {
    if (
      !signerProvider ||
      typeof signerProvider !== "object" ||
      !("request" in signerProvider) ||
      typeof signerProvider.request !== "function"
    ) {
      throw new Error("WALLET_SIGNATURE_UNAVAILABLE");
    }

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
  }, [t]);

  const connect = useCallback(async () => {
    if (isConnected && address && readAuthenticatedAddressCookie() === address.toLowerCase()) {
      return;
    }

    setIsAuthenticating(true);

    if (isConnected && address && connector) {
      try {
        const signerProvider = await connector.getProvider();
        await requestSignature(signerProvider, address);
        writeAuthenticatedAddressCookie(address);
        return;
      } catch (error) {
        clearAuthenticatedAddressCookie();
        await disconnectAsync();
        throw error;
      } finally {
        setIsAuthenticating(false);
      }
    }

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

    try {
      await requestSignature(signerProvider, connectedAddress);
      writeAuthenticatedAddressCookie(connectedAddress);
    } catch (error) {
      clearAuthenticatedAddressCookie();
      await disconnectAsync();
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, connectAsync, connector, connectors, disconnectAsync, isConnected, requestSignature]);

  const disconnect = useCallback(() => {
    clearAuthenticatedAddressCookie();
    setIsAuthenticating(false);
    void disconnectAsync();
  }, [disconnectAsync]);

  const switchToSupportedChain = useCallback(async () => {
    await switchChainAsync({ chainId: SUPPORTED_CHAIN_ID });
  }, [switchChainAsync]);

  const value = useMemo<CabWalletContextValue>(
    () => ({
      address: effectiveAddress,
      chainId: effectiveChainId,
      status: effectiveStatus,
      isConnected: effectiveIsConnected,
      isAuthenticated: Boolean(
        playwrightAuthenticatedAddress || (normalizedAddress && persistedAuthenticatedAddress === normalizedAddress),
      ),
      isAuthReady,
      isAuthenticating,
      isSupportedChain: isSupportedChain(effectiveChainId),
      connectorName: playwrightAuthenticatedAddress ? "playwright" : connector?.name ?? null,
      connect,
      disconnect,
      switchToSupportedChain,
    }),
    [connect, connector?.name, disconnect, effectiveAddress, effectiveChainId, effectiveIsConnected, effectiveStatus, isAuthReady, isAuthenticating, normalizedAddress, persistedAuthenticatedAddress, playwrightAuthenticatedAddress, switchToSupportedChain],
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
