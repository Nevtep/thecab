"use client";

import { CabCard, CabStack, CabText } from "@/design-system";
import type { StrategyDetailView } from "@/features/strategies/strategies.types";
import { formatUsd } from "@/i18n/formatters";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategyExposureSummaryProps = {
  strategy: StrategyDetailView;
  locale: string;
  labels: {
    title: string;
    deposited: string;
    withdrawn: string;
    sharesReceived: string;
    sharesRedeemed: string;
    currentShares: string;
    currentValue: string;
  };
};

function formatNullableUsd(value: number | null, locale: string) {
  if (value === null) return "—";
  return formatUsd(value, locale);
}

function formatShares(value: string, symbol: string | null) {
  return symbol ? `${value} ${symbol}` : value;
}

export function StrategyExposureSummary({ labels, locale, strategy }: StrategyExposureSummaryProps) {
  const metrics = [
    { label: labels.deposited, value: formatNullableUsd(strategy.depositedValueUsd, locale) },
    { label: labels.withdrawn, value: formatNullableUsd(strategy.withdrawnValueUsd, locale) },
    { label: labels.sharesReceived, value: formatShares(strategy.sharesReceivedRaw, strategy.shareSymbol) },
    { label: labels.sharesRedeemed, value: formatShares(strategy.sharesRedeemedRaw, strategy.shareSymbol) },
    { label: labels.currentShares, value: formatShares(strategy.currentSharesRaw, strategy.shareSymbol) },
    { label: labels.currentValue, value: formatNullableUsd(strategy.currentEstimatedValueUsd, locale) },
  ];

  return (
    <CabCard density="compact">
      <CabStack gap="$2">
        <CabText variant="label">{labels.title}</CabText>
        <div className={styles.detailMetricGrid}>
          {metrics.map((metric) => (
            <div key={metric.label} className={styles.detailMetric}>
              <CabText variant="caption">{metric.label}</CabText>
              <CabText variant="data">{metric.value}</CabText>
            </div>
          ))}
        </div>
      </CabStack>
    </CabCard>
  );
}
