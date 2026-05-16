type LandingWalletSnapshot = {
  isConnected: boolean;
  isSupportedChain: boolean;
};

export type LandingWalletState = {
  kind: "disconnected" | "connected" | "unsupported";
  primaryLabelKey: string;
  primaryTone: "primary" | "technical" | "warning";
  statusLabelKey: string;
  helperTextKey: string;
  secondaryLabelKey?: string;
  isPrimaryDisabled?: boolean;
};

export function getLandingWalletState({
  isConnected,
  isSupportedChain,
}: LandingWalletSnapshot): LandingWalletState {
  if (!isConnected) {
    return {
      kind: "disconnected",
      primaryLabelKey: "landing:hero.primaryCta.disconnected",
      primaryTone: "primary",
      statusLabelKey: "landing:walletState.disconnected",
      helperTextKey: "wallet:guidance.disconnected",
    };
  }

  if (!isSupportedChain) {
    return {
      kind: "unsupported",
      primaryLabelKey: "landing:hero.primaryCta.unsupported",
      primaryTone: "warning",
      statusLabelKey: "landing:walletState.unsupportedChain",
      helperTextKey: "wallet:guidance.unsupportedBaseOnly",
      secondaryLabelKey: "wallet:actions.disconnect",
    };
  }

  return {
    kind: "connected",
    primaryLabelKey: "landing:hero.primaryCta.connected",
    primaryTone: "technical",
    statusLabelKey: "landing:walletState.connectedBase",
    helperTextKey: "wallet:guidance.connectedBase",
    secondaryLabelKey: "wallet:actions.disconnect",
  };
}
