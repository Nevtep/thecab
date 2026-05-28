"use client";

import { useTranslation } from "react-i18next";

import {
  CabCard,
  CabCoverageBadge,
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
import { getDepositConfidenceLabelKey, getDepositCoverageLabelKey } from "@/features/deposits/deposits.mappers";
import { formatDayRange, formatPercent, formatUsd } from "@/i18n/formatters";

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
  const coveredRange = deposit.coveredStartDayUtc && deposit.coveredEndDayUtc
    ? (formatDayRange(deposit.coveredStartDayUtc, deposit.coveredEndDayUtc, input.locale) ?? "—")
    : "—";

  return (
    <CabStack gap="$4">
      <DepositDetailHeader
        title={deposit.positionLabel}
        subtitle={deposit.poolLabel}
        statusLabel={label(`status.${deposit.status}`, deposit.status)}
        tokenIdLabel={deposit.tokenId ? `#${deposit.tokenId}` : null}
        explorerUrl={explorerUrl(deposit.tokenId)}
        viewInExplorerLabel={label("detail.viewInExplorer", "View in explorer")}
        closeLabel={label("detail.close", "Close")}
        onClose={input.onClose}
      />

      <CabStack row gap="$3" flexWrap="wrap">
        <CabImpactMetricCard
          label={label("detail.currentValue", "Current value")}
          value={formatUsd(deposit.currentValueUsd, input.locale)}
          iconName="dashboard"
          accentColor={cabColors.brand.electricBlue}
          size="compact"
        />
        <CabImpactMetricCard
          label={label("detail.totalReturn", "Total return")}
          value={formatUsd(deposit.totalReturnUsd, input.locale)}
          meta={deposit.totalReturnPct === null ? null : formatPercent(deposit.totalReturnPct, input.locale)}
          iconName="activity"
          accentColor={cabColors.brandExtended.signalTealRaw}
          size="compact"
        />
      </CabStack>

      <CabCard density="spacious">
        <CabStack gap="$2">
          <CabText variant="label">{t("detail.secondary.title", { defaultValue: "Secondary stats" })}</CabText>
          <CabStack row gap="$3" flexWrap="wrap">
            <CabText variant="caption">{t("detail.secondary.estApr", { defaultValue: "Est. APR" })}: {deposit.estimatedAnnualizedReturnPct === null ? "—" : formatPercent(deposit.estimatedAnnualizedReturnPct, input.locale)}</CabText>
            <CabText variant="caption">{t("detail.secondary.totalRewards", { defaultValue: "Total rewards" })}: {formatUsd(deposit.totalRewardsUsd, input.locale)}</CabText>
            <CabText variant="caption">{t("detail.secondary.realizedPnl", { defaultValue: "Realized PnL" })}: {formatUsd(deposit.realizedPnlUsd, input.locale)}</CabText>
            <CabText variant="caption">{t("detail.secondary.unrealizedPnl", { defaultValue: "Unrealized PnL" })}: {formatUsd(deposit.unrealizedPnlUsd, input.locale)}</CabText>
            <CabCoverageBadge
              state={deposit.coverageStatus}
              label={t(getDepositCoverageLabelKey(deposit.coverageStatus), { defaultValue: deposit.coverageStatus })}
            />
            <CabText variant="caption">
              {t("list.columns.confidence")}: {t(getDepositConfidenceLabelKey(deposit.confidence), { defaultValue: deposit.confidence })}
            </CabText>
          </CabStack>
        </CabStack>
      </CabCard>

      <DepositCoveredRangeNote
        title={label("detail.coveredRange.title", "Covered range")}
        value={coveredRange}
      />

      {deposit.poolKind === "cl" ? (
        <DepositRangeIndicator
          title={label("detail.range.title", "Range")}
          lowerLabel={`${label("detail.range.lower", "Lower")}: ${deposit.rangeLowerPrice === null ? "—" : formatUsd(deposit.rangeLowerPrice, input.locale)}`}
          upperLabel={`${label("detail.range.upper", "Upper")}: ${deposit.rangeUpperPrice === null ? "—" : formatUsd(deposit.rangeUpperPrice, input.locale)}`}
          stateLabel={deposit.isInRange === null
            ? label("detail.range.unavailable", "Unavailable")
            : deposit.isInRange
              ? label("detail.range.inRange", "In range")
              : label("detail.range.outOfRange", "Out of range")}
          stateTone={deposit.isInRange === null ? "neutral" : deposit.isInRange ? "success" : "warning"}
        />
      ) : null}

      <DepositValueChart
        chart={input.response.valueChart}
        locale={input.locale}
        title={label("detail.valueChart.title", "Value chart")}
        gapTitle={label("detail.valueChart.gapTitle", "Partial coverage")}
        gapDescription={label("detail.valueChart.gapDescription", "The chart breaks across uncovered windows instead of interpolating missing values.")}
      />

      <DepositLifecycleTimeline
        events={deposit.lifecycle}
        locale={input.locale}
        title={label("detail.timeline.title", "Lifecycle")}
        emptyLabel={label("detail.timeline.empty", "No lifecycle events were materialized for this deposit yet.")}
        movementLabels={{
          token: label("detail.movements.token", "Token"),
          direction: label("detail.movements.direction", "Direction"),
          amount: label("detail.movements.amount", "Amount"),
          usdValue: label("detail.movements.usdValue", "USD at event"),
          priceSource: label("detail.movements.priceSource", "Price source"),
          priceSourceValues: {
            event: label("detail.movements.priceSourceValues.event", "Event price"),
            pricePointFallback: label("detail.movements.priceSourceValues.pricePointFallback", "Price fallback"),
            unavailable: label("detail.movements.priceSourceValues.unavailable", "Unavailable"),
          },
        }}
      />

      <DepositPerformanceDecomposition
        decomposition={deposit.decomposition}
        capitalEnteredUsd={deposit.capitalEnteredUsd}
        capitalWithdrawnUsd={deposit.capitalWithdrawnUsd}
        estimatedAnnualizedReturnPct={deposit.estimatedAnnualizedReturnPct}
        locale={input.locale}
        labels={{
          title: label("detail.decomposition.title", "Performance decomposition"),
          totalReturn: label("detail.decomposition.totalReturn", "Total return"),
          estAnnualizedReturn: label("detail.decomposition.estAnnualizedReturn", "Est. annualized return"),
          capitalEntered: label("detail.decomposition.flow.entered", "Capital entered"),
          capitalWithdrawn: label("detail.decomposition.flow.withdrawn", "Capital withdrawn"),
          components: {
            rewardsUsd: label("detail.decomposition.components.rewards", "Rewards"),
            feesUsd: label("detail.decomposition.components.fees", "Fees"),
            assetPriceEffectUsd: label("detail.decomposition.components.assetPriceEffect", "Asset price effect"),
            rebalanceEffectUsd: label("detail.decomposition.components.rebalanceEffect", "Rebalance / IL effect"),
            realizedPnlUsd: label("detail.decomposition.components.realizedPnl", "Realized PnL"),
            unrealizedPnlUsd: label("detail.decomposition.components.unrealizedPnl", "Unrealized PnL"),
            unattributedUsd: label("detail.decomposition.components.unattributed", "Unattributed"),
          },
        }}
      />

      {deposit.mellowStrategyCrossLinkId ? (
        <DepositStrategiesCrossLink
          title={label("strategiesCrossLink.label", "Related strategy")}
          description={label("strategiesCrossLink.placeholder", "Strategies routing is not live yet. This placeholder preserves the target strategy id.")}
          actionLabel={label("strategiesCrossLink.available", "Open strategy")}
          strategyId={deposit.mellowStrategyCrossLinkId}
        />
      ) : null}
    </CabStack>
  );
}