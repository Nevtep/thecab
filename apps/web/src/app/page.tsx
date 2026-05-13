"use client";

import { useTranslation } from "react-i18next";

import {
  CabButton,
  CabStack,
  CabText,
  CabWalletAddress,
  DisconnectedShell,
  cabColors,
} from "@/design-system";

import { useCabWallet } from "@/wallet/useCabWallet";

export default function Home() {
  const { t } = useTranslation(["landing", "wallet", "common"]);
  const {
    address,
    isConnected,
    isSupportedChain,
    connect,
    disconnect,
    switchToSupportedChain,
  } = useCabWallet();

  const walletConnectConfigured =
    Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) &&
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID !== "your_walletconnect_project_id";

  return (
    <DisconnectedShell>
      <CabStack
        alignItems="center"
        justifyContent="center"
        gap="$3"
        padding="$6"
        style={{
          width: "100%",
          maxWidth: 920,
          textAlign: "center",
        }}
      >
        <CabText
          variant="display"
          fontSize="$8"
          fontWeight="800"
          style={{ color: cabColors.text.primary, lineHeight: 1.1 }}
        >
          {t("landing:title")}
        </CabText>

        <CabText fontSize="$4" style={{ color: cabColors.text.secondary, maxWidth: 760 }}>
          {t("landing:subtitle")}
        </CabText>

        <CabText fontSize="$3" style={{ color: cabColors.brand.signalTeal }}>
          {isConnected ? t("wallet:connected") : t("wallet:disconnected")}
        </CabText>
        {isConnected && address ? <CabWalletAddress address={address} /> : null}

        {!isSupportedChain && isConnected ? (
          <CabButton
            onPress={() => {
              void switchToSupportedChain();
            }}
            tone="primary"
          >
            {t("wallet:unsupported")}
          </CabButton>
        ) : null}

        {!isConnected ? (
          <CabButton
            onPress={() => {
              void connect();
            }}
            disabled={!walletConnectConfigured}
            tone="primary"
          >
            {walletConnectConfigured
              ? t("wallet:actions.connect")
              : t("wallet:actions.configureWalletConnect")}
          </CabButton>
        ) : (
          <CabButton
            onPress={() => {
              disconnect();
            }}
            tone="secondary"
          >
            {t("wallet:actions.disconnect")}
          </CabButton>
        )}
      </CabStack>
    </DisconnectedShell>
  );
}
