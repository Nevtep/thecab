"use client";

import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
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
  const [authenticatedAddress, setAuthenticatedAddress] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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

  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") {
      setIsAuthReady(false);
      return;
    }

    if (!isConnected || !address) {
      setAuthenticatedAddress(null);
      setIsAuthReady(true);
      return;
    }

    const normalizedAddress = address.toLowerCase();
    const persistedAddress = readAuthenticatedAddressCookie();

    setAuthenticatedAddress((currentAddress) => {
      if (currentAddress === normalizedAddress || persistedAddress === normalizedAddress) {
        return normalizedAddress;
      }

      return null;
    });
    setIsAuthReady(true);
  }, [address, isConnected, status]);

  const connect = useCallback(async () => {
    if (isConnected && address && authenticatedAddress === address.toLowerCase()) {
      return;
    }

    setIsAuthenticating(true);

    if (isConnected && address && connector) {
      try {
        const signerProvider = await connector.getProvider();
        await requestSignature(signerProvider, address);
        writeAuthenticatedAddressCookie(address);
        setAuthenticatedAddress(address.toLowerCase());
        return;
      } catch (error) {
        clearAuthenticatedAddressCookie();
        setAuthenticatedAddress(null);
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
      setAuthenticatedAddress(connectedAddress.toLowerCase());
    } catch (error) {
      clearAuthenticatedAddressCookie();
      setAuthenticatedAddress(null);
      await disconnectAsync();
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, authenticatedAddress, connectAsync, connector, connectors, disconnectAsync, isConnected, requestSignature]);

  const disconnect = useCallback(() => {
    clearAuthenticatedAddressCookie();
    setAuthenticatedAddress(null);
    setIsAuthReady(true);
    setIsAuthenticating(false);
    void disconnectAsync();
  }, [disconnectAsync]);

  const switchToSupportedChain = useCallback(async () => {
    await switchChainAsync({ chainId: SUPPORTED_CHAIN_ID });
  }, [switchChainAsync]);

  const value = useMemo<CabWalletContextValue>(
    () => ({
      address,
      chainId,
      status,
      isConnected,
      isAuthenticated: Boolean(address && authenticatedAddress === address.toLowerCase()),
      isAuthReady,
      isAuthenticating,
      isSupportedChain: isSupportedChain(chainId),
      connectorName: connector?.name ?? null,
      connect,
      disconnect,
      switchToSupportedChain,
    }),
    [address, authenticatedAddress, chainId, connect, connector?.name, disconnect, isAuthReady, isAuthenticating, isConnected, status, switchToSupportedChain],
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
