"use client";

import { useTranslation } from "react-i18next";

import { CabBox, CabButton, CabErrorPanel, CabIcon, CabLoadingPanel, CabSectionHeader, CabStack, CabText } from "@/design-system";
import { GovernanceEmptyState } from "@/features/governance/components/GovernanceEmptyState";
import { GovernanceEpochTimeline } from "@/features/governance/components/GovernanceEpochTimeline";
import { GovernanceFiltersBar } from "@/features/governance/components/GovernanceFiltersBar";
import { GovernanceKpiStrip } from "@/features/governance/components/GovernanceKpiStrip";
import { GovernanceLockPanel } from "@/features/governance/components/GovernanceLockPanel";
import { GovernanceRewardBreakdown } from "@/features/governance/components/GovernanceRewardBreakdown";
import { GovernanceRewardsTable } from "@/features/governance/components/GovernanceRewardsTable";
import { SelectedGovernanceRail } from "@/features/governance/components/SelectedGovernanceRail";
import type { GovernanceUrlState, GovernanceViewModel } from "@/features/governance/governance.types";
import { formatDateTime, formatPercentPoints, formatTokenAmount, formatUsd } from "@/i18n/formatters";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type Props = {
  screenState: "loading" | "locked" | "error" | "empty" | "ready";
  viewModel: GovernanceViewModel | null;
  urlState: GovernanceUrlState;
  errorCode: string | null;
  isRefreshing?: boolean;
  onRetry: () => void;
  onStateChange: (state: GovernanceUrlState) => void;
  onClearFilter: (target: string) => void;
  onClearAll: () => void;
  onOpenHref: (href: string) => void;
};

function parseNumeric(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmount(value: string | null | undefined, locale: string, maximumFractionDigits = 4) {
  const parsed = parseNumeric(value);
  return parsed === null ? "n/a" : formatTokenAmount(parsed, locale, { maximumFractionDigits });
}

function formatCurrency(value: string | null | undefined, locale: string) {
  const parsed = parseNumeric(value);
  return parsed === null ? "n/a" : formatUsd(parsed, locale);
}

function formatDate(value: string | null | undefined, locale: string) {
  return value ? formatDateTime(value, locale) : "n/a";
}

function formatKpiValue(viewModel: GovernanceViewModel, id: keyof GovernanceViewModel["summary"] | "coverage", locale: string) {
  if (id === "coverage") {
    return viewModel.summary.overallCoverage.coverageState;
  }
  if (id === "lockExpiry") {
    const days = viewModel.summary.lockExpiry.remainingDays;
    return days === null ? "n/a" : formatTokenAmount(days, locale, { maximumFractionDigits: 0 });
  }
  if (id === "governanceRewardsClaimedUsd") {
    return formatCurrency(viewModel.summary.governanceRewardsClaimedUsd.valueUsd, locale);
  }
  if (id === "estimatedGovernanceReturn") {
    const value = parseNumeric(viewModel.summary.estimatedGovernanceReturn.value);
    return value === null ? "n/a" : formatPercentPoints(value, locale);
  }
  if (id === "lockedAero") return formatAmount(viewModel.summary.lockedAero.value, locale, 2);
  if (id === "veAeroExposure") return formatAmount(viewModel.summary.veAeroExposure.value, locale, 2);
  return "n/a";
}

function kpiMeta(viewModel: GovernanceViewModel, id: keyof GovernanceViewModel["summary"] | "coverage", locale: string) {
  if (id === "lockedAero") return formatCurrency(viewModel.summary.lockedAero.valueUsd, locale);
  if (id === "lockExpiry") return viewModel.summary.lockExpiry.expiresAt ? formatDate(viewModel.summary.lockExpiry.expiresAt, locale) : null;
  if (id === "coverage") return viewModel.summary.overallCoverage.confidence;
  if (id === "estimatedGovernanceReturn") return viewModel.summary.estimatedGovernanceReturn.reasonCodes[0] ?? null;
  return null;
}

export function GovernanceComponent(input: Props) {
  const { i18n, t } = useTranslation(["governance", "coverage", "common", "errors"]);

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("governance:states.loading")} />;
  }

  if (input.screenState === "locked") {
    return (
      <CabStack className={styles.workspace}>
        <CabSectionHeader title={t("governance:title")} subtitle={t("governance:subtitle")} />
        <GovernanceEmptyState
          title={t("governance:locked.title")}
          description={t("governance:locked.description")}
          tone="locked"
        />
      </CabStack>
    );
  }

  if (input.screenState === "error") {
    return (
      <CabErrorPanel
        title={t("governance:states.errorTitle")}
        description={t(`errors:governance.${input.errorCode}`, { defaultValue: input.errorCode ?? "" })}
        retryLabel={t("governance:actions.refresh")}
        onRetry={input.onRetry}
      />
    );
  }

  if (!input.viewModel) {
    return (
      <CabStack className={styles.workspace}>
        <CabSectionHeader title={t("governance:title")} subtitle={t("governance:subtitle")} />
        <GovernanceFiltersBar
          state={input.urlState}
          viewModel={input.viewModel}
          labels={{
            searchPlaceholder: t("governance:filters.searchPlaceholder"),
            datePreset: t("governance:filters.datePreset"),
            eventType: t("governance:filters.eventType"),
            rewardType: t("governance:filters.rewardType"),
            protocolSurface: t("governance:filters.protocolSurface"),
            epoch: t("governance:filters.epoch"),
            token: t("governance:filters.token"),
            coverage: t("governance:filters.coverage"),
            confidence: t("governance:filters.confidence"),
            all: t("common:all"),
            clearAll: t("common:clearAll"),
            getDatePreset: (value) => t(`governance:datePresets.${value}`, { defaultValue: value }),
            getEvent: (value) => t(`governance:events.${value}`, { defaultValue: value }),
            getRewardType: (value) => t(`governance:rewards.${value}`, { defaultValue: value }),
            getSurface: (value) => t(`governance:surfaces.${value}`, { defaultValue: value }),
            getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
            getConfidence: (value) => t(`governance:confidence.${value}`, { defaultValue: value }),
          }}
          onStateChange={input.onStateChange}
          onClearFilter={input.onClearFilter}
          onClearAll={input.onClearAll}
        />
        <GovernanceEmptyState
          title={t("governance:empty.title")}
          description={t("governance:empty.description")}
        />
      </CabStack>
    );
  }

  const selectedDetailIsLoading = Boolean(
    input.isRefreshing &&
    input.urlState.selectedGovernanceId &&
    input.viewModel.selectedDetail.selectionId !== input.urlState.selectedGovernanceId,
  );

  return (
    <CabStack className={styles.workspace}>
      <CabSectionHeader
        title={t("governance:title")}
        subtitle={t("governance:subtitle")}
        actions={
          <CabButton tone="ghost" controlSize="sm" onPress={input.onRetry}>
            <CabIcon name="refreshCcw" width={14} height={14} />
            <CabText variant="caption" fontSize={12}>{t("governance:actions.refresh")}</CabText>
          </CabButton>
        }
      />

      <GovernanceKpiStrip
        summary={input.viewModel.summary}
        labels={{
          getLabel: (key) => t(key),
          formatValue: (id) => formatKpiValue(input.viewModel!, id, i18n.language),
          getMeta: (id) => kpiMeta(input.viewModel!, id, i18n.language),
        }}
      />

      <GovernanceFiltersBar
        state={input.urlState}
        viewModel={input.viewModel}
        labels={{
          searchPlaceholder: t("governance:filters.searchPlaceholder"),
          datePreset: t("governance:filters.datePreset"),
          eventType: t("governance:filters.eventType"),
          rewardType: t("governance:filters.rewardType"),
          protocolSurface: t("governance:filters.protocolSurface"),
          epoch: t("governance:filters.epoch"),
          token: t("governance:filters.token"),
          coverage: t("governance:filters.coverage"),
          confidence: t("governance:filters.confidence"),
          all: t("common:all"),
          clearAll: t("common:clearAll"),
          getDatePreset: (value) => t(`governance:datePresets.${value}`, { defaultValue: value }),
          getEvent: (value) => t(`governance:events.${value}`, { defaultValue: value }),
          getRewardType: (value) => t(`governance:rewards.${value}`, { defaultValue: value }),
          getSurface: (value) => t(`governance:surfaces.${value}`, { defaultValue: value }),
          getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
          getConfidence: (value) => t(`governance:confidence.${value}`, { defaultValue: value }),
        }}
        onStateChange={input.onStateChange}
        onClearFilter={input.onClearFilter}
        onClearAll={input.onClearAll}
      />

      {input.screenState === "empty" ? (
        <GovernanceEmptyState
          title={input.viewModel.filters.activeChips.length > 0 ? t("governance:empty.filteredTitle") : t("governance:empty.title")}
          description={input.viewModel.filters.activeChips.length > 0 ? t("governance:empty.filteredDescription") : t("governance:empty.description")}
        />
      ) : null}

      <CabBox className={styles.dataView}>
        <CabStack className={styles.leftArea}>
          <div className={styles.panelGrid}>
            <GovernanceLockPanel
              lockPanel={input.viewModel.lockPanel}
              labels={{
                title: t("governance:panels.lock"),
                empty: t("governance:lock.empty"),
                status: t("governance:lock.status"),
                lockId: t("governance:lock.lockId"),
                createdAt: t("governance:lock.createdAt"),
                expiresAt: t("governance:lock.expiresAt"),
                lockedAero: t("governance:lock.lockedAero"),
                veAero: t("governance:lock.veAero"),
                coverage: t("governance:lock.coverage"),
                confidence: t("governance:lock.confidence"),
                lifecycle: t("governance:lock.lifecycle"),
                noLifecycle: t("governance:lock.noLifecycle"),
                getStatus: (value) => t(`governance:lock.statuses.${value}`, { defaultValue: value }),
                getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
                getConfidence: (value) => t(`governance:confidence.${value}`, { defaultValue: value }),
                getEvent: (value) => t(`governance:events.${value}`, { defaultValue: value }),
                formatDateTime: (value) => formatDate(value, i18n.language),
                formatAmount: (value) => formatAmount(value, i18n.language, 2),
                formatUsd: (value) => formatCurrency(value, i18n.language),
              }}
            />
            <GovernanceEpochTimeline
              epochs={input.viewModel.epochTimeline.epochs}
              labels={{
                title: t("governance:panels.timeline"),
                empty: t("governance:timeline.empty"),
                votedPools: t("governance:timeline.votedPools"),
                voteMode: t("governance:timeline.voteMode"),
                rewardState: t("governance:timeline.rewardState"),
                resetState: t("governance:timeline.resetState"),
                fees: t("governance:rewards.fee"),
                bribes: t("governance:rewards.bribe"),
                rebases: t("governance:rewards.rebase"),
                getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
                getVoteMode: (value) => t(`governance:timeline.voteModes.${value}`, { defaultValue: value }),
                getRewardState: (value) => t(`governance:timeline.rewardStates.${value}`, { defaultValue: value }),
                getResetState: (value) => t(`governance:timeline.resetStates.${value}`, { defaultValue: value }),
                formatUsd: (value) => formatCurrency(value, i18n.language),
              }}
            />
          </div>

          <GovernanceRewardsTable
            viewModel={input.viewModel}
            state={input.urlState}
            loading={input.isRefreshing}
            labels={{
              title: t("governance:panels.rewards"),
              date: t("governance:table.date"),
              rewardType: t("governance:table.rewardType"),
              token: t("governance:table.token"),
              amount: t("governance:table.amount"),
              value: t("governance:table.value"),
              epoch: t("governance:table.epoch"),
              pool: t("governance:table.pool"),
              coverage: t("governance:table.coverage"),
              confidence: t("governance:table.confidence"),
              previous: t("common:previous"),
              next: t("common:next"),
              page: (page, totalPages) => t("common:pageIndicator", { page, totalPages }),
              rowsPerPage: t("common:rowsPerPage"),
              showing: (from, to, total) => t("common:showingRange", { from, to, total }),
              emptyTitle: t("governance:empty.rewardsTitle"),
              emptyDescription: t("governance:empty.rewardsDescription"),
              getRewardType: (value) => t(`governance:rewards.${value}`, { defaultValue: value }),
              getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
              getConfidence: (value) => t(`governance:confidence.${value}`, { defaultValue: value }),
              formatDateTime: (value) => formatDate(value, i18n.language),
              formatAmount: (value) => formatAmount(value, i18n.language, 6),
              formatUsd: (value) => formatCurrency(value, i18n.language),
            }}
            onStateChange={input.onStateChange}
          />

          <GovernanceRewardBreakdown
            breakdown={input.viewModel.rewardBreakdown}
            labels={{
              title: t("governance:panels.breakdown"),
              subtitle: t("governance:breakdown.subtitle"),
              empty: t("governance:breakdown.empty"),
              total: t("governance:breakdown.total"),
              getRewardType: (value) => t(`governance:rewards.${value}`, { defaultValue: value }),
              formatUsd: (value) => formatCurrency(value, i18n.language),
              formatPercent: (value) => value ? `${formatAmount(value, i18n.language, 1)}%` : "n/a",
            }}
          />
        </CabStack>

        <SelectedGovernanceRail
          selectedDetail={input.viewModel.selectedDetail}
          chainId={input.viewModel.chainId}
          loading={selectedDetailIsLoading}
          labels={{
            title: t("governance:detail.title"),
            empty: t("governance:detail.empty"),
            loading: t("governance:detail.loading"),
            actionSummary: t("governance:detail.actionSummary"),
            transaction: t("governance:detail.transaction"),
            protocolSurface: t("governance:detail.protocolSurface"),
            tokenMovements: t("governance:detail.tokenMovements"),
            valueEffect: t("governance:detail.valueEffect"),
            epochContext: t("governance:detail.epochContext"),
            poolContext: t("governance:detail.poolContext"),
            classificationEvidence: t("governance:detail.classificationEvidence"),
            linkedContexts: t("governance:detail.linkedContexts"),
            coverageNotes: t("governance:detail.coverageNotes"),
            evidenceSources: t("governance:detail.evidenceSources"),
            txHash: t("governance:detail.txHash"),
            occurredAt: t("governance:detail.occurredAt"),
            coverage: t("governance:detail.coverage"),
            confidence: t("governance:detail.confidence"),
            affectsTotals: t("governance:detail.affectsTotals"),
            reasonCodes: t("governance:detail.reasonCodes"),
            noMovements: t("governance:detail.noMovements"),
            noLinkedContexts: t("governance:detail.noLinkedContexts"),
            noEvidenceSources: t("governance:detail.noEvidenceSources"),
            amount: t("governance:detail.amount"),
            valueUsd: t("governance:detail.valueUsd"),
            open: t("common:openExternalLink"),
            yes: t("common:yes"),
            no: t("common:no"),
            getActionLabel: (key) => t(key, { defaultValue: key }),
            getSurface: (value) => t(`governance:surfaces.${value}`, { defaultValue: value }),
            getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
            getConfidence: (value) => t(`governance:confidence.${value}`, { defaultValue: value }),
            getReason: (value) => t(value, { defaultValue: t(`coverage:reasons.${value}`, { defaultValue: value }) }),
            formatDateTime: (value) => formatDate(value, i18n.language),
            formatUsd: (value) => formatCurrency(value, i18n.language),
          }}
          onOpenHref={input.onOpenHref}
        />
      </CabBox>
    </CabStack>
  );
}
