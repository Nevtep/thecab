"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Button, Text, YStack } from "tamagui";

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
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Image
        src="/LandingBackground.png"
        alt="The Cab background"
        fill
        priority
        style={{ objectFit: "cover", objectPosition: "center" }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(160deg, rgba(4,15,28,0.55) 0%, rgba(4,15,28,0.8) 70%, rgba(4,15,28,0.9) 100%)",
        }}
      />

      <YStack
        alignItems="center"
        justifyContent="center"
        gap="$3"
        padding="$6"
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          textAlign: "center",
        }}
      >
        <Text
          fontSize="$8"
          fontWeight="800"
          style={{ color: "#EAF1FF", maxWidth: 920, lineHeight: 1.1 }}
        >
          {t("landing:title")}
        </Text>

        <Text fontSize="$4" style={{ color: "#B8C7E6", maxWidth: 760 }}>
          {t("landing:subtitle")}
        </Text>

        <Text fontSize="$3" style={{ color: "#00E0E1" }}>
          {isConnected ? t("wallet:connected") : t("wallet:disconnected")}
          {isConnected && address ? ` · ${address.slice(0, 6)}...${address.slice(-4)}` : ""}
        </Text>

        {!isSupportedChain && isConnected ? (
          <Button
            onPress={() => {
              void switchToSupportedChain();
            }}
            backgroundColor="#F2C14E"
          >
            {t("wallet:unsupported")}
          </Button>
        ) : null}

        {!isConnected ? (
          <Button
            onPress={() => {
              void connect();
            }}
            disabled={!walletConnectConfigured}
            backgroundColor="#00E0E1"
          >
            {walletConnectConfigured
              ? t("wallet:actions.connect")
              : t("wallet:actions.configureWalletConnect")}
          </Button>
        ) : (
          <Button
            onPress={() => {
              disconnect();
            }}
            backgroundColor="#15233A"
          >
            {t("wallet:actions.disconnect")}
          </Button>
        )}
      </YStack>
    </main>
  );
}
