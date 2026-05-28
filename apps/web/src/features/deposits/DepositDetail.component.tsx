"use client";

import { useTranslation } from "react-i18next";

import {
  CabBadge,
  CabButton,
  CabCard,
  CabEmptyState,
  CabErrorPanel,
  CabImpactMetricCard,
  CabLoadingPanel,
  CabStack,
  CabText,
} from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { DepositCoveredRangeNote } from "@/features/deposits/components/DepositCoveredRangeNote";
import { DepositDetailHeader } from "@/features/deposits/components/DepositDetailHeader";
import { DepositLifecycleTimeline } from "@/features/deposits/components/DepositLifecycleTimeline";
import { DepositPerformanceDecomposition } from "@/features/deposits/components/DepositPerformanceDecomposition";
import { DepositRangeIndicator } from "@/features/deposits/components/DepositRangeIndicator";
import { DepositStrategiesCrossLink } from "@/features/deposits/components/DepositStrategiesCrossLink";
import { DepositValueChart } from "@/features/deposits/components/DepositValueChart";
import type { DepositDetailResponse } from "@/features/deposits/deposits.types";
import { mapDepositDetailResponseToViewModel } from "@/features/deposits/deposits.mappers";

type DepositDetailComponentProps = {
  screenState: "loading" | "error" | "empty" | "ready";
  response: DepositDetailResponse | null;
  errorCode: string | null;
  locale: string;
  onRetry: () => void;
  onClose?: () => void;
};

function explorerUrl(tokenId: string | null) {
  if (!tokenId) return null;
  return `https://basescan.org/token/0x827922686190790b37229fd06084350e74485b72?a=${tokenId}`;
}

export function DepositDetailComponent(input: DepositDetailComponentProps) {
  const { t } = useTranslation(["deposits"]);
  const label = (key: string, fallback: string) => t(key, { defaultValue: fallback }) ?? fallback;

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={label("detail.loading", "Loading deposit detail…")} />;
  }

  if (input.screenState === "error") {
    return (
      <CabErrorPanel
        title={label("detail.error.title", "We couldn’t load this deposit")}
        description={label("detail.error.description", "Please retry.")}
        retryLabel={label("list.error.actionLabel", "Try again")}
        onRetry={input.onRetry}
      />
    );
  }

  if (input.screenState === "empty" || !input.response) {
    return (
      <CabEmptyState
        title={label("detail.empty.title", "Deposit not found")}
        description={label("detail.empty.description", "This deposit is no longer available in the analyzed set.")}
      />
    );
  }

  const deposit = input.response.deposit;
  const viewModel = mapDepositDetailResponseToViewModel({
    response: input.response,
    locale: input.locale,
    translate: (key, options) => t(key, { defaultValue: options?.defaultValue ?? key }),
  });

  return (
    <CabStack gap="$4">
      <DepositDetailHeader
        title={viewModel.header.title}
        subtitle={viewModel.header.subtitle}
        statusLabel={viewModel.header.statusLabel}
        tokenIdLabel={viewModel.header.tokenIdLabel}
        explorerUrl={explorerUrl(deposit.tokenId)}
        viewInExplorerLabel={viewModel.actions.viewInExplorerLabel}
        closeLabel={viewModel.actions.closeLabel}
        onClose={input.onClose}
      />

      <CabStack row gap="$3" flexWrap="wrap">
        <CabImpactMetricCard
          label={viewModel.kpis.currentValueLabel}
          value={viewModel.kpis.currentValueValue}
          iconName="dashboard"
          accentColor={cabColors.brand.electricBlue}
          size="compact"
        />
        <CabImpactMetricCard
          label={viewModel.kpis.totalReturnLabel}
          value={viewModel.kpis.totalReturnValue}
          meta={viewModel.kpis.totalReturnMeta}
          iconName="activity"
          accentColor={cabColors.brandExtended.signalTealRaw}
          size="compact"
        />
      </CabStack>

      <CabCard density="spacious">
        <CabStack gap="$2">
          <CabText variant="label">{viewModel.secondaryStatsTitle}</CabText>
          <CabStack row gap="$3" flexWrap="wrap">
            {viewModel.secondaryStats.map((stat) => stat.emphasized ? (
              <CabStack key={stat.key} row gap="$2" alignItems="center">
                <CabText variant="caption">{stat.label}:</CabText>
                <CabBadge tone={stat.tone ?? "neutral"}>{stat.value}</CabBadge>
              </CabStack>
            ) : (
              <CabText key={stat.key} variant="caption">{stat.label}: {stat.value}</CabText>
            ))}
          </CabStack>
        </CabStack>
      </CabCard>

      <DepositCoveredRangeNote
        title={viewModel.coveredRange.title}
        value={viewModel.coveredRange.value}
        hint={viewModel.coveredRange.hint}
      />

      {viewModel.range ? (
        <DepositRangeIndicator
          title={viewModel.range.title}
          lowerLabel={viewModel.range.lowerLabel}
          upperLabel={viewModel.range.upperLabel}
          stateLabel={viewModel.range.stateLabel}
          stateTone={viewModel.range.stateTone}
        />
      ) : null}

      <DepositValueChart
        chart={viewModel.valueChart}
        locale={input.locale}
        title={viewModel.valueChartCopy.title}
        gapTitle={viewModel.valueChartCopy.gapTitle}
        gapDescription={viewModel.valueChartCopy.gapDescription}
      />

      <DepositLifecycleTimeline
        events={viewModel.lifecycle.events}
        title={viewModel.lifecycle.title}
        emptyLabel={viewModel.lifecycle.emptyLabel}
        movementLabels={viewModel.lifecycle.movementLabels}
      />

      <DepositPerformanceDecomposition viewModel={viewModel.decomposition} />

      {viewModel.strategyCrossLink ? (
        <DepositStrategiesCrossLink
          title={viewModel.strategyCrossLink.title}
          description={viewModel.strategyCrossLink.description}
          actionLabel={viewModel.strategyCrossLink.actionLabel}
          strategyId={viewModel.strategyCrossLink.strategyId}
        />
      ) : null}

      <CabStack row gap="$2" flexWrap="wrap">
        {explorerUrl(deposit.tokenId) ? (
          <CabButton
            tone="warning"
            onPress={() => {
              window.open(explorerUrl(deposit.tokenId)!, "_blank", "noopener,noreferrer");
            }}
          >
            {viewModel.actions.viewInExplorerLabel}
          </CabButton>
        ) : null}
        {input.onClose ? (
          <CabButton tone="secondary" onPress={input.onClose}>
            {viewModel.actions.closeLabel}
          </CabButton>
        ) : null}
      </CabStack>
    </CabStack>
  );
}