"use client";

import { CabBadge, CabCard, CabStack, CabText } from "@/design-system";
import type { StrategyDetailView } from "@/features/strategies/strategies.types";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategySelectedPanelProps = {
  strategy: StrategyDetailView | null;
  labels: {
    exposureSummary: string;
    rewards: string;
    lifecycle: string;
    coverageNote: string;
    currentValue: string;
    shares: string;
  };
  translate: (key: string, options?: { defaultValue?: string }) => string;
};

export function StrategySelectedPanel({ strategy, labels, translate }: StrategySelectedPanelProps) {
  if (!strategy) {
    return (
      <CabCard density="compact">
        <CabText variant="label">{translate("strategies:states.selectedMissingTitle")}</CabText>
      </CabCard>
    );
  }

  return (
    <CabStack gap="$3">
      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="heading">{strategy.strategyLabel}</CabText>
          <CabText variant="caption">{strategy.poolLabel ?? "—"}</CabText>
          <div className={styles.panelMetrics}>
            <div>
              <CabText variant="caption">{labels.currentValue}</CabText>
              <CabText variant="label">{strategy.currentEstimatedValueUsd === null ? "—" : `$${strategy.currentEstimatedValueUsd.toLocaleString("en-US")}`}</CabText>
            </div>
            <div>
              <CabText variant="caption">{labels.shares}</CabText>
              <CabText variant="label">{strategy.currentSharesRaw} {strategy.shareSymbol ?? ""}</CabText>
            </div>
            <CabBadge size="sm" tone={strategy.coverageStatus === "full" ? "success" : "warning"}>
              {translate(`coverage:level.${strategy.coverageStatus}`)}
            </CabBadge>
          </div>
        </CabStack>
      </CabCard>
      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.exposureSummary}</CabText>
          <div className={styles.summaryGrid}>
            <span>{labels.rewards}</span>
            <strong>{strategy.totalRewardsUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}</strong>
            <span>{labels.lifecycle}</span>
            <strong>{strategy.lifecycle.length}</strong>
          </div>
        </CabStack>
      </CabCard>
      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.coverageNote}</CabText>
          <CabText variant="heading">{translate(strategy.coverageNote.titleKey)}</CabText>
          <CabText variant="caption">{translate(strategy.coverageNote.bodyKey)}</CabText>
        </CabStack>
      </CabCard>
    </CabStack>
  );
}

