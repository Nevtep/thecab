"use client";

import { useRouter } from "next/navigation";

import { CabBadge, CabButton, CabCard, CabStack, CabText } from "@/design-system";
import { buildStrategyRewardsHref } from "@/features/rewards/rewards.navigation";
import { StrategyCoverageNote } from "@/features/strategies/components/StrategyCoverageNote";
import { StrategyExposureSummary } from "@/features/strategies/components/StrategyExposureSummary";
import { StrategyLifecycleTimeline } from "@/features/strategies/components/StrategyLifecycleTimeline";
import { StrategyRewardsTable } from "@/features/strategies/components/StrategyRewardsTable";
import type { StrategyDetailView } from "@/features/strategies/strategies.types";
import { formatUsd } from "@/i18n/formatters";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategySelectedPanelProps = {
  chainId: number;
  locale: string;
  strategy: StrategyDetailView | null;
  labels: {
    exposureSummary: string;
    rewards: string;
    lifecycle: string;
    coverageNote: string;
    currentValue: string;
    shares: string;
    totalReturn: string;
    deposited: string;
    withdrawn: string;
    sharesReceived: string;
    sharesRedeemed: string;
    rewardsEmpty: string;
    rewardToken: string;
    rewardAmount: string;
    rewardValue: string;
    rewardClaimedAt: string;
    transaction: string;
    status: string;
    resolved: string;
    unresolved: string;
    lifecycleEmpty: string;
    openPool: string;
    openRewards?: string;
  };
  onOpenPool?: (poolId: string) => void;
  translate: (key: string, options?: { defaultValue?: string }) => string;
};

function formatNullableUsd(value: number | null, locale: string) {
  if (value === null) return "—";
  return formatUsd(value, locale);
}

export function StrategySelectedPanel({ chainId, locale, onOpenPool, strategy, labels, translate }: StrategySelectedPanelProps) {
  const router = useRouter();
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
              <CabText variant="label">{formatNullableUsd(strategy.currentEstimatedValueUsd, locale)}</CabText>
            </div>
            <div>
              <CabText variant="caption">{labels.shares}</CabText>
              <CabText variant="label">{strategy.currentSharesRaw} {strategy.shareSymbol ?? ""}</CabText>
            </div>
            <div>
              <CabText variant="caption">{labels.totalReturn}</CabText>
              <CabText variant="label">{formatNullableUsd(strategy.totalReturnUsd, locale)}</CabText>
            </div>
            <CabBadge size="sm" tone={strategy.coverageStatus === "full" ? "success" : "warning"}>
              {translate(`coverage:level.${strategy.coverageStatus}`)}
            </CabBadge>
            <CabBadge size="sm" tone={strategy.confidence === "high" ? "success" : "warning"}>
              {translate(`coverage:confidence.${strategy.confidence}`)}
            </CabBadge>
          </div>
          {strategy.primaryPoolId && onOpenPool ? (
            <CabButton tone="secondary" controlSize="sm" onPress={() => onOpenPool(strategy.primaryPoolId!)}>
              {labels.openPool}
            </CabButton>
          ) : null}
          {labels.openRewards ? (
            <CabButton tone="technical" controlSize="sm" onPress={() => router.push(buildStrategyRewardsHref(strategy.strategyExposureId))}>
              {labels.openRewards}
            </CabButton>
          ) : null}
        </CabStack>
      </CabCard>
      <StrategyExposureSummary
        strategy={strategy}
        locale={locale}
        labels={{
          title: labels.exposureSummary,
          deposited: labels.deposited,
          withdrawn: labels.withdrawn,
          sharesReceived: labels.sharesReceived,
          sharesRedeemed: labels.sharesRedeemed,
          currentShares: labels.shares,
          currentValue: labels.currentValue,
        }}
      />
      <StrategyRewardsTable
        chainId={chainId}
        locale={locale}
        rewards={strategy.rewards}
        labels={{
          title: labels.rewards,
          empty: labels.rewardsEmpty,
          token: labels.rewardToken,
          amount: labels.rewardAmount,
          value: labels.rewardValue,
          claimedAt: labels.rewardClaimedAt,
          transaction: labels.transaction,
          status: labels.status,
          resolved: labels.resolved,
          unresolved: labels.unresolved,
        }}
      />
      <StrategyLifecycleTimeline
        chainId={chainId}
        locale={locale}
        events={strategy.lifecycle}
        labels={{
          title: labels.lifecycle,
          empty: labels.lifecycleEmpty,
          transaction: labels.transaction,
          value: labels.rewardValue,
          shares: labels.shares,
        }}
        translate={translate}
      />
      <StrategyCoverageNote
        note={strategy.coverageNote}
        label={labels.coverageNote}
        translate={translate}
      />
    </CabStack>
  );
}
