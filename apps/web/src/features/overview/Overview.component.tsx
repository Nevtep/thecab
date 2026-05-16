"use client";

import { useTranslation } from "react-i18next";

import {
  CabAnalysisCta,
  CabAnalysisStatusBadge,
  CabAreaChart,
  CabBadge,
  CabButton,
  CabCard,
  CabDashboardGrid,
  CabEmptyState,
  CabErrorPanel,
  CabIcon,
  CabLoadingPanel,
  CabMetricCard,
  CabPartialCoverageNotice,
  CabRangeSelector,
  CabSectionHeader,
  CabSidebar,
  CabSidebarNavItem,
  CabStack,
  CabSwitch,
  CabText,
  CabTopNav,
  CabTooltip,
  ConnectedShell,
} from "@/design-system";
import {
  formatDateTime,
  formatPercent,
  formatRelativeTime,
  formatUsd,
} from "@/i18n/formatters";

import {
  formatWalletAddressLabel,
  getOverviewCoverageReasonLabelKeys,
  getOverviewNavigationItems,
  getOverviewTrustBadgeTone,
  getOverviewTrustReasonLabelKeys,
  getOverviewTrustStatusLabelKey,
  mapOverviewAnalysisStatusToBadgeStatus,
} from "@/features/overview/overview.mappers";
import type { OverviewRange, OverviewViewModel } from "@/features/overview/overview.types";

type OverviewComponentProps = {
  walletAddress: string | null;
  chainId: number | null;
  isConnected: boolean;
  isSupportedChain: boolean;
  range: OverviewRange;
  viewModel: OverviewViewModel | null;
  visibleAssetRows: OverviewViewModel["assets"]["rows"];
  hiddenAssetRows: OverviewViewModel["assets"]["rows"];
  showHiddenAssets: boolean;
  showUnpricedAssets: boolean;
  showDustAssets: boolean;
  analysis: OverviewViewModel["analysis"] | null;
  isLoading: boolean;
  isRefreshing: boolean;
  errorCode: string | null;
  isStartingAnalysis: boolean;
  onConnect: () => void;
  onSwitchChain: () => void;
  onRefresh: () => void;
  onRangeChange: (range: OverviewRange) => void;
  onStartAnalysis: () => void;
  onToggleHiddenAssets: (checked: boolean) => void;
  onToggleUnpricedAssets: (checked: boolean) => void;
  onToggleDustAssets: (checked: boolean) => void;
};

function formatCurrencyValue(value: number | null, locale: string, fallbackLabel: string) {
  return value === null ? fallbackLabel : formatUsd(value, locale);
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
    const trustStatusLabel = input.translate(getOverviewTrustStatusLabelKey(row.trustStatus));
    const trustReasonLabels = getOverviewTrustReasonLabelKeys(row.trustReasonCodes).map((labelKey) =>
      input.translate(labelKey),
    );

    return (
      <CabCard key={`${row.tokenAddress ?? row.symbol}-${row.balance}-${row.isHiddenByDefault}`} density="default">
        <CabStack gap="$2">
          <CabStack row justifyContent="space-between" alignItems="center" gap="$3">
            <CabStack gap="$1">
              <CabStack row alignItems="center" gap="$2" flexWrap="wrap">
                <CabText variant="label">{row.symbol}</CabText>
                <CabTooltip label={trustReasonLabels.join(" · ") || trustStatusLabel}>
                  <span>
                    <CabBadge tone={getOverviewTrustBadgeTone(row.trustStatus)} size="sm">
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

export function OverviewComponent({
  walletAddress,
  chainId,
  isConnected,
  isSupportedChain,
  range,
  viewModel,
  visibleAssetRows,
  hiddenAssetRows,
  showHiddenAssets,
  showUnpricedAssets,
  showDustAssets,
  analysis,
  isLoading,
  isRefreshing,
  errorCode,
  isStartingAnalysis,
  onConnect,
  onSwitchChain,
  onRefresh,
  onRangeChange,
  onStartAnalysis,
  onToggleHiddenAssets,
  onToggleUnpricedAssets,
  onToggleDustAssets,
}: OverviewComponentProps) {
  const { t, i18n } = useTranslation([
    "overview",
    "navigation",
    "analysis",
    "coverage",
    "charts",
    "trust",
  ]);
  const locale = i18n.language;
  const rangeOptions = ["24h", "7d", "30d"].map((option) => ({
    key: option,
    label: t(`ranges.${option}`),
  }));

  if (!isConnected) {
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

  if (isLoading && !viewModel) {
    return (
      <section data-overview-root>
        <CabLoadingPanel label={t("states.loadingTitle")} />
      </section>
    );
  }

  if (!viewModel && errorCode) {
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

  if (!viewModel) {
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

  const pageCoverageMessage = buildCoverageMessage(
    viewModel.coverage.status,
    viewModel.coverage.reasonCodes,
    t,
  );
  const activeAnalysis = analysis ?? viewModel.analysis;
  const analysisStatusLabel = t(`analysis:status.${activeAnalysis.status}`);
  const formattedWalletAddress = walletAddress ? formatWalletAddressLabel(walletAddress) : t("states.unavailableValue");
  const chartData = viewModel.chart.points.map((point) => ({
    label:
      viewModel.chart.range === "24h"
        ? new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(new Date(point.capturedAt))
        : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(point.capturedAt)),
    totalValueUsd: point.totalValueUsd,
    idleValueUsd: point.idleValueUsd,
  }));
  const totalDistributionUsd = viewModel.distribution.slices.reduce(
    (sum, slice) => sum + slice.valueUsd,
    0,
  );
  const navigationItems = getOverviewNavigationItems(activeAnalysis.status);
  const showAnalysisAction =
    activeAnalysis.status === "not_analyzed" ||
    activeAnalysis.status === "stale" ||
    activeAnalysis.status === "failed";
  const analysisActionLabel =
    activeAnalysis.status === "failed" ? t("analysis.actions.retry") : t("analysis.actions.start");
  const exclusionMessage = buildExclusionMessage(viewModel.metrics.exclusions, t, locale);
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

  return (
    <section data-overview-root>
      <ConnectedShell
        menuLabel={t("navigation:a11y.openMenu")}
        closeMenuLabel={t("navigation:a11y.closeMenu")}
        sidebar={
          <CabSidebar
            header={
              <CabStack gap="$3">
                <CabText variant="heading" fontSize={18}>
                  {t("title")}
                </CabText>
                <CabAnalysisStatusBadge
                  status={mapOverviewAnalysisStatusToBadgeStatus(activeAnalysis.status)}
                  label={analysisStatusLabel}
                />
              </CabStack>
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
                  {viewModel.summary.chainLabel} {chainId ? `(${chainId})` : ""}
                </CabText>
                <CabStack row alignItems="center" gap="$2">
                  <CabIcon name="activity" tone="muted" size="sm" />
                  <CabText variant="caption" fontSize={12}>
                    {t("summary.lastRefreshed")}
                  </CabText>
                </CabStack>
                <CabText variant="label">
                  {viewModel.summary.lastRefreshedAt
                    ? formatRelativeTime(viewModel.summary.lastRefreshedAt, locale)
                    : t("states.unavailableValue")}
                </CabText>
              </CabStack>
            </CabCard>
          </CabSidebar>
        }
        topBar={
          <CabTopNav title={t("title")}>
            <CabStack row gap="$2" flexWrap="wrap" alignItems="center">
              <CabRangeSelector
                options={rangeOptions}
                selectedKey={range}
                onSelect={(nextRange) => onRangeChange(nextRange as OverviewRange)}
              />
              <CabButton tone="secondary" onPress={onRefresh} disabled={isRefreshing}>
                {isRefreshing ? t("actions.refreshing") : t("actions.refresh")}
              </CabButton>
            </CabStack>
          </CabTopNav>
        }
      >
        <CabStack gap="$4">
          <CabCard density="spacious">
            <CabStack gap="$3">
              <CabSectionHeader
                title={t("analysis:title")}
                subtitle={t(`analysis:messages.${activeAnalysis.status}`)}
                actions={
                  <CabAnalysisStatusBadge
                    status={mapOverviewAnalysisStatusToBadgeStatus(activeAnalysis.status)}
                    label={analysisStatusLabel}
                  />
                }
              />
              {activeAnalysis.lastSuccessfulRunAt ? (
                <CabText variant="caption" fontSize={12}>
                  {t("analysis:lastSuccessfulRunAt", {
                    value: formatDateTime(activeAnalysis.lastSuccessfulRunAt, locale),
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
              {showAnalysisAction ? (
                <CabAnalysisCta
                  label={isStartingAnalysis ? t("analysis:actions.starting") : analysisActionLabel}
                  disabled={isStartingAnalysis}
                  onPress={onStartAnalysis}
                />
              ) : null}
            </CabStack>
          </CabCard>

          {viewModel.coverage.status === "partial" ? (
            <CabPartialCoverageNotice
              title={t("coverage:noticeTitle")}
              description={pageCoverageMessage}
            />
          ) : null}

          <CabDashboardGrid>
            <CabMetricCard
              label={t("metrics.netPortfolioValue")}
              value={formatCurrencyValue(viewModel.metrics.netPortfolioValueUsd, locale, t("states.unavailableValue"))}
              delta={viewModel.metrics.changeOverSelectedPeriodPct ?? undefined}
            />
            <CabMetricCard
              label={t("metrics.deployedValue")}
              value={formatCurrencyValue(viewModel.metrics.deployedValueUsd, locale, t("states.unavailableValue"))}
            />
            <CabMetricCard
              label={t("metrics.idleValue")}
              value={formatCurrencyValue(viewModel.metrics.idleValueUsd, locale, t("states.unavailableValue"))}
            />
          </CabDashboardGrid>
          {exclusionMessage ? (
            <CabText variant="caption" fontSize={12}>
              {exclusionMessage}
            </CabText>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
            }}
          >
            <CabAreaChart
              title={t("sections.chart")}
              subtitle={buildSourceSubtitle(
                viewModel.chart.source,
                viewModel.chart.coverageStatus,
                viewModel.chart.coverageReasonCodes,
                t,
              )}
              data={chartData}
              xKey="label"
              series={[{ key: "totalValueUsd", label: t("charts:series.netPortfolioValue") }]}
            />

            <CabCard density="spacious">
              <CabStack gap="$3">
                <CabSectionHeader
                  title={t("sections.distribution")}
                  subtitle={buildSourceSubtitle(
                    viewModel.distribution.source,
                    viewModel.distribution.coverageStatus,
                    viewModel.distribution.coverageReasonCodes,
                    t,
                  )}
                />
                {viewModel.distribution.slices.length === 0 ? (
                  <CabEmptyState
                    title={t("states.emptyDistributionTitle")}
                    description={t("states.emptyDistributionDescription")}
                  />
                ) : (
                  <CabStack gap="$2">
                    {viewModel.distribution.slices.map((slice) => (
                      <CabCard key={`${slice.dimension}-${slice.label}`} density="default">
                        <CabStack row justifyContent="space-between" alignItems="center">
                          <CabText variant="label">{slice.label}</CabText>
                          <CabStack alignItems="flex-end" gap="$1">
                            <CabText variant="label">{formatUsd(slice.valueUsd, locale)}</CabText>
                            <CabText variant="caption" fontSize={12}>
                              {totalDistributionUsd > 0
                                ? formatPercent(slice.valueUsd / totalDistributionUsd, locale)
                                : t("states.unavailableValue")}
                            </CabText>
                          </CabStack>
                        </CabStack>
                      </CabCard>
                    ))}
                  </CabStack>
                )}
                {viewModel.distribution.exclusions ? (
                  <CabText variant="caption" fontSize={12}>
                    {buildExclusionMessage(viewModel.distribution.exclusions, t, locale)}
                  </CabText>
                ) : null}
              </CabStack>
            </CabCard>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
            }}
          >
            <CabCard density="spacious">
              <CabStack gap="$3">
                <CabSectionHeader
                  title={t("sections.assets")}
                  subtitle={buildSourceSubtitle(
                    viewModel.assets.source,
                    viewModel.assets.coverageStatus,
                    viewModel.assets.coverageReasonCodes,
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
                  <CabEmptyState
                    title={t("assets.filteredEmptyTitle")}
                    description={t("assets.filteredEmptyDescription")}
                  />
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

            <CabCard density="spacious">
              <CabStack gap="$3">
                <CabSectionHeader
                  title={t("sections.activity")}
                  subtitle={buildSourceSubtitle(
                    viewModel.activity.source,
                    viewModel.activity.coverageStatus,
                    viewModel.activity.coverageReasonCodes,
                    t,
                  )}
                />
                {viewModel.activity.items.length === 0 ? (
                  <CabEmptyState
                    title={t("states.emptyActivityTitle")}
                    description={t("states.emptyActivityDescription")}
                  />
                ) : (
                  <CabStack gap="$2">
                    {viewModel.activity.items.map((item) => (
                      <CabCard key={item.id} density="default">
                        <CabStack row justifyContent="space-between" alignItems="center" gap="$3">
                          <CabStack gap="$1">
                            <CabText variant="label">{t(item.labelKey, { defaultValue: t("activity.unclassified") })}</CabText>
                            <CabText variant="caption" fontSize={12}>
                              {formatDateTime(item.occurredAt, locale)}
                            </CabText>
                          </CabStack>
                          <CabText variant="caption" fontSize={12} textAlign="right">
                            {item.txHash ? formatWalletAddressLabel(item.txHash) : t("states.unavailableValue")}
                          </CabText>
                        </CabStack>
                      </CabCard>
                    ))}
                  </CabStack>
                )}
              </CabStack>
            </CabCard>
          </div>

          <CabCard density="spacious">
            <CabSectionHeader
              title={t("summary.title")}
              subtitle={t(viewModel.summary.modeLabelKey)}
            />
            <CabStack row justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
              <CabText variant="label">
                {t("summary.wallet")}: {formattedWalletAddress}
              </CabText>
              <CabText variant="label">
                {t("summary.chain")}: {viewModel.summary.chainLabel}
              </CabText>
              <CabText variant="label">
                {t("summary.lastRefreshed")}: {viewModel.summary.lastRefreshedAt
                  ? formatRelativeTime(viewModel.summary.lastRefreshedAt, locale)
                  : t("states.unavailableValue")}
              </CabText>
            </CabStack>
          </CabCard>
        </CabStack>
      </ConnectedShell>
    </section>
  );
}