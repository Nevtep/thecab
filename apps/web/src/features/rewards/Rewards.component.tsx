"use client";

import { useTranslation } from "react-i18next";

import { CabBox, CabErrorPanel, CabLoadingPanel, CabSectionHeader, CabStack } from "@/design-system";
import { RewardsEventsTable } from "@/features/rewards/components/RewardsEventsTable";
import { RewardsFiltersBar } from "@/features/rewards/components/RewardsFiltersBar";
import { RewardsKpiStrip } from "@/features/rewards/components/RewardsKpiStrip";
import { RewardsOverTimePanel } from "@/features/rewards/components/RewardsOverTimePanel";
import { RewardsPoolContributionBreakdown } from "@/features/rewards/components/RewardsPoolContributionBreakdown";
import { RewardsSourceBreakdown } from "@/features/rewards/components/RewardsSourceBreakdown";
import { RewardsTokenBreakdown } from "@/features/rewards/components/RewardsTokenBreakdown";
import { SelectedRewardRail } from "@/features/rewards/components/SelectedRewardRail";
import { RewardsEmptyState } from "@/features/rewards/components/RewardsEmptyState";
import type { RewardsKpi, RewardsUrlState, RewardsViewModel } from "@/features/rewards/rewards.types";
import { formatCompactUsd, formatDateTime, formatPercentPoints, formatTokenAmount, formatUsd } from "@/i18n/formatters";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

type RewardsComponentProps = {
  screenState: "loading" | "locked" | "error" | "empty" | "ready";
  viewModel: RewardsViewModel | null;
  urlState: RewardsUrlState;
  errorCode: string | null;
  onRetry: () => void;
  onStateChange: (state: RewardsUrlState) => void;
  onClearFilter: (target: string) => void;
  onClearAll: () => void;
  onOpenHref: (href: string) => void;
};

function formatCurrency(locale: string, value: string | number | null) {
  const parsed = typeof value === "number" ? value : value === null ? null : Number(value);
  if (parsed === null || !Number.isFinite(parsed)) return "";
  return formatUsd(parsed, locale);
}

function formatNumber(locale: string, value: string | number | null) {
  const parsed = typeof value === "number" ? value : value === null ? null : Number(value);
  if (parsed === null || !Number.isFinite(parsed)) return "";
  return formatTokenAmount(parsed, locale, { maximumFractionDigits: 4 });
}

function formatKpi(locale: string, kpi: RewardsKpi) {
  if (kpi.valueKind === "currency") return formatCurrency(locale, kpi.value);
  if (kpi.valueKind === "percent") return kpi.value === null ? "" : `${formatNumber(locale, kpi.value)}%`;
  return formatNumber(locale, kpi.value);
}

export function RewardsComponent(input: RewardsComponentProps) {
  const { i18n, t } = useTranslation(["rewards", "coverage", "common", "charts", "errors"]);

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("rewards:states.loadingTitle")} />;
  }

  if (input.screenState === "locked") {
    return (
      <RewardsEmptyState
        title={t("rewards:locked.title")}
        description={t("rewards:locked.description")}
      />
    );
  }

  if (input.screenState === "error") {
    return (
      <CabErrorPanel
        title={t("rewards:states.errorTitle")}
        description={t(`errors:rewards.${input.errorCode}`, { defaultValue: input.errorCode ?? "" })}
        retryLabel={t("rewards:actions.refresh")}
        onRetry={input.onRetry}
      />
    );
  }

  if (input.screenState === "empty" || !input.viewModel) {
    return (
      <RewardsEmptyState
        title={t("rewards:empty.noRewardsTitle")}
        description={t("rewards:empty.noRewardsDescription")}
      />
    );
  }

  const labels = {
    getLabel: (key: string) => t(key),
    getCoverage: (coverage: string) => t(`coverage:level.${coverage}`, { defaultValue: coverage }),
    getConfidence: (confidence: string) => t(`rewards:confidence.${confidence}`, { defaultValue: confidence }),
    getSource: (source: string) => t(`rewards:sources.${source}`, { defaultValue: source }),
  };

  function applyDistributionFilter(target: Record<string, unknown>) {
    input.onStateChange({
      ...input.urlState,
      source: typeof target.source === "string" ? target.source as RewardsUrlState["source"] : input.urlState.source,
      poolId: typeof target.poolId === "string" ? target.poolId : input.urlState.poolId,
      tokenAddress: typeof target.tokenAddress === "string" ? target.tokenAddress : input.urlState.tokenAddress,
      page: 1,
    });
  }

  return (
    <CabStack className={styles.workspace}>
      <CabSectionHeader title={t("rewards:title")} subtitle={t("rewards:subtitle")} />
      <RewardsKpiStrip
        kpis={input.viewModel.kpis}
        buckets={input.viewModel.overTime.buckets}
        labels={{
          getLabel: labels.getLabel,
          getCoverageLabel: labels.getCoverage,
          formatValue: (kpi) => formatKpi(i18n.language, kpi),
        }}
      />
      <RewardsFiltersBar
        state={input.urlState}
        viewModel={input.viewModel}
        labels={{
          searchPlaceholder: t("rewards:filters.searchPlaceholder"),
          source: t("rewards:filters.source"),
          token: t("rewards:filters.token"),
          pool: t("rewards:filters.pool"),
          rewardType: t("rewards:filters.rewardType"),
          coverage: t("rewards:filters.coverage"),
          rowsPerPage: t("common:rowsPerPage"),
          all: t("common:all"),
          clearAll: t("common:clearAll"),
          getDatePreset: (value) => t(`rewards:datePresets.${value}`, { defaultValue: value }),
          getSource: labels.getSource,
          getCoverage: labels.getCoverage,
        }}
        onStateChange={input.onStateChange}
        onClearFilter={input.onClearFilter}
        onClearAll={input.onClearAll}
      />
      <CabBox className={styles.dataView}>
        <CabStack className={styles.leftArea}>
          <RewardsOverTimePanel
            viewModel={input.viewModel}
            labels={{
              title: t("rewards:panels.rewardsOverTime"),
              coverage: t("charts:coveragePercent"),
              partial: t("charts:partialValuesNote"),
              chart: t("rewards:actions.chartEmphasis"),
              table: t("rewards:actions.tableEmphasis"),
              formatUsd: (value) => formatCompactUsd(value, i18n.language),
              formatPercent: (value) => formatPercentPoints(value, i18n.language),
              formatCount: (value) => formatTokenAmount(value, i18n.language, { maximumFractionDigits: 0 }),
            }}
          />
          <CabBox className={styles.breakdowns}>
            <RewardsSourceBreakdown
              title={t("rewards:panels.sourceBreakdown")}
              valueLabel={t("rewards:labels.valueUsd")}
              getLabel={labels.getLabel}
              distribution={input.viewModel.distributions.source}
              formatUsd={(value) => formatCompactUsd(value, i18n.language)}
              activeFilter={{
                source: input.urlState.source,
                poolId: input.urlState.poolId,
                tokenAddress: input.urlState.tokenAddress,
              }}
              onOpenFilter={applyDistributionFilter}
            />
            <RewardsPoolContributionBreakdown
              title={t("rewards:panels.poolContributionBreakdown")}
              valueLabel={t("rewards:labels.valueUsd")}
              getLabel={labels.getLabel}
              distribution={input.viewModel.distributions.pool}
              formatUsd={(value) => formatCompactUsd(value, i18n.language)}
              activeFilter={{
                source: input.urlState.source,
                poolId: input.urlState.poolId,
                tokenAddress: input.urlState.tokenAddress,
              }}
              onOpenFilter={applyDistributionFilter}
            />
            <RewardsTokenBreakdown
              title={t("rewards:panels.tokenBreakdown")}
              valueLabel={t("rewards:labels.valueUsd")}
              getLabel={labels.getLabel}
              distribution={input.viewModel.distributions.token}
              formatUsd={(value) => formatCompactUsd(value, i18n.language)}
              activeFilter={{
                source: input.urlState.source,
                poolId: input.urlState.poolId,
                tokenAddress: input.urlState.tokenAddress,
              }}
              onOpenFilter={applyDistributionFilter}
            />
          </CabBox>
          <RewardsEventsTable
            viewModel={input.viewModel}
            state={input.urlState}
            labels={{
              title: t("rewards:panels.rewardEvents"),
              date: t("rewards:table.columns.dateTime"),
              token: t("rewards:table.columns.token"),
              amount: t("rewards:table.columns.amount"),
              value: t("rewards:table.columns.valueAtClaim"),
              owner: t("rewards:table.columns.ownerSource"),
              linkedEntity: t("rewards:table.columns.linkedEntity"),
              pool: t("rewards:table.columns.pool"),
              rewardType: t("rewards:table.columns.rewardType"),
              poolContribution: t("rewards:table.columns.poolContribution"),
              coverage: t("rewards:table.columns.coverage"),
              confidence: t("rewards:table.columns.confidence"),
              tx: t("rewards:table.columns.tx"),
              previous: t("common:previous"),
              next: t("common:next"),
              showing: (from, to, total) => t("common:showingRange", { from, to, total }),
              emptyTitle: t("rewards:empty.filteredTitle"),
              emptyDescription: t("rewards:empty.filteredDescription"),
              formatDateTime: (value) => formatDateTime(value, i18n.language),
              getCoverage: labels.getCoverage,
              getConfidence: labels.getConfidence,
              getSource: labels.getSource,
            }}
            onStateChange={input.onStateChange}
          />
        </CabStack>
        <SelectedRewardRail
          selectedReward={input.viewModel.selectedReward}
          labels={{
            title: t("rewards:panels.selectedReward"),
            amount: t("rewards:selected.amount"),
            value: t("rewards:selected.value"),
            owner: t("rewards:selected.owner"),
            coverage: t("rewards:selected.coverage"),
            confidence: t("rewards:selected.confidence"),
            empty: t("rewards:selected.empty"),
            getCoverage: labels.getCoverage,
            getConfidence: labels.getConfidence,
            getSource: labels.getSource,
            ownershipTrace: t("rewards:panels.ownershipTrace"),
            poolContribution: t("rewards:panels.poolContribution"),
            claimDetails: t("rewards:panels.claimDetails"),
            coverageNotes: t("rewards:panels.coverageNotes"),
            unresolvedExcluded: t("rewards:panels.unresolvedExcludedActivity"),
            linkedEntity: t("rewards:ownershipTrace.linkedEntity"),
            sourceSurface: t("rewards:ownershipTrace.sourceSurface"),
            evidence: t("rewards:ownershipTrace.evidence"),
            status: t("rewards:selected.status"),
            pool: t("rewards:selected.pool"),
            countingRule: t("rewards:selected.countingRule"),
            txHash: t("rewards:claimDetails.txHash"),
            claimTime: t("rewards:claimDetails.claimTime"),
            rewardType: t("rewards:claimDetails.rewardType"),
            openTx: t("rewards:claimDetails.openTx"),
            reason: t("rewards:coverageNotes.reason"),
            formatDateTime: (value: string) => formatDateTime(value, i18n.language),
          }}
        />
      </CabBox>
    </CabStack>
  );
}
