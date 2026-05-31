"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  CabBadge,
  CabButton,
  CabCard,
  CabCompositionRail,
  CabCoverageBadge,
  CabEyebrow,
  CabIcon,
  CabImpactMetricCard,
  CabRangeIndicator,
  CabSectionHeader,
  CabStack,
  CabText,
  CabTokenIcon,
  CabTokenPair,
  CabValueWithStatus,
} from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { formatWalletAddressLabel } from "@/features/overview/overview.mappers";
import type { OverviewViewModel } from "@/features/overview/overview.types";
import { formatDateTime, formatNumber, formatPercent, formatUsd } from "@/i18n/formatters";

import styles from "./ProtocolPositionsSection.module.css";

type ProtocolPositionsSectionProps = {
  protocolPositions: OverviewViewModel["protocolPositions"];
  sourceSubtitle: string;
  coverageMessage: string;
};

type ProtocolPositionRow = OverviewViewModel["protocolPositions"]["rows"][number];

type ProtocolPositionGroup = {
  key: string;
  label: string;
  rows: ProtocolPositionRow[];
  totalValueUsd: number | null;
  primaryTokenSymbol: string | null;
  secondaryTokenSymbol: string | null;
  feeTierLabel: string | null;
  coverageState: "full" | "share_level" | "partial" | "unknown";
  lpSplitUnits: number;
  strategySplitUnits: number;
};

const groupPalette = [
  cabColors.brand.signalTeal,
  cabColors.brand.electricBlue,
  cabColors.dataViz.violet,
  cabColors.brand.cabGold,
  cabColors.dataViz.emerald,
  cabColors.dataViz.mint,
];

function sumKnownUsd(values: Array<number | null | undefined>) {
  const knownValues = values.filter((value): value is number => typeof value === "number");

  if (knownValues.length === 0) {
    return null;
  }

  return knownValues.reduce((sum, value) => sum + value, 0);
}

function formatCurrencyValue(value: number | null, locale: string, fallbackLabel: string) {
  return value === null ? fallbackLabel : formatUsd(value, locale);
}

function buildPoolKey(row: ProtocolPositionRow) {
  if (row.poolLabel) {
    return `${row.poolLabel.toLowerCase()}::${row.metadata.feeTierLabel ?? "unknown"}`;
  }

  return row.positionKey;
}

function derivePairSymbols(row: ProtocolPositionRow) {
  if (row.primaryTokenSymbol || row.secondaryTokenSymbol) {
    return {
      primaryTokenSymbol: row.primaryTokenSymbol,
      secondaryTokenSymbol: row.secondaryTokenSymbol,
    };
  }

  if (row.poolLabel?.includes("/")) {
    const [primaryTokenSymbol, secondaryTokenSymbol] = row.poolLabel.split("/").map((value) => value.trim());

    return {
      primaryTokenSymbol: primaryTokenSymbol || null,
      secondaryTokenSymbol: secondaryTokenSymbol || null,
    };
  }

  return {
    primaryTokenSymbol: null,
    secondaryTokenSymbol: null,
  };
}

function buildGroupCoverageState(rows: ProtocolPositionRow[]): ProtocolPositionGroup["coverageState"] {
  if (rows.some((row) => row.coverageStatus === "unknown")) {
    return "unknown";
  }

  if (rows.some((row) => row.coverageStatus === "partial")) {
    return "partial";
  }

  if (rows.some((row) => row.coverageStatus === "share_level")) {
    return "share_level";
  }

  return "full";
}

function buildExposureSplit(rows: ProtocolPositionRow[]) {
  const lpRows = rows.filter((row) => row.family === "manual_deposit" || row.family === "staked_lp");
  const strategyRows = rows.filter((row) => row.family === "strategy_exposure");
  const valueEligibleRows = [...lpRows, ...strategyRows];
  const canUseValueSplit = valueEligibleRows.length > 0 && valueEligibleRows.every((row) => row.valueUsd !== null);

  if (canUseValueSplit) {
    return {
      lpSplitUnits: lpRows.reduce((total, row) => total + (row.valueUsd ?? 0), 0),
      strategySplitUnits: strategyRows.reduce((total, row) => total + (row.valueUsd ?? 0), 0),
    };
  }

  return {
    lpSplitUnits: lpRows.length,
    strategySplitUnits: strategyRows.length,
  };
}

function groupProtocolPositionRows(rows: ProtocolPositionRow[]) {
  const groups = new Map<string, ProtocolPositionRow[]>();

  for (const row of rows) {
    const key = buildPoolKey(row);
    const existingRows = groups.get(key);

    if (existingRows) {
      existingRows.push(row);
      continue;
    }

    groups.set(key, [row]);
  }

  return Array.from(groups.entries())
    .map(([key, groupedRows]): ProtocolPositionGroup => {
      const anchorRow = groupedRows[0];
      const { primaryTokenSymbol, secondaryTokenSymbol } = derivePairSymbols(anchorRow);
      const { lpSplitUnits, strategySplitUnits } = buildExposureSplit(groupedRows);

      return {
        key,
        label: anchorRow.poolLabel ?? anchorRow.label,
        rows: groupedRows,
        totalValueUsd: sumKnownUsd(groupedRows.map((row) => row.valueUsd)),
        primaryTokenSymbol,
        secondaryTokenSymbol,
        feeTierLabel: anchorRow.metadata.feeTierLabel,
        coverageState: buildGroupCoverageState(groupedRows),
        lpSplitUnits,
        strategySplitUnits,
      };
    })
    .sort((left, right) => {
      const leftValue = left.totalValueUsd ?? -1;
      const rightValue = right.totalValueUsd ?? -1;

      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return left.label.localeCompare(right.label);
    });
}

function getCopyReference(row: ProtocolPositionRow) {
  return row.tokenId ?? row.metadata.positionContractAddress ?? row.metadata.wrapperAddress ?? row.positionKey;
}

function getReferenceLabel(row: ProtocolPositionRow, translate: (key: string, options?: Record<string, unknown>) => string) {
  if (row.tokenId) {
    return translate("protocolPositions.accordionTokenId", { value: row.tokenId });
  }

  if (row.metadata.positionContractAddress) {
    return formatWalletAddressLabel(row.metadata.positionContractAddress);
  }

  if (row.metadata.wrapperAddress) {
    return formatWalletAddressLabel(row.metadata.wrapperAddress);
  }

  return row.label;
}

function getReferenceSubline(row: ProtocolPositionRow) {
  if (!row.tokenId) {
    return null;
  }

  if (row.metadata.positionContractAddress) {
    return formatWalletAddressLabel(row.metadata.positionContractAddress);
  }

  if (row.metadata.wrapperAddress) {
    return formatWalletAddressLabel(row.metadata.wrapperAddress);
  }

  return null;
}

function getRangeStatus(row: ProtocolPositionRow) {
  if (row.metadata.isInRange === true) {
    return "active" as const;
  }

  if (row.metadata.isInRange === false) {
    return "inactive" as const;
  }

  return "unknown" as const;
}

function getRangeMarkerRatio(row: ProtocolPositionRow) {
  if (
    row.metadata.currentTick !== null &&
    row.metadata.rangeLowerTick !== null &&
    row.metadata.rangeUpperTick !== null &&
    row.metadata.rangeUpperTick !== row.metadata.rangeLowerTick
  ) {
    return (row.metadata.currentTick - row.metadata.rangeLowerTick) /
      (row.metadata.rangeUpperTick - row.metadata.rangeLowerTick);
  }

  return 0.5;
}

function getPositionTone(row: ProtocolPositionRow) {
  switch (row.family) {
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

function getValueTone(row: ProtocolPositionRow) {
  if (row.valueUsd === null || row.valueStatus === "unavailable") {
    return "unavailable" as const;
  }

  if (row.valueStatus === "estimated") {
    return "estimated" as const;
  }

  if (row.coverageStatus === "partial" || row.coverageStatus === "share_level") {
    return "partial" as const;
  }

  return "current" as const;
}

function buildUnderlyingAssets(row: ProtocolPositionRow) {
  return [
    row.primaryTokenSymbol && row.primaryTokenAmount !== null
      ? {
          symbol: row.primaryTokenSymbol,
          amount: row.primaryTokenAmount,
        }
      : null,
    row.secondaryTokenSymbol && row.secondaryTokenAmount !== null
      ? {
          symbol: row.secondaryTokenSymbol,
          amount: row.secondaryTokenAmount,
        }
      : null,
  ].filter((value): value is { symbol: string; amount: number } => Boolean(value));
}

function formatProtocolTokenAmount(amount: number, locale: string) {
  const maximumFractionDigits = amount >= 1_000 ? 2 : amount >= 1 ? 4 : 6;

  return formatNumber(amount, locale, {
    maximumFractionDigits,
  });
}

export function ProtocolPositionsSection({
  protocolPositions,
  sourceSubtitle,
  coverageMessage,
}: ProtocolPositionsSectionProps) {
  const { t, i18n } = useTranslation(["overview", "coverage"]);
  const locale = i18n.language;
  const [copiedReferenceKey, setCopiedReferenceKey] = useState<string | null>(null);
  const groupedRows = groupProtocolPositionRows(protocolPositions.rows);
  const totalProtocolValueUsd = sumKnownUsd(protocolPositions.rows.map((row) => row.valueUsd));
  const strategyExposureCount = protocolPositions.summary.familyCounts.strategyExposure;
  const poolsCoveredCount = groupedRows.length;
  const summaryChips = [
    t("protocolPositions.summary.totalCount", { count: protocolPositions.summary.totalCount }),
    strategyExposureCount > 0
      ? t("protocolPositions.summary.strategyExposureCount", { count: strategyExposureCount })
      : null,
    protocolPositions.coverageStatus === "partial" || protocolPositions.summary.hasPartialValuation
      ? t("coverage:status.partial")
      : null,
  ].filter((value): value is string => Boolean(value));

  const distributionSegments = groupedRows
    .filter((group) => group.totalValueUsd !== null && group.totalValueUsd > 0)
    .map((group, index) => ({
      id: group.key,
      value: group.totalValueUsd ?? 0,
      color: groupPalette[index % groupPalette.length],
      label: group.label,
      accessibleLabel: group.label,
    }));

  async function handleCopyReference(row: ProtocolPositionRow) {
    const reference = getCopyReference(row);

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(reference);
      setCopiedReferenceKey(row.positionKey);
      window.setTimeout(() => {
        setCopiedReferenceKey((currentValue) => (currentValue === row.positionKey ? null : currentValue));
      }, 1200);
    } catch {
      // Ignore clipboard failures and keep the reference selectable.
    }
  }

  if (protocolPositions.rows.length === 0) {
    return (
      <CabCard density="spacious">
        <CabStack gap="$3">
          <CabSectionHeader
            title={t("sections.protocolPositions")}
            subtitle={sourceSubtitle}
          />
          <CabText variant="caption" fontSize={12}>
            {coverageMessage}
          </CabText>
          <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
            {t("protocolPositions.emptyDescription")}
          </CabText>
        </CabStack>
      </CabCard>
    );
  }

  return (
    <CabCard density="spacious">
      <div className={styles.root}>
        <div className={styles.headerBlock}>
          <CabSectionHeader
            title={t("sections.protocolPositions")}
            subtitle={sourceSubtitle}
          />
          <div className={styles.headerMeta}>
            <div className={styles.summaryChips}>
              {summaryChips.map((chip) => (
                <CabBadge
                  key={chip}
                  tone={chip === t("coverage:status.partial") ? "warning" : "neutral"}
                  size="sm"
                >
                  {chip}
                </CabBadge>
              ))}
            </div>
            <CabText variant="caption" fontSize={12} color={cabColors.text.secondary} className={styles.headerCoverage}>
              {coverageMessage}
            </CabText>
          </div>
        </div>

        <div className={styles.summaryZone}>
          <div className={styles.summaryMetricsGrid}>
            <CabImpactMetricCard
              label={t("protocolPositions.metrics.totalProtocolValue")}
              value={formatCurrencyValue(totalProtocolValueUsd, locale, t("states.unavailableValue"))}
              iconName="coins"
              accentColor={cabColors.brand.signalTeal}
              size="compact"
            />
            <CabImpactMetricCard
              label={t("protocolPositions.metrics.positionsDetected")}
              value={formatNumber(protocolPositions.summary.totalCount, locale)}
              iconName="radar"
              accentColor={cabColors.brand.electricBlue}
              size="compact"
            />
            <CabImpactMetricCard
              label={t("protocolPositions.metrics.strategyExposures")}
              value={formatNumber(strategyExposureCount, locale)}
              iconName="strategies"
              accentColor={cabColors.dataViz.violet}
              size="compact"
            />
            <CabImpactMetricCard
              label={t("protocolPositions.metrics.poolsCovered")}
              value={formatNumber(poolsCoveredCount, locale)}
              iconName="pools"
              accentColor={cabColors.brand.cabGold}
              size="compact"
            />
          </div>

          <CabCard density="default">
            <div className={styles.distributionShell}>
              <div className={styles.distributionHeader}>
                <CabEyebrow tone="secondary">{t("protocolPositions.metrics.distributionByPool")}</CabEyebrow>
                <CabText variant="label" className={styles.distributionHeaderValue}>
                  {formatCurrencyValue(totalProtocolValueUsd, locale, t("states.unavailableValue"))}
                </CabText>
              </div>

              <CabCompositionRail
                ariaLabel={t("protocolPositions.metrics.distributionByPool")}
                locale={locale}
                segments={distributionSegments}
                size="md"
                showInlinePercent
              />

              <div className={styles.distributionLegend}>
                {groupedRows.map((group, index) => (
                  <div key={group.key} className={styles.distributionLegendItem}>
                    <CabTokenPair
                      primary={{ chainId: group.rows[0]?.chainId, symbol: group.primaryTokenSymbol ?? group.label }}
                      secondary={group.secondaryTokenSymbol
                        ? { chainId: group.rows[0]?.chainId, symbol: group.secondaryTokenSymbol }
                        : undefined}
                      size="sm"
                    />
                    <CabText variant="caption" fontSize={12} color={groupPalette[index % groupPalette.length]}>
                      {formatCurrencyValue(group.totalValueUsd, locale, t("states.unavailableValue"))}
                    </CabText>
                  </div>
                ))}
              </div>
            </div>
          </CabCard>
        </div>

        <div className={styles.groups}>
          {groupedRows.map((group) => {
            const splitTotal = group.lpSplitUnits + group.strategySplitUnits;
            const lpRatio = splitTotal > 0 ? group.lpSplitUnits / splitTotal : 0;
            const strategyRatio = splitTotal > 0 ? group.strategySplitUnits / splitTotal : 0;
            const coverageLabel = t(`protocolPositions.coverageStatus.${group.coverageState}`);

            return (
              <CabCard key={group.key} density="default">
                <div className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <div className={styles.groupHeaderTop}>
                      <div className={styles.groupIdentity}>
                        {group.primaryTokenSymbol ? (
                          <CabTokenPair
                            primary={{ chainId: group.rows[0]?.chainId, symbol: group.primaryTokenSymbol }}
                            secondary={group.secondaryTokenSymbol
                              ? { chainId: group.rows[0]?.chainId, symbol: group.secondaryTokenSymbol }
                              : undefined}
                            feeTierLabel={group.feeTierLabel ?? undefined}
                            size="lg"
                          />
                        ) : (
                          <CabText variant="label">{group.label}</CabText>
                        )}
                        <div className={styles.groupMetaRow}>
                          <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                            {t("protocolPositions.poolGroupCount", { count: group.rows.length })}
                          </CabText>
                          {group.coverageState !== "full" ? (
                            <CabCoverageBadge state={group.coverageState} label={coverageLabel} />
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.groupValue}>
                        <CabText variant="label">
                          {formatCurrencyValue(group.totalValueUsd, locale, t("states.unavailableValue"))}
                        </CabText>
                        <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                          {group.label}
                        </CabText>
                      </div>
                    </div>

                    <div className={styles.groupSplit}>
                      <div className={styles.groupSplitLabels}>
                        <div className={styles.groupSplitLabelStart}>
                          <CabText variant="caption" fontSize={12} color={cabColors.brand.signalTeal}>
                            {`${formatPercent(lpRatio, locale)} ${t("protocolPositions.metrics.lpExposure")}`}
                          </CabText>
                        </div>
                        <div className={styles.groupSplitLabelEnd}>
                          <CabText variant="caption" fontSize={12} color={cabColors.dataViz.violet}>
                            {`${formatPercent(strategyRatio, locale)} ${t("protocolPositions.metrics.strategyExposure")}`}
                          </CabText>
                        </div>
                      </div>
                      <CabCompositionRail
                        ariaLabel={t("protocolPositions.metrics.groupExposureAria", { pool: group.label })}
                        locale={locale}
                        size="sm"
                        segments={[
                          {
                            id: `${group.key}-lp`,
                            value: group.lpSplitUnits,
                            color: cabColors.brand.signalTeal,
                            label: t("protocolPositions.metrics.lpExposure"),
                          },
                          {
                            id: `${group.key}-strategy`,
                            value: group.strategySplitUnits,
                            color: cabColors.dataViz.violet,
                            label: t("protocolPositions.metrics.strategyExposure"),
                          },
                        ]}
                      />
                    </div>
                  </div>

                  <div className={styles.rowList}>
                    {group.rows.map((row) => {
                      const underlyingAssets = buildUnderlyingAssets(row);
                      const rangeStatus = getRangeStatus(row);
                      const referenceSubline = getReferenceSubline(row);
                      const copyActionLabel = copiedReferenceKey === row.positionKey
                        ? t("protocolPositions.actions.copied")
                        : t("protocolPositions.actions.copyReference");
                      const coverageReasonsTitle = row.coverageReasonCodes.length > 0
                        ? row.coverageReasonCodes.map((reasonCode) => t(`coverage:reasons.${reasonCode}`)).join(" · ")
                        : undefined;

                      return (
                        <div key={row.positionKey} className={styles.row}>
                          <div className={styles.rowGrid}>
                            <div className={styles.cell}>
                              <CabEyebrow>{t("protocolPositions.columns.idToken")}</CabEyebrow>
                              <div className={styles.tokenReference}>
                                <CabText variant="label" className={styles.tokenReferenceLabel}>
                                  {getReferenceLabel(row, t)}
                                </CabText>
                                <CabButton
                                  aria-label={copyActionLabel}
                                  tone="ghost"
                                  controlSize="sm"
                                  onPress={() => void handleCopyReference(row)}
                                  className={styles.copyButton}
                                >
                                  <CabIcon name="copy" size="sm" tone={copiedReferenceKey === row.positionKey ? "signal" : "muted"} />
                                </CabButton>
                              </div>
                              <div className={styles.tokenReferenceSubline}>
                                {referenceSubline ? (
                                  <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>
                                    {referenceSubline}
                                  </CabText>
                                ) : null}
                                {copiedReferenceKey === row.positionKey ? (
                                  <CabText variant="caption" fontSize={11} color={cabColors.brand.signalTeal}>
                                    {t("protocolPositions.actions.copied")}
                                  </CabText>
                                ) : null}
                              </div>
                            </div>

                            <div className={styles.cell}>
                              <CabEyebrow>{t("protocolPositions.columns.type")}</CabEyebrow>
                              <div className={styles.typeCell}>
                                <div className={styles.typeBadges}>
                                  <CabBadge tone={getPositionTone(row)} size="sm">
                                    {t(`protocolPositions.families.${row.family}`)}
                                  </CabBadge>
                                  {row.status !== "unknown" ? (
                                    <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>
                                      {t(`protocolPositions.positionStatus.${row.status}`)}
                                    </CabText>
                                  ) : null}
                                </div>
                                {row.strategyLabel || row.governanceLabel ? (
                                  <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>
                                    {row.strategyLabel ?? row.governanceLabel}
                                  </CabText>
                                ) : null}
                              </div>
                            </div>

                            <div className={styles.cell}>
                              <CabEyebrow>{t("protocolPositions.columns.range")}</CabEyebrow>
                              {row.metadata.rangeLowerPrice !== null &&
                              row.metadata.rangeUpperPrice !== null &&
                              row.metadata.rangeQuoteTokenSymbol ? (
                                <CabRangeIndicator
                                  lower={row.metadata.rangeLowerPrice}
                                  upper={row.metadata.rangeUpperPrice}
                                  locale={locale}
                                  quoteSymbol={row.metadata.rangeQuoteTokenSymbol}
                                  fractionDigits={row.metadata.rangeDisplayFractionDigits}
                                  markerRatio={getRangeMarkerRatio(row)}
                                  status={rangeStatus}
                                  statusLabel={t(`protocolPositions.rangeStatus.${rangeStatus}`)}
                                />
                              ) : row.metadata.lockEndAt ? (
                                <CabText variant="caption" fontSize={12} className={styles.rangeFallback}>
                                  {t("protocolPositions.lockEndAt", { value: formatDateTime(row.metadata.lockEndAt, locale) })}
                                </CabText>
                              ) : (
                                <CabText variant="caption" fontSize={12} className={styles.rangeFallback}>
                                  {t("protocolPositions.metadataUnavailable")}
                                </CabText>
                              )}
                            </div>

                            <div className={styles.cell}>
                              <CabEyebrow>{t("protocolPositions.columns.underlying")}</CabEyebrow>
                              {underlyingAssets.length > 0 ? (
                                <div className={styles.underlyingList}>
                                  {underlyingAssets.map((asset) => (
                                    <div key={`${row.positionKey}-${asset.symbol}`} className={styles.underlyingItem}>
                                      <CabTokenIcon chainId={row.chainId} symbol={asset.symbol} size="sm" decorative />
                                      <div className={styles.underlyingAmount}>
                                        <CabText variant="label">{asset.symbol}</CabText>
                                        <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>
                                          {formatProtocolTokenAmount(asset.amount, locale)}
                                        </CabText>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <CabText variant="caption" fontSize={12} className={styles.secondaryText}>
                                  {t("protocolPositions.metadataUnavailable")}
                                </CabText>
                              )}
                            </div>

                            <div className={styles.cell}>
                              <CabEyebrow>{t("protocolPositions.columns.value")}</CabEyebrow>
                              <CabValueWithStatus
                                value={row.valueUsd}
                                locale={locale}
                                statusLabel={t(`protocolPositions.valueStatus.${row.valueStatus}`)}
                                tone={getValueTone(row)}
                                fallbackLabel={t("states.unavailableValue")}
                              />
                            </div>

                            <div className={styles.cell} title={coverageReasonsTitle}>
                              <CabEyebrow>{t("protocolPositions.columns.coverage")}</CabEyebrow>
                              <div className={styles.coverageCell}>
                                <CabCoverageBadge
                                  state={row.coverageStatus}
                                  label={t(`protocolPositions.coverageStatus.${row.coverageStatus}`)}
                                />
                              </div>
                            </div>

                            <div className={styles.cell}>
                              <CabEyebrow>{t("protocolPositions.columns.updated")}</CabEyebrow>
                              <CabText variant="caption" fontSize={12} className={styles.updatedText}>
                                {row.valueUpdatedAt
                                  ? formatDateTime(row.valueUpdatedAt, locale)
                                  : t("states.unavailableValue")}
                              </CabText>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CabCard>
            );
          })}
        </div>

        <div className={styles.footer}>
          {protocolPositions.summary.hasShareLevelPositions ? (
            <div className={styles.footerNote}>
              <CabIcon name="info" tone="muted" size="sm" />
              <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                {t("protocolPositions.shareLevelNotice")}
              </CabText>
            </div>
          ) : null}

          {protocolPositions.coverageReasonCodes?.includes("recentProtocolReconstruction") ? (
            <div className={styles.footerNote}>
              <CabIcon name="warning" tone="warning" size="sm" />
              <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                {t("protocolPositions.reconstructionNotice")}
              </CabText>
            </div>
          ) : null}

          {protocolPositions.summary.lastRefreshedAt ? (
            <div className={`${styles.footerNote} ${styles.footerRefresh}`}>
              <CabIcon name="refreshCcw" tone="muted" size="sm" />
              <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                {t("protocolPositions.lastRefreshedAt", {
                  value: formatDateTime(protocolPositions.summary.lastRefreshedAt, locale),
                })}
              </CabText>
            </div>
          ) : null}
        </div>
      </div>
    </CabCard>
  );
}
