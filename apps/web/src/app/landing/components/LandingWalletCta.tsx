"use client";

import { useTranslation } from "react-i18next";

import {
  CabButton,
  CabCard,
  CabStack,
  CabText,
  CabWalletAddress,
  cabColors,
} from "@/design-system";

import styles from "@/app/landing/components/LandingWalletCta.module.css";
import { scrollToLandingTarget } from "@/app/landing/landingMotion";
import {
  type LandingTelemetryPlacement,
  trackLandingTelemetry,
} from "@/app/landing/landingTelemetry";
import { getLandingWalletState } from "@/app/landing/landingWalletState";
import { useCabWallet } from "@/wallet/useCabWallet";

type LandingWalletCtaProps = {
  continueTargetId?: string;
  placement: LandingTelemetryPlacement;
  variant?: "card" | "inline";
};

export function LandingWalletCta({ continueTargetId, placement, variant = "card" }: LandingWalletCtaProps) {
  const { t } = useTranslation(["landing", "wallet"]);
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

  const state = getLandingWalletState({
    isConnected,
    isSupportedChain,
    walletConnectConfigured,
  });

  const accentColor =
    state.kind === "unsupported"
      ? cabColors.semantic.warning
      : state.kind === "connected"
        ? cabColors.brand.signalTeal
        : cabColors.brand.cabGold;

  const handlePrimaryAction = async () => {
    trackLandingTelemetry({
      event: "landing_wallet_cta_primary_click",
      placement,
      state: state.kind,
    });

    if (state.kind === "disconnected") {
      if (!walletConnectConfigured) return;
      await connect();
      return;
    }

    if (state.kind === "unsupported") {
      await switchToSupportedChain();
      return;
    }

    scrollToLandingTarget(continueTargetId);
  };

  const handleSecondaryAction = () => {
    trackLandingTelemetry({
      event: "landing_wallet_cta_secondary_click",
      placement,
      state: state.kind,
    });
    disconnect();
  };

  const content = (
    <CabStack gap="$3">
      <div className={styles.statusRow}>
        <CabStack row gap="$2" alignItems="center">
          <span className={styles.dot} style={{ color: accentColor }} aria-hidden="true" />
          <CabText variant="label" fontSize="$3" style={{ color: cabColors.text.primary }}>
            {t(state.statusLabelKey)}
          </CabText>
        </CabStack>

        {isConnected && address ? <CabWalletAddress address={address} /> : null}
      </div>

      <CabText fontSize="$3" style={{ color: cabColors.text.secondary, lineHeight: 24 }}>
        {t(state.helperTextKey)}
      </CabText>

      <div className={styles.actions}>
        <CabButton
          onPress={() => {
            void handlePrimaryAction();
          }}
          tone={state.primaryTone}
          disabled={state.isPrimaryDisabled}
        >
          {t(state.primaryLabelKey)}
        </CabButton>

        {state.secondaryLabelKey ? (
          <CabButton onPress={handleSecondaryAction} tone="secondary">
            {t(state.secondaryLabelKey)}
          </CabButton>
        ) : null}
      </div>
    </CabStack>
  );

  if (variant === "inline") {
    return <div className={styles.inline}>{content}</div>;
  }

  return (
    <div className={styles.card}>
      <CabCard density="spacious">{content}</CabCard>
    </div>
  );
}