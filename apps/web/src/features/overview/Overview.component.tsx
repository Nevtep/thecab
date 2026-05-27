"use client";

import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  CabAnalysisCta,
  CabAnalysisStatusBadge,
  CabAccordion,
  CabBadge,
  CabButton,
  CabCard,
  CabDashboardGrid,
  CabEmptyState,
  CabErrorPanel,
  CabIcon,
  CabLoadingPanel,
  CabSectionHeader,
  CabSidebar,
  CabSidebarNavItem,
  CabStack,
  CabSwitch,
  CabText,
  CabTopNav,
  CabTooltip,
  CabImpactMetricCard,
  ConnectedShell,
} from "@/design-system";
import { formatDateTime, formatPercent, formatRelativeTime, formatUsd } from "@/i18n/formatters";
import { getExplorerBaseUrl } from "@/chains/chains";

import {
  formatWalletAddressLabel,
  getOverviewAnalysisAction,
  getOverviewCoverageReasonLabelKeys,
  getOverviewNavigationItems,
  getOverviewTrustBadgeTone,
  getOverviewTrustReasonLabelKeys,
  getOverviewTrustStatusLabelKey,
  mapOverviewAnalysisStatusToBadgeStatus,
} from "@/features/overview/overview.mappers";
import { CapitalAllocationSection } from "@/features/overview/CapitalAllocationSection";
import { portfolioEvolutionSeriesMeta } from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import { buildPortfolioEvolutionModel } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { PortfolioEvolutionSection } from "@/features/overview/portfolio-evolution/PortfolioEvolutionSection.component";
import type { OverviewRange, OverviewViewModel } from "@/features/overview/overview.types";
import { SUPPORTED_CHAIN_ID } from "@/wallet/supportedChains";

import styles from "./Overview.module.css";

type OverviewComponentProps = {
  walletAddress: string | null;
  chainId: number | null;
  walletStatus: "connected" | "connecting" | "reconnecting" | "disconnected";
  isConnected: boolean;
  isSupportedChain: boolean;
  range: OverviewRange;
  shellViewModel: OverviewViewModel | null;
  overviewViewModel: OverviewViewModel | null;
  chartViewModel: OverviewViewModel | null;
  activityViewModel: OverviewViewModel["activity"] | null;
  protocolPositionsViewModel: OverviewViewModel | null;
  visibleAssetRows: OverviewViewModel["assets"]["rows"];
  hiddenAssetRows: OverviewViewModel["assets"]["rows"];
  showHiddenAssets: boolean;
  showUnpricedAssets: boolean;
  showDustAssets: boolean;
  analysis: OverviewViewModel["analysis"] | null;
  isShellLoading: boolean;
  isOverviewSectionsLoading: boolean;
  isChartLoading: boolean;
  isChartRefreshing: boolean;
  isActivityLoading: boolean;
  isProtocolPositionsLoading: boolean;
  isRefreshing: boolean;
  isStartingAnalysis: boolean;
  errorCode: string | null;
  sectionsErrorCode: string | null;
  chartErrorCode: string | null;
  activityErrorCode: string | null;
  protocolPositionsErrorCode: string | null;
  isWarmingSnapshots: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchChain: () => void;
  onRefresh: () => void;
  onStartAnalysis: (mode: "full_history" | "incremental") => void;
  onRangeChange: (range: OverviewRange) => void;
  onToggleHiddenAssets: (checked: boolean) => void;
  onToggleUnpricedAssets: (checked: boolean) => void;
  onToggleDustAssets: (checked: boolean) => void;
};

function formatCurrencyValue(value: number | null, locale: string, fallbackLabel: string) {
  return value === null ? fallbackLabel : formatUsd(value, locale);
}

function sumKnownUsd(values: Array<number | null | undefined>) {
  const knownValues = values.filter((value): value is number => typeof value === "number");

  if (knownValues.length === 0) {
    return null;
  }

  return knownValues.reduce((sum, value) => sum + value, 0);
}

function buildTransactionExplorerUrl(txHash: string | null, chainId: number | null) {
  if (!txHash || !chainId) {
    return null;
  }

  return `${getExplorerBaseUrl(chainId)}/tx/${txHash}`;
}

function buildCoverageMessage(
  status: OverviewViewModel["coverage"]["status"],
  reasonCodes: OverviewViewModel["coverage"]["reasonCodes"] | null,
  translate: (key: string) => string,
) {
  const reasonLabels = getOverviewCoverageReasonLabelKeys(reasonCodes).map((labelKey) => translate(labelKey));

  return [translate(`coverage:status.${status}`), ...reasonLabels].join(" · ");
}

function buildSourceSubtitle(
  source: OverviewViewModel["summary"]["source"],
  coverageStatus: OverviewViewModel["coverage"]["status"],
  reasonCodes: OverviewViewModel["summary"]["coverageReasonCodes"],
  translate: (key: string) => string,
) {
  return [
    translate(`overview:sources.${source}`),
    buildCoverageMessage(coverageStatus, reasonCodes, translate),
  ].join(" · ");
}

function buildExclusionMessage(
  summary: OverviewViewModel["metrics"]["exclusions"] | null,
  translate: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
) {
  if (!summary) {
    return null;
  }

  const reasonLabels = summary.reasonCodes.map((reasonCode) => translate(`coverage:reasons.${reasonCode}`));

  return [
    translate("assets.exclusionsSummary", {
      count: summary.excludedAssetCount,
      value:
        summary.excludedValueUsd === null
          ? translate("states.unavailableValue")
          : formatUsd(summary.excludedValueUsd, locale),
    }),
    ...reasonLabels,
  ].join(" · ");
}

function isDustValueRow(row: OverviewViewModel["assets"]["rows"][number]) {
  return row.trustReasonCodes.includes("zeroOrDustValue");
}

function renderAssetRows(
  rows: OverviewViewModel["assets"]["rows"],
  input: {
    locale: string;
    translate: (key: string, options?: Record<string, unknown>) => string;
  },
) {
  return rows.map((row) => {
    const hasCurrentSpotPrice = row.priceUsd !== null;
    const displayedTrustStatus = !hasCurrentSpotPrice && row.trustStatus === "priced"
      ? "unknown"
      : row.trustStatus;
    const trustStatusLabel = input.translate(getOverviewTrustStatusLabelKey(displayedTrustStatus));
    const trustReasonLabels = getOverviewTrustReasonLabelKeys(
      !hasCurrentSpotPrice
        ? row.trustReasonCodes.filter((reasonCode) => reasonCode !== "hasReliablePrice")
        : row.trustReasonCodes,
    ).map((labelKey) => input.translate(labelKey));

    return (
      <CabCard key={`${row.tokenAddress ?? row.symbol}-${row.balance}-${row.isHiddenByDefault}`} density="default">
        <CabStack gap="$2">
          <CabStack row justifyContent="space-between" alignItems="center" gap="$3">
            <CabStack gap="$1">
              <CabStack row alignItems="center" gap="$2" flexWrap="wrap">
                <CabText variant="label">{row.symbol}</CabText>
                <CabTooltip label={trustReasonLabels.join(" · ") || trustStatusLabel}>
                  <span>
                    <CabBadge tone={getOverviewTrustBadgeTone(displayedTrustStatus)} size="sm">
                      {trustStatusLabel}
                    </CabBadge>
                  </span>
                </CabTooltip>
                {row.isHiddenByDefault ? (
                  <CabBadge tone="warning" size="sm">
                    {input.translate("assets.hiddenByDefault")}
                  </CabBadge>
                ) : null}
              </CabStack>
              <CabText variant="caption" fontSize={12}>
                {row.name ?? input.translate("states.unavailableValue")}
              </CabText>
              <CabText variant="caption" fontSize={12}>
                {row.balance}
              </CabText>
            </CabStack>
            <CabStack alignItems="flex-end" gap="$1">
              <CabText variant="label">
                {formatCurrencyValue(row.priceUsd, input.locale, input.translate("states.unavailableValue"))}
              </CabText>
              <CabText variant="caption" fontSize={12}>
                {row.valueUsd === null
                  ? input.translate("assets.priceUnavailable")
                  : input.translate("assets.positionValue", { value: formatUsd(row.valueUsd, input.locale) })}
              </CabText>
              <CabText variant="caption" fontSize={12}>
                {row.movement24hPct !== null
                  ? input.translate("assets.change24h", { value: formatPercent(row.movement24hPct, input.locale) })
                  : row.movement7dPct !== null
                    ? input.translate("assets.change7d", { value: formatPercent(row.movement7dPct, input.locale) })
                    : input.translate("coverage:reasons.missingPrices")}
              </CabText>
            </CabStack>
          </CabStack>
          {trustReasonLabels.length > 0 ? (
            <CabText variant="caption" fontSize={12}>
              {input.translate("assets.trustReasons", { reasons: trustReasonLabels.join(" · ") })}
            </CabText>
          ) : null}
        </CabStack>
      </CabCard>
    );
  });
}

function buildProtocolCoverageMessage(
  status: OverviewViewModel["protocolPositions"]["coverageStatus"],
  reasonCodes: OverviewViewModel["protocolPositions"]["coverageReasonCodes"],
  translate: (key: string) => string,
) {
  const reasonLabels = getOverviewCoverageReasonLabelKeys(reasonCodes).map((labelKey) => translate(labelKey));

  return [translate(`protocolPositions.coverageStatus.${status}`), ...reasonLabels].join(" · ");
}

function getProtocolPositionTone(
  family: OverviewViewModel["protocolPositions"]["rows"][number]["family"],
) {
  switch (family) {
    case "manual_deposit":
      return "info" as const;
    case "strategy_exposure":
      return "success" as const;
    case "governance_lock":
      return "warning" as const;
    case "staked_lp":
      return "neutral" as const;
  }
}

function getProtocolValueLabel(
  row: OverviewViewModel["protocolPositions"]["rows"][number],
  locale: string,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  if (row.valueUsd === null) {
    return translate(`protocolPositions.valueStatus.${row.valueStatus}`);
  }

  return translate("protocolPositions.positionValue", {
    value: formatUsd(row.valueUsd, locale),
    status: translate(`protocolPositions.valueStatus.${row.valueStatus}`),
  });
}

function formatProtocolTokenAmount(amount: number, locale: string) {
  const maximumFractionDigits = amount >= 1_000 ? 2 : amount >= 1 ? 4 : 6;

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(amount);
}

function formatProtocolRangeValue(value: number, locale: string, fractionDigits: number | null) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 6,
  }).format(value);
}

type ProtocolPositionRow = OverviewViewModel["protocolPositions"]["rows"][number];

type ProtocolPositionGroup = {
  key: string;
  label: string;
  rows: ProtocolPositionRow[];
  totalValueUsd: number | null;
};

function buildProtocolPoolGroupLabel(
  row: ProtocolPositionRow,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  if (row.poolLabel && row.metadata.feeTierLabel) {
    return translate("protocolPositions.poolGroupLabel", {
      pool: row.poolLabel,
      feeTier: row.metadata.feeTierLabel,
    });
  }

  return row.poolLabel ?? row.label;
}

function groupProtocolPositionRows(rows: ProtocolPositionRow[]) {
  const groups = new Map<string, { label: string; rows: ProtocolPositionRow[] }>();

  for (const row of rows) {
    const label = buildProtocolPoolGroupLabel(row, (key, options) => {
      if (key === "protocolPositions.poolGroupLabel") {
        return `${String(options?.pool ?? "")} · ${String(options?.feeTier ?? "")}`;
      }

      return row.poolLabel ?? row.label;
    });
    const key = row.poolLabel
      ? `${row.poolLabel.toLowerCase()}::${row.metadata.feeTierLabel ?? "unknown"}`
      : row.positionKey;
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.rows.push(row);
      continue;
    }

    groups.set(key, {
      label,
      rows: [row],
    });
  }

  return Array.from(groups.entries())
    .map(([key, group]): ProtocolPositionGroup => ({
      key,
      label: group.label,
      rows: group.rows,
      totalValueUsd: group.rows.some((row) => row.valueUsd === null)
        ? null
        : group.rows.reduce((total, row) => total + (row.valueUsd ?? 0), 0),
    }))
    .sort((left, right) => {
      const leftValue = left.totalValueUsd ?? -1;
      const rightValue = right.totalValueUsd ?? -1;

      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return left.label.localeCompare(right.label);
    });
}

function getProtocolAccordionHeaderLabel(
  row: ProtocolPositionRow,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  return row.tokenId
    ? translate("protocolPositions.accordionTokenId", { value: row.tokenId })
    : row.label;
}

function getProtocolAccordionHeaderRangeLabel(
  row: ProtocolPositionRow,
  input: {
    locale: string;
    translate: (key: string, options?: Record<string, unknown>) => string;
  },
) {
  if (
    row.metadata.rangeLowerPrice === null ||
    row.metadata.rangeUpperPrice === null ||
    !row.metadata.rangeQuoteTokenSymbol
  ) {
    return null;
  }

  const statusKey = row.metadata.isInRange === true
    ? "protocolPositions.rangeStatus.active"
    : row.metadata.isInRange === false
      ? "protocolPositions.rangeStatus.inactive"
      : "protocolPositions.rangeStatus.unknown";

  return input.translate("protocolPositions.rangeSummary", {
    status: input.translate(statusKey),
    range: input.translate("protocolPositions.rangeLabel", {
      lower: formatProtocolRangeValue(
        row.metadata.rangeLowerPrice,
        input.locale,
        row.metadata.rangeDisplayFractionDigits,
      ),
      upper: formatProtocolRangeValue(
        row.metadata.rangeUpperPrice,
        input.locale,
        row.metadata.rangeDisplayFractionDigits,
      ),
      quoteToken: row.metadata.rangeQuoteTokenSymbol,
    }),
  });
}

function renderProtocolPositionRows(
  rows: OverviewViewModel["protocolPositions"]["rows"],
  input: {
    locale: string;
    translate: (key: string, options?: Record<string, unknown>) => string;
  },
) {
  const groups = groupProtocolPositionRows(rows);

  return groups.map((group) => (
    <CabCard key={group.key} density="default">
      <CabStack gap="$3">
        <CabStack row justifyContent="space-between" alignItems="center" gap="$3">
          <CabStack gap="$1">
            <CabText variant="label">{group.label}</CabText>
            <CabText variant="caption" fontSize={12}>
              {input.translate("protocolPositions.poolGroupCount", { count: group.rows.length })}
            </CabText>
          </CabStack>
          <CabText variant="label">
            {formatCurrencyValue(group.totalValueUsd, input.locale, input.translate("states.unavailableValue"))}
          </CabText>
        </CabStack>
        <CabAccordion
          items={group.rows.map((row) => {
            const familyLabel = input.translate(`protocolPositions.families.${row.family}`);
            const statusLabel = input.translate(`protocolPositions.positionStatus.${row.status}`);
            const coverageReasonLabels = row.coverageReasonCodes.map((reasonCode) =>
              input.translate(`coverage:reasons.${reasonCode}`),
            );
            const tokenAmountBits = [
              row.primaryTokenSymbol && row.primaryTokenAmount !== null
                ? `${row.primaryTokenSymbol} ${formatProtocolTokenAmount(row.primaryTokenAmount, input.locale)}`
                : null,
              row.secondaryTokenSymbol && row.secondaryTokenAmount !== null
                ? `${row.secondaryTokenSymbol} ${formatProtocolTokenAmount(row.secondaryTokenAmount, input.locale)}`
                : null,
            ].filter((value): value is string => Boolean(value));
            const metadataBits = [
              tokenAmountBits.length > 0 ? tokenAmountBits.join(" · ") : null,
              row.strategyLabel,
              row.governanceLabel,
              row.metadata.lockEndAt
                ? input.translate("protocolPositions.lockEndAt", {
                    value: formatDateTime(row.metadata.lockEndAt, input.locale),
                  })
                : null,
            ].filter((value): value is string => Boolean(value));

            return {
              value: row.positionKey,
              header: (
                <CabStack row justifyContent="space-between" alignItems="center" gap="$3" width="100%">
                  <CabStack row alignItems="center" gap="$2" flexWrap="wrap">
                    <CabText variant="label">{getProtocolAccordionHeaderLabel(row, input.translate)}</CabText>
                    {getProtocolAccordionHeaderRangeLabel(row, input) ? (
                      <CabText variant="caption" fontSize={12}>
                        {getProtocolAccordionHeaderRangeLabel(row, input)}
                      </CabText>
                    ) : null}
                  </CabStack>
                  <CabText variant="label">
                    {formatCurrencyValue(row.valueUsd, input.locale, input.translate("states.unavailableValue"))}
                  </CabText>
                </CabStack>
              ),
              content: (
                <CabStack gap="$2">
                  <CabStack row alignItems="center" gap="$2" flexWrap="wrap">
                    <CabText variant="label">{row.label}</CabText>
                    <CabBadge tone={getProtocolPositionTone(row.family)} size="sm">
                      {familyLabel}
                    </CabBadge>
                    <CabBadge tone="neutral" size="sm">
                      {statusLabel}
                    </CabBadge>
                  </CabStack>
                  <CabText variant="caption" fontSize={12}>
                    {metadataBits.length > 0
                      ? metadataBits.join(" · ")
                      : input.translate("protocolPositions.metadataUnavailable")}
                  </CabText>
                  <CabStack row justifyContent="space-between" alignItems="flex-start" gap="$3">
                    <CabStack gap="$1" flex={1}>
                      <CabText variant="caption" fontSize={12}>
                        {getProtocolValueLabel(row, input.locale, input.translate)}
                      </CabText>
                      <CabText variant="caption" fontSize={12}>
                        {input.translate(`protocolPositions.coverageStatus.${row.coverageStatus}`)}
                      </CabText>
                      {row.valueUpdatedAt ? (
                        <CabText variant="caption" fontSize={12}>
                          {input.translate("protocolPositions.valueUpdatedAt", {
                            value: formatDateTime(row.valueUpdatedAt, input.locale),
                          })}
                        </CabText>
                      ) : null}
                    </CabStack>
                  </CabStack>
                  {coverageReasonLabels.length > 0 ? (
                    <CabText variant="caption" fontSize={12}>
                      {coverageReasonLabels.join(" · ")}
                    </CabText>
                  ) : null}
                </CabStack>
              ),
            };
          })}
        />
      </CabStack>
    </CabCard>
  ));
}

export function OverviewComponent({
  walletAddress,
  chainId,
  walletStatus,
  isConnected,
  isSupportedChain,
  range,
  shellViewModel,
  overviewViewModel,
  chartViewModel,
  activityViewModel,
  protocolPositionsViewModel,
  visibleAssetRows,
  hiddenAssetRows,
  showHiddenAssets,
  showUnpricedAssets,
  showDustAssets,
  analysis,
  isShellLoading,
  isOverviewSectionsLoading,
  isChartLoading,
  isChartRefreshing,
  isActivityLoading,
  isProtocolPositionsLoading,
  isRefreshing,
  isStartingAnalysis,
  errorCode,
  sectionsErrorCode,
  chartErrorCode,
  activityErrorCode,
  protocolPositionsErrorCode,
  isWarmingSnapshots,
  onConnect,
  onDisconnect,
  onSwitchChain,
  onRefresh,
  onStartAnalysis,
  onRangeChange,
  onToggleHiddenAssets,
  onToggleUnpricedAssets,
  onToggleDustAssets,
}: OverviewComponentProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation(["overview", "navigation", "analysis", "coverage", "charts", "trust", "wallet"]);
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const locale = i18n.language;
  const isWalletPending = walletStatus === "connecting" || walletStatus === "reconnecting";
  const portfolioEvolutionModel = useMemo(
    () => chartViewModel
      ? buildPortfolioEvolutionModel({
          viewModel: chartViewModel,
          activity: activityViewModel,
          range,
          locale,
        })
      : null,
    [activityViewModel, chartViewModel, locale, range],
  );

  if (!isHydrated) {
    return (
      <section data-overview-root>
        <CabLoadingPanel label={t("states.loadingTitle")} />
      </section>
    );
  }

  if (!isConnected && !isWalletPending) {
    return (
      <section data-overview-root>
        <CabEmptyState
          title={t("states.disconnectedTitle")}
          description={t("states.disconnectedDescription")}
          actionLabel={t("actions.connectWallet")}
          onAction={onConnect}
        />
      </section>
    );
  }

  if (!isSupportedChain) {
    return (
      <section data-overview-root>
        <CabEmptyState
          title={t("states.unsupportedChainTitle")}
          description={t("states.unsupportedChainDescription")}
          actionLabel={t("actions.switchNetwork")}
          onAction={onSwitchChain}
        />
      </section>
    );
  }

  if (!shellViewModel && !overviewViewModel && errorCode) {
    return (
      <section data-overview-root>
        <CabErrorPanel
          title={t("states.providerFailureTitle")}
          description={t(`states.errors.${errorCode}`, { defaultValue: t("states.providerFailureDescription") })}
          retryLabel={t("actions.refresh")}
          onRetry={onRefresh}
        />
      </section>
    );
  }

  if (!shellViewModel && !overviewViewModel && !isShellLoading && !isOverviewSectionsLoading && !isWalletPending) {
    return (
      <section data-overview-root>
        <CabEmptyState
          title={t("states.emptyTitle")}
          description={t("states.emptyDescription")}
          actionLabel={t("actions.refresh")}
          onAction={onRefresh}
        />
      </section>
    );
  }

  const baseViewModel = overviewViewModel ?? shellViewModel;
  const resolvedProtocolPositionsViewModel = protocolPositionsViewModel;
  const resolvedChartViewModel = chartViewModel;
  const isInitialShellLoading = isWalletPending || (isShellLoading && !baseViewModel);
  const isInitialSectionsLoading = isWalletPending || (isOverviewSectionsLoading && !overviewViewModel);
  const isInitialChartLoading = isWalletPending || (isChartLoading && !resolvedChartViewModel);
  const isInitialActivityLoading = isWalletPending || (isActivityLoading && !activityViewModel);
  const isInitialProtocolPositionsLoading =
    isWalletPending || (isProtocolPositionsLoading && !resolvedProtocolPositionsViewModel);
  const resolvedShellViewModel = baseViewModel as OverviewViewModel;
  const pageCoverageMessage = baseViewModel
    ? buildCoverageMessage(
        baseViewModel.coverage.status,
        baseViewModel.coverage.reasonCodes,
        t,
      )
    : t("states.loadingTitle");
  const activeAnalysis = analysis ?? baseViewModel?.analysis ?? {
    status: "not_analyzed",
    runId: null,
    stage: "idle",
    progressPct: 0,
    lastSuccessfulRunAt: null,
    lastUpdatedAt: null,
    lastError: null,
  };
  const analysisStatusLabel = t(`analysis:status.${activeAnalysis.status}`);
  const formattedWalletAddress = walletAddress ? formatWalletAddressLabel(walletAddress) : t("states.unavailableValue");
  const openTransactionLabel = t("activity.openInExplorer");
  const navigationItems = getOverviewNavigationItems(activeAnalysis.status);
  const analysisAction = getOverviewAnalysisAction(activeAnalysis.status);
  const isHistoricalAnalysisReady = activeAnalysis.status === "ready" || activeAnalysis.status === "stale";
  const exclusionMessage = buildExclusionMessage(overviewViewModel?.metrics.exclusions ?? null, t, locale);
  const visibleRenderableRows = visibleAssetRows.filter((row) => {
    if (!showUnpricedAssets && row.priceUsd === null) {
      return false;
    }

    if (!showDustAssets && isDustValueRow(row)) {
      return false;
    }

    return true;
  });
  const hiddenRenderableRows = hiddenAssetRows.filter((row) => {
    if (!showUnpricedAssets && row.priceUsd === null) {
      return false;
    }

    if (!showDustAssets && isDustValueRow(row)) {
      return false;
    }

    return true;
  });
  const protocolPositionsCoverageMessage = protocolPositionsViewModel
    ? buildProtocolCoverageMessage(
        protocolPositionsViewModel.protocolPositions.coverageStatus,
        protocolPositionsViewModel.protocolPositions.coverageReasonCodes,
        t,
      )
    : t("states.loadingProtocolPositions");
  const deployedValueFromProtocolPositions = sumKnownUsd(
    resolvedProtocolPositionsViewModel?.protocolPositions.rows.map((row) => row.valueUsd) ?? [],
  );
  const deployedMetricValueUsd =
    overviewViewModel?.metrics.deployedValueUsd ??
    deployedValueFromProtocolPositions ??
    shellViewModel?.metrics.deployedValueUsd ??
    null;
  const idleMetricValueUsd =
    overviewViewModel?.metrics.idleValueUsd ?? shellViewModel?.metrics.idleValueUsd ?? null;
  const netPortfolioMetricValueUsd =
    overviewViewModel?.metrics.netPortfolioValueUsd ??
    sumKnownUsd([idleMetricValueUsd, deployedMetricValueUsd]) ??
    shellViewModel?.metrics.netPortfolioValueUsd ??
    null;
  const estimatedRealizedRewardsMetricValueUsd =
    overviewViewModel?.metrics.estimatedRealizedRewardsUsd ??
    resolvedChartViewModel?.metrics.estimatedRealizedRewardsUsd ??
    shellViewModel?.metrics.estimatedRealizedRewardsUsd ??
    null;
  const changeOverSelectedPeriodPct =
    overviewViewModel?.metrics.changeOverSelectedPeriodPct ??
    shellViewModel?.metrics.changeOverSelectedPeriodPct ??
    null;
  const hasProtocolPositions = (resolvedProtocolPositionsViewModel?.protocolPositions.rows.length ?? 0) > 0;
  const protocolSummaryChips = resolvedProtocolPositionsViewModel ? [
    t("protocolPositions.summary.totalCount", {
      count: resolvedProtocolPositionsViewModel.protocolPositions.summary.totalCount,
    }),
    resolvedProtocolPositionsViewModel.protocolPositions.summary.familyCounts.manualDeposit > 0
      ? t("protocolPositions.summary.manualDepositCount", {
          count: resolvedProtocolPositionsViewModel.protocolPositions.summary.familyCounts.manualDeposit,
        })
      : null,
    resolvedProtocolPositionsViewModel.protocolPositions.summary.familyCounts.strategyExposure > 0
      ? t("protocolPositions.summary.strategyExposureCount", {
          count: resolvedProtocolPositionsViewModel.protocolPositions.summary.familyCounts.strategyExposure,
        })
      : null,
    resolvedProtocolPositionsViewModel.protocolPositions.summary.familyCounts.governanceLock > 0
      ? t("protocolPositions.summary.governanceLockCount", {
          count: resolvedProtocolPositionsViewModel.protocolPositions.summary.familyCounts.governanceLock,
        })
      : null,
  ].filter((value): value is string => Boolean(value)) : [];
  const analysisStatusCard = isInitialShellLoading ? (
    <CabCard density="spacious">
      <CabText variant="caption" fontSize={12}>
        {t("states.loadingAnalysis")}
      </CabText>
    </CabCard>
  ) : (
    <CabCard density="spacious">
      <CabStack gap="$3">
        <CabSectionHeader
          title={t("analysis:title")}
          subtitle={t(`analysis:banner.${activeAnalysis.status}`, {
            chain: chainId === SUPPORTED_CHAIN_ID ? "Base" : String(chainId ?? ""),
            relative: activeAnalysis.lastSuccessfulRunAt
              ? formatRelativeTime(activeAnalysis.lastSuccessfulRunAt, locale)
              : t("analysis:lastSuccessful.never"),
          })}
          actions={
            <CabAnalysisStatusBadge
              status={mapOverviewAnalysisStatusToBadgeStatus(activeAnalysis.status)}
              label={analysisStatusLabel}
            />
          }
        />
        {isWarmingSnapshots ? (
          <CabText variant="caption" fontSize={12}>
            {t("states.loadingWarmup30d")}
          </CabText>
        ) : null}
        {activeAnalysis.lastSuccessfulRunAt ? (
          <CabText variant="caption" fontSize={12}>
            {t("analysis:lastSuccessful.atUtc", {
              datetime: formatDateTime(activeAnalysis.lastSuccessfulRunAt, locale),
            })}
          </CabText>
        ) : null}
        {activeAnalysis.lastError ? (
          <CabStack gap="$1">
            <CabText variant="caption" fontSize={12}>
              {t("analysis:fallback.recentViewAvailable")}
            </CabText>
            <CabText variant="caption" fontSize={12}>
              {activeAnalysis.lastError}
            </CabText>
          </CabStack>
        ) : null}
        {analysisAction.visible && analysisAction.mode ? (
          <CabAnalysisCta
            label={t(analysisAction.labelKey)}
            disabled={isStartingAnalysis}
            onPress={() => onStartAnalysis(analysisAction.mode)}
          />
        ) : null}
      </CabStack>
    </CabCard>
  );

  return (
    <section data-overview-root>
      <ConnectedShell
        sidebar={
          <CabSidebar
            header={
              <CabText variant="heading" fontSize={18}>
                {t("title")}
              </CabText>
            }
            footer={
              <CabText variant="caption" fontSize={12}>
                {pageCoverageMessage}
              </CabText>
            }
          >
            <CabStack gap="$2">
              {navigationItems.map((item) => (
                <CabSidebarNavItem
                  key={item.key}
                  iconName={item.iconName}
                  label={t(item.labelKey)}
                  state={item.stateKey}
                  stateLabel={item.stateKey === "active" ? undefined : t(`navigation:states.${item.stateKey}`)}
                  disabled={item.disabled}
                  onPress={item.href ? () => router.push(item.href!) : undefined}
                />
              ))}
            </CabStack>
            <CabCard density="spacious">
              <CabStack gap="$3">
                <CabStack row alignItems="center" gap="$2">
                  <CabIcon name="wallet" tone="muted" size="sm" />
                  <CabText variant="caption" fontSize={12}>
                    {t("summary.wallet")}
                  </CabText>
                </CabStack>
                <CabText variant="label">{formattedWalletAddress}</CabText>
                <CabStack row alignItems="center" gap="$2">
                  <CabIcon name="navigation" tone="muted" size="sm" />
                  <CabText variant="caption" fontSize={12}>
                    {t("summary.chain")}
                  </CabText>
                </CabStack>
                <CabText variant="label">
                  {baseViewModel?.summary.chainLabel ?? t("states.unavailableValue")} {chainId ? `(${chainId})` : ""}
                </CabText>
                <CabStack row alignItems="center" gap="$2">
                  <CabIcon name="activity" tone="muted" size="sm" />
                  <CabText variant="caption" fontSize={12}>
                    {t("summary.lastRefreshed")}
                  </CabText>
                </CabStack>
                <CabText variant="label">
                  {baseViewModel?.summary.lastRefreshedAt
                    ? formatRelativeTime(baseViewModel.summary.lastRefreshedAt, locale)
                    : t("states.unavailableValue")}
                </CabText>
              </CabStack>
            </CabCard>
            {analysisStatusCard}
          </CabSidebar>
        }
        topBar={
          <CabTopNav title={t("title")}>
            <CabStack row gap="$2" flexWrap="wrap" alignItems="center">
              <CabButton tone="secondary" onPress={onRefresh} disabled={isRefreshing}>
                {isRefreshing ? t("actions.refreshing") : t("actions.refresh")}
              </CabButton>
              <CabButton tone="secondary" onPress={onDisconnect}>
                {t("wallet:actions.disconnect")}
              </CabButton>
            </CabStack>
          </CabTopNav>
        }
      >
        <CabStack gap="$4">
          <CabDashboardGrid>
            {isInitialShellLoading ? (
              <>
                <CabLoadingPanel label={t("states.loadingMetrics")} />
                <CabLoadingPanel label={t("states.loadingMetrics")} />
                <CabLoadingPanel label={t("states.loadingMetrics")} />
                <CabLoadingPanel label={t("states.loadingMetrics")} />
              </>
            ) : (
              <>
                <CabImpactMetricCard
                  label={t("metrics.netPortfolioValue")}
                  value={formatCurrencyValue(netPortfolioMetricValueUsd, locale, t("states.unavailableValue"))}
                  iconName="dashboard"
                  accentColor={portfolioEvolutionSeriesMeta.total.color}
                  series={portfolioEvolutionModel?.data.map((point) => point.totalValueUsd) ?? []}
                  meta={changeOverSelectedPeriodPct === null ? null : formatPercent(changeOverSelectedPeriodPct, locale)}
                />
                <CabImpactMetricCard
                  label={t("metrics.deployedValue")}
                  value={formatCurrencyValue(deployedMetricValueUsd, locale, t("states.unavailableValue"))}
                  iconName="arrowUpToLine"
                  accentColor={portfolioEvolutionSeriesMeta.deployed.color}
                  series={portfolioEvolutionModel?.data.map((point) => point.deployedValueUsd) ?? []}
                />
                <CabImpactMetricCard
                  label={t("metrics.idleValue")}
                  value={formatCurrencyValue(idleMetricValueUsd, locale, t("states.unavailableValue"))}
                  iconName="wallet"
                  accentColor={portfolioEvolutionSeriesMeta.idle.color}
                  series={portfolioEvolutionModel?.data.map((point) => point.idleValueUsd) ?? []}
                />
                <CabImpactMetricCard
                  label={t("metrics.estimatedRealizedRewards")}
                  value={formatCurrencyValue(estimatedRealizedRewardsMetricValueUsd, locale, t("states.unavailableValue"))}
                  iconName="rewards"
                  accentColor={portfolioEvolutionSeriesMeta.rewards.color}
                  series={portfolioEvolutionModel?.data.map((point) => point.cumulativeRewardValueUsd) ?? []}
                  meta={portfolioEvolutionModel ? t("portfolioEvolution.tooltip.eventCount", { count: portfolioEvolutionModel.footer.markerCount }) : null}
                />
              </>
            )}
          </CabDashboardGrid>
          {!isInitialSectionsLoading && exclusionMessage ? (
            <CabText variant="caption" fontSize={12}>
              {exclusionMessage}
            </CabText>
          ) : null}

          <div className={styles.primaryGrid}>
            <div className={styles.primaryPanel}>
              {isInitialChartLoading ? (
                <CabLoadingPanel label={t("states.loadingChart")} />
              ) : !resolvedChartViewModel && chartErrorCode ? (
                <CabErrorPanel
                  title={t("states.providerFailureTitle")}
                  description={t(`states.errors.${chartErrorCode}`, { defaultValue: t("states.providerFailureDescription") })}
                  retryLabel={t("actions.refresh")}
                  onRetry={onRefresh}
                />
              ) : !resolvedChartViewModel ? (
                <CabEmptyState
                  title={t("states.emptyTitle")}
                  description={t("states.emptyDescription")}
                />
              ) : !isHistoricalAnalysisReady ? (
                <CabCard density="spacious">
                  <CabEmptyState
                    title={t("portfolioEvolution.awaitingAnalysisTitle")}
                    description={t("portfolioEvolution.awaitingAnalysisDescription")}
                    actionLabel={analysisAction.visible && analysisAction.labelKey ? t(analysisAction.labelKey) : undefined}
                    onAction={analysisAction.visible && analysisAction.mode ? () => onStartAnalysis(analysisAction.mode) : undefined}
                  />
                </CabCard>
              ) : (
                <PortfolioEvolutionSection
                  viewModel={resolvedChartViewModel}
                  model={portfolioEvolutionModel}
                  activity={activityViewModel}
                  range={range}
                  locale={locale}
                  isRefreshing={isChartRefreshing}
                  onRangeChange={onRangeChange}
                />
              )}
            </div>

            <div className={`${styles.primaryPanel} ${styles.distributionPanel}`}>
              {isInitialChartLoading ? (
                <CabLoadingPanel label={t("states.loadingDistribution")} />
              ) : !resolvedChartViewModel && chartErrorCode ? (
                <CabErrorPanel
                  title={t("states.providerFailureTitle")}
                  description={t(`states.errors.${chartErrorCode}`, { defaultValue: t("states.providerFailureDescription") })}
                  retryLabel={t("actions.refresh")}
                  onRetry={onRefresh}
                />
              ) : !resolvedChartViewModel ? (
                <CabEmptyState
                  title={t("states.emptyTitle")}
                  description={t("states.emptyDescription")}
                />
              ) : (
                <CapitalAllocationSection
                  distribution={resolvedChartViewModel.distribution}
                  assetRows={(overviewViewModel?.assets.rows ?? [...visibleAssetRows, ...hiddenAssetRows])
                    .filter((row) => !row.isHiddenByDefault && row.priceUsd !== null && !isDustValueRow(row))}
                  range={range}
                />
              )}
            </div>
          </div>

          {isInitialProtocolPositionsLoading ? (
            <CabLoadingPanel label={t("states.loadingProtocolPositions")} />
          ) : !resolvedProtocolPositionsViewModel && protocolPositionsErrorCode ? (
            <CabErrorPanel
              title={t("states.providerFailureTitle")}
              description={t(`states.errors.${protocolPositionsErrorCode}`, { defaultValue: t("states.providerFailureDescription") })}
              retryLabel={t("actions.refresh")}
              onRetry={onRefresh}
            />
          ) : !resolvedProtocolPositionsViewModel ? (
            <CabEmptyState
              title={t("states.emptyTitle")}
              description={t("states.emptyDescription")}
            />
          ) : (
            <CabCard density="spacious">
              <CabStack gap="$3">
                <CabSectionHeader
                  title={t("sections.protocolPositions")}
                  subtitle={buildSourceSubtitle(
                    resolvedProtocolPositionsViewModel.protocolPositions.source,
                    resolvedProtocolPositionsViewModel.coverage.status,
                    resolvedProtocolPositionsViewModel.protocolPositions.coverageReasonCodes,
                    t,
                  )}
                />
                <CabText variant="caption" fontSize={12}>
                  {protocolPositionsCoverageMessage}
                </CabText>
                {hasProtocolPositions ? (
                  <CabStack gap="$2">
                    <CabStack row gap="$2" flexWrap="wrap" alignItems="center">
                      {protocolSummaryChips.map((chip) => (
                        <CabBadge key={chip} tone="neutral" size="sm">
                          {chip}
                        </CabBadge>
                      ))}
                    </CabStack>
                    {resolvedProtocolPositionsViewModel.protocolPositions.summary.hasShareLevelPositions ? (
                      <CabText variant="caption" fontSize={12}>
                        {t("protocolPositions.shareLevelNotice")}
                      </CabText>
                    ) : null}
                    {resolvedProtocolPositionsViewModel.protocolPositions.coverageReasonCodes?.includes("recentProtocolReconstruction") ? (
                      <CabText variant="caption" fontSize={12}>
                        {t("protocolPositions.reconstructionNotice")}
                      </CabText>
                    ) : null}
                    {renderProtocolPositionRows(resolvedProtocolPositionsViewModel.protocolPositions.rows, {
                      locale,
                      translate: t,
                    })}
                  </CabStack>
                ) : (
                  <CabEmptyState
                    title={t("protocolPositions.emptyTitle")}
                    description={t("protocolPositions.emptyDescription")}
                  />
                )}
              </CabStack>
            </CabCard>
          )}

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
            }}
          >
            {isInitialSectionsLoading ? (
              <CabLoadingPanel label={t("states.loadingAssets")} />
            ) : !overviewViewModel && sectionsErrorCode ? (
              <CabErrorPanel
                title={t("states.providerFailureTitle")}
                description={t(`states.errors.${sectionsErrorCode}`, { defaultValue: t("states.providerFailureDescription") })}
                retryLabel={t("actions.refresh")}
                onRetry={onRefresh}
              />
            ) : !overviewViewModel ? (
              <CabEmptyState
                title={t("states.emptyTitle")}
                description={t("states.emptyDescription")}
              />
            ) : (
              <CabCard density="spacious">
                <CabStack gap="$3">
                  <CabSectionHeader
                    title={t("sections.assets")}
                    subtitle={buildSourceSubtitle(
                      overviewViewModel.assets.source,
                      overviewViewModel.assets.coverageStatus,
                      overviewViewModel.assets.coverageReasonCodes,
                      t,
                    )}
                    actions={
                      <CabStack row gap="$3" flexWrap="wrap" alignItems="center">
                        <CabSwitch
                          checked={showHiddenAssets}
                          onCheckedChange={onToggleHiddenAssets}
                          label={t("assets.showHiddenAssets")}
                        />
                        <CabSwitch
                          checked={showUnpricedAssets}
                          onCheckedChange={onToggleUnpricedAssets}
                          label={t("assets.showUnpricedAssets")}
                        />
                        <CabSwitch
                          checked={showDustAssets}
                          onCheckedChange={onToggleDustAssets}
                          label={t("assets.showDustAssets")}
                        />
                      </CabStack>
                    }
                  />

                  {visibleRenderableRows.length === 0 && hiddenRenderableRows.length === 0 ? (
                    hasProtocolPositions ? (
                      <CabEmptyState
                        title={t("assets.protocolPositionsOnlyTitle")}
                        description={t("assets.protocolPositionsOnlyDescription")}
                      />
                    ) : (
                      <CabEmptyState
                        title={t("assets.filteredEmptyTitle")}
                        description={t("assets.filteredEmptyDescription")}
                      />
                    )
                  ) : visibleRenderableRows.length === 0 && hiddenRenderableRows.length > 0 && !showHiddenAssets ? (
                    <CabEmptyState
                      title={t("assets.hiddenOnlyTitle")}
                      description={t("assets.hiddenOnlyDescription")}
                    />
                  ) : (
                    <CabStack gap="$2">
                      {renderAssetRows(visibleRenderableRows, { locale, translate: t })}
                      {showHiddenAssets && hiddenRenderableRows.length > 0 ? (
                        <CabStack gap="$2">
                          <CabSectionHeader
                            title={t("assets.hiddenInspectionTitle")}
                            subtitle={t("assets.hiddenInspectionDescription")}
                          />
                          {renderAssetRows(hiddenRenderableRows, { locale, translate: t })}
                        </CabStack>
                      ) : null}
                    </CabStack>
                  )}
                </CabStack>
              </CabCard>
            )}

            {isInitialActivityLoading ? (
              <CabLoadingPanel label={t("states.loadingActivity")} />
            ) : !activityViewModel && activityErrorCode ? (
              <CabErrorPanel
                title={t("states.providerFailureTitle")}
                description={t(`states.errors.${activityErrorCode}`, { defaultValue: t("states.providerFailureDescription") })}
                retryLabel={t("actions.refresh")}
                onRetry={onRefresh}
              />
            ) : !activityViewModel ? (
              <CabEmptyState
                title={t("states.emptyTitle")}
                description={t("states.emptyDescription")}
              />
            ) : (
              <CabCard density="spacious">
                <CabStack gap="$3">
                  <CabSectionHeader
                    title={t("sections.activity")}
                    subtitle={buildSourceSubtitle(
                      activityViewModel.source,
                      activityViewModel.coverageStatus,
                      activityViewModel.coverageReasonCodes,
                      t,
                    )}
                  />
                  {activityViewModel.items.length === 0 ? (
                    <CabEmptyState
                      title={t("states.emptyActivityTitle")}
                      description={t("states.emptyActivityDescription")}
                    />
                  ) : (
                    <CabStack gap="$2">
                      {activityViewModel.items.map((item) => (
                        <CabCard key={item.id} density="default">
                          <CabStack row justifyContent="space-between" alignItems="center" gap="$3">
                            <CabStack gap="$1">
                              <CabStack row gap="$2" alignItems="center" flexWrap="wrap">
                                <CabText variant="label">
                                  {item.detail ?? t(item.labelKey, { defaultValue: t("activity.unclassified") })}
                                </CabText>
                                <CabBadge tone={item.isUnclassified ? "warning" : "neutral"} size="sm">
                                  {t(item.labelKey, { defaultValue: t("activity.unclassified") })}
                                </CabBadge>
                              </CabStack>
                              <CabText variant="caption" fontSize={12}>
                                {formatDateTime(item.occurredAt, locale)}
                              </CabText>
                            </CabStack>
                            <CabStack row alignItems="center" gap="$2">
                              <CabText variant="caption" fontSize={12} textAlign="right">
                                {item.txHash ? formatWalletAddressLabel(item.txHash) : t("states.unavailableValue")}
                              </CabText>
                              {buildTransactionExplorerUrl(item.txHash, chainId) ? (
                                <a
                                  href={buildTransactionExplorerUrl(item.txHash, chainId) ?? undefined}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  aria-label={openTransactionLabel}
                                  title={openTransactionLabel}
                                  style={{ display: "inline-flex", alignItems: "center" }}
                                >
                                  <CabIcon name="externalLink" tone="muted" size="sm" />
                                </a>
                              ) : null}
                            </CabStack>
                          </CabStack>
                        </CabCard>
                      ))}
                    </CabStack>
                  )}
                </CabStack>
              </CabCard>
            )}
          </div>

          {isInitialShellLoading ? (
            <CabLoadingPanel label={t("states.loadingTitle")} />
          ) : (
            <CabCard density="spacious">
              <CabSectionHeader
                title={t("summary.title")}
                subtitle={t(resolvedShellViewModel.summary.modeLabelKey)}
              />
              <CabStack row justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
                <CabText variant="label">
                  {t("summary.wallet")}: {formattedWalletAddress}
                </CabText>
                <CabText variant="label">
                  {t("summary.chain")}: {resolvedShellViewModel.summary.chainLabel}
                </CabText>
                <CabText variant="label">
                  {t("summary.lastRefreshed")}: {resolvedShellViewModel.summary.lastRefreshedAt
                    ? formatRelativeTime(resolvedShellViewModel.summary.lastRefreshedAt, locale)
                    : t("states.unavailableValue")}
                </CabText>
              </CabStack>
            </CabCard>
          )}
        </CabStack>
      </ConnectedShell>
    </section>
  );
}