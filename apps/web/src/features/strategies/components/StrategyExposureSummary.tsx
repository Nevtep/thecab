"use client";

import { CabCard, CabKeyValueList, CabStack, CabText } from "@/design-system";
import type { StrategyDetailView } from "@/features/strategies/strategies.types";
import { formatUsd } from "@/i18n/formatters";

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
    { key: "deposited", label: labels.deposited, value: formatNullableUsd(strategy.depositedValueUsd, locale), valueVariant: "mono" as const },
    { key: "withdrawn", label: labels.withdrawn, value: formatNullableUsd(strategy.withdrawnValueUsd, locale), valueVariant: "mono" as const },
    { key: "sharesReceived", label: labels.sharesReceived, value: formatShares(strategy.sharesReceivedRaw, strategy.shareSymbol), valueVariant: "mono" as const },
    { key: "sharesRedeemed", label: labels.sharesRedeemed, value: formatShares(strategy.sharesRedeemedRaw, strategy.shareSymbol), valueVariant: "mono" as const },
    { key: "currentShares", label: labels.currentShares, value: formatShares(strategy.currentSharesRaw, strategy.shareSymbol), valueVariant: "mono" as const },
    { key: "currentValue", label: labels.currentValue, value: formatNullableUsd(strategy.displayValueUsd ?? strategy.currentEstimatedValueUsd, locale), valueVariant: "mono" as const },
  ];

  return (
    <CabCard density="compact">
      <CabStack gap="$2">
        <CabText variant="label">{labels.title}</CabText>
        <CabKeyValueList items={metrics} />
      </CabStack>
    </CabCard>
  );
}
