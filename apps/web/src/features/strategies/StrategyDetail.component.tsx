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
import { StrategyCoverageNote } from "@/features/strategies/components/StrategyCoverageNote";
import { StrategyExposureSummary } from "@/features/strategies/components/StrategyExposureSummary";
import { StrategyLifecycleTimeline } from "@/features/strategies/components/StrategyLifecycleTimeline";
import { StrategyRewardsTable } from "@/features/strategies/components/StrategyRewardsTable";
import { mapStrategyDetailResponseToViewModel } from "@/features/strategies/strategies.mappers";
import type { StrategyDetailResponse } from "@/features/strategies/strategies.types";

type StrategyDetailComponentProps = {
  screenState: "loading" | "error" | "empty" | "ready";
  response: StrategyDetailResponse | null;
  errorCode: string | null;
  locale: string;
  onRetry: () => void;
  onClose?: () => void;
};

export function StrategyDetailComponent(input: StrategyDetailComponentProps) {
  const { t } = useTranslation(["strategies", "coverage", "errors"]);

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("strategies:states.loadingTitle")} />;
  }

  if (input.screenState === "error") {
    return (
      <CabErrorPanel
        title={t("strategies:detail.errorTitle")}
        description={t(`errors:strategies.${input.errorCode}`, { defaultValue: input.errorCode ?? "" })}
        retryLabel={t("strategies:actions.refresh")}
        onRetry={input.onRetry}
      />
    );
  }

  if (input.screenState === "empty" || !input.response) {
    return (
      <CabEmptyState
        title={t("strategies:detail.emptyTitle")}
        description={t("strategies:detail.emptyDescription")}
      />
    );
  }

  const viewModel = mapStrategyDetailResponseToViewModel(input.response, input.locale);
  const { strategy } = viewModel;

  return (
    <CabStack gap="$4">
      <CabCard density="compact">
        <CabStack gap="$2">
          <CabStack row gap="$2" alignItems="center" flexWrap="wrap">
            <CabText variant="heading">{strategy.strategyLabel}</CabText>
            <CabBadge tone="info" size="sm">{t("strategies:filterValues.mellow")}</CabBadge>
            <CabBadge tone={strategy.coverageStatus === "full" ? "success" : "warning"} size="sm">
              {t(`coverage:level.${strategy.coverageStatus}`)}
            </CabBadge>
          </CabStack>
          <CabText variant="caption">{strategy.poolLabel ?? t("strategies:detail.poolUnavailable")}</CabText>
          <CabStack row gap="$3" flexWrap="wrap">
            <CabImpactMetricCard
              label={t("strategies:detail.currentValue")}
              value={viewModel.formattedHeader.currentValue}
              accentColor={cabColors.brand.signalTeal}
              iconName="coins"
              size="compact"
            />
            <CabImpactMetricCard
              label={t("strategies:detail.totalReturn")}
              value={viewModel.formattedHeader.totalReturn}
              accentColor={cabColors.brand.cabGold}
              iconName="activity"
              size="compact"
            />
            <CabImpactMetricCard
              label={t("strategies:detail.rewards")}
              value={viewModel.formattedHeader.rewards}
              accentColor={cabColors.semantic.info}
              iconName="rewards"
              size="compact"
            />
          </CabStack>
        </CabStack>
      </CabCard>

      <StrategyExposureSummary
        strategy={strategy}
        locale={input.locale}
        labels={{
          title: t("strategies:detail.exposureSummary"),
          deposited: t("strategies:detail.deposited"),
          withdrawn: t("strategies:detail.withdrawn"),
          sharesReceived: t("strategies:detail.sharesReceived"),
          sharesRedeemed: t("strategies:detail.sharesRedeemed"),
          currentShares: t("strategies:detail.currentShares"),
          currentValue: t("strategies:detail.currentValue"),
        }}
      />
      <StrategyRewardsTable
        chainId={viewModel.chainId}
        locale={input.locale}
        rewards={strategy.rewards}
        labels={{
          title: t("strategies:detail.rewards"),
          empty: t("strategies:detail.rewardsEmpty"),
          token: t("strategies:detail.rewardColumns.token"),
          amount: t("strategies:detail.rewardColumns.amount"),
          value: t("strategies:detail.rewardColumns.value"),
          claimedAt: t("strategies:detail.rewardColumns.claimedAt"),
          transaction: t("strategies:detail.transaction"),
          status: t("strategies:detail.status"),
          resolved: t("strategies:detail.resolution.resolved"),
          unresolved: t("strategies:detail.resolution.unresolved"),
          openRewards: t("navigation:items.rewards"),
        }}
      />
      <StrategyLifecycleTimeline
        chainId={viewModel.chainId}
        locale={input.locale}
        events={strategy.lifecycle}
        labels={{
          title: t("strategies:detail.lifecycle"),
          empty: t("strategies:detail.lifecycleEmpty"),
          transaction: t("strategies:detail.transaction"),
          value: t("strategies:detail.rewardColumns.value"),
          shares: t("strategies:detail.currentShares"),
        }}
        translate={(key, options) => t(key, options)}
      />
      <StrategyCoverageNote
        note={viewModel.coverageNoteView}
        label={t("strategies:detail.coverageNote")}
        translate={(key, options) => t(key, options)}
      />
      {input.onClose ? (
        <CabButton tone="secondary" onPress={input.onClose}>
          {t("strategies:actions.backToStrategies")}
        </CabButton>
      ) : null}
    </CabStack>
  );
}
