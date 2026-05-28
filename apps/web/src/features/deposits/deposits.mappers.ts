import type {
  DepositConfidence,
  DepositCoverageStatus,
  DepositDetailResponse,
  DepositDetailView,
  DepositLifecycleEventView,
  DepositLifecycleTokenDelta,
  DepositPriceSource,
  DepositSummaryView,
  DepositsListResponse,
} from "@/features/deposits/deposits.types";
import {
  formatDate,
  formatDayRange,
  formatPercent,
  formatSignedPercent,
  formatSignedUsd,
  formatTokenAmount,
  formatUsd,
} from "@/i18n/formatters";

export type DepositSummaryRowViewModel = DepositSummaryView & {
  totalReturnSign: "positive" | "negative" | "neutral";
};

export type DepositsListViewModel = {
  analysisStatus: DepositsListResponse["analysisStatus"];
  summary: DepositsListResponse["summary"];
  coveredRange: DepositsListResponse["coveredRange"];
  page: DepositsListResponse["page"];
  items: DepositSummaryRowViewModel[];
};

type DepositBadgeTone = "success" | "warning" | "info" | "neutral" | "danger";

export type DepositDetailSecondaryStatViewModel = {
  key: string;
  label: string;
  value: string;
  tone?: DepositBadgeTone;
  emphasized?: boolean;
};

export type DepositRangeViewModel = {
  title: string;
  lowerLabel: string;
  upperLabel: string;
  stateLabel: string;
  stateTone: "success" | "warning" | "neutral";
};

export type DepositLifecycleTokenDeltaViewModel = {
  key: string;
  tokenLabel: string;
  directionLabel: string;
  amountLabel: string;
  usdValueLabel: string;
  priceSourceLabel: string | null;
  priceSourceTone: DepositBadgeTone | null;
};

export type DepositLifecycleEventViewModel = {
  id: string;
  title: string;
  occurredAtLabel: string;
  usdValueLabel: string;
  priceSourceLabel: string | null;
  priceSourceTone: DepositBadgeTone | null;
  confidenceLabel: string;
  confidenceTone: DepositBadgeTone;
  coverageReasonLabels: string[];
  movements: DepositLifecycleTokenDeltaViewModel[];
};

export type DepositDecompositionRowViewModel = {
  key: string;
  label: string;
  valueUsd: number;
  valueLabel: string;
  shareLabel: string;
  barPercent: number;
  tone: DepositBadgeTone;
  tooltipLabel: string | null;
};

export type DepositPerformanceDecompositionViewModel = {
  title: string;
  attributionTitle: string;
  flowTitle: string;
  flowContextLabel: string;
  capitalEnteredLabel: string;
  capitalEnteredValue: string;
  capitalEnteredTooltipLabel: string | null;
  capitalWithdrawnLabel: string;
  capitalWithdrawnValue: string;
  capitalWithdrawnTooltipLabel: string | null;
  totalReturnLabel: string;
  totalReturnValue: string;
  estAnnualizedReturnLabel: string;
  estAnnualizedReturnValue: string;
  rows: DepositDecompositionRowViewModel[];
};

export type DepositDetailViewModel = {
  header: {
    title: string;
    subtitle: string;
    statusLabel: string;
    tokenIdLabel: string | null;
  };
  actions: {
    viewInExplorerLabel: string;
    closeLabel: string;
  };
  kpis: {
    currentValueLabel: string;
    currentValueValue: string;
    totalReturnLabel: string;
    totalReturnValue: string;
    totalReturnMeta: string | null;
  };
  secondaryStatsTitle: string;
  secondaryStats: DepositDetailSecondaryStatViewModel[];
  coveredRange: {
    title: string;
    value: string;
    hint: string | null;
  };
  range: DepositRangeViewModel | null;
  valueChart: DepositDetailResponse["valueChart"];
  valueChartCopy: {
    title: string;
    gapTitle: string;
    gapDescription: string;
  };
  lifecycle: {
    title: string;
    emptyLabel: string;
    movementLabels: {
      token: string;
      direction: string;
      amount: string;
      usdValue: string;
      priceSource: string;
    };
    events: DepositLifecycleEventViewModel[];
  };
  decomposition: DepositPerformanceDecompositionViewModel;
  strategyCrossLink: {
    title: string;
    description: string;
    actionLabel: string;
    strategyId: string;
  } | null;
};

export function getDepositCoverageLabelKey(coverageStatus: DepositCoverageStatus) {
  return `coverage:level.${coverageStatus}`;
}

export function getDepositConfidenceLabelKey(confidence: DepositConfidence) {
  return `coverage:confidence.${confidence}`;
}

export function getDepositCoverageReasonLabelKey(reasonCode: string) {
  return `coverage:reasons.${reasonCode}`;
}

export function getDepositUnattributedReasonLabelKey(reasonCode: string) {
  return `deposits:unattributed.reasonCodes.${reasonCode}`;
}

export function mapDepositUnattributedReasonLabels(input: {
  reasonCodes: string[];
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return input.reasonCodes.map((reasonCode) => input.translate(
    getDepositUnattributedReasonLabelKey(reasonCode),
    {
      defaultValue: input.translate(getDepositCoverageReasonLabelKey(reasonCode), {
        defaultValue: reasonCode,
      }),
    },
  ));
}

function resolveSign(value: number): DepositSummaryRowViewModel["totalReturnSign"] {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function toneForConfidence(confidence: DepositConfidence): DepositBadgeTone {
  switch (confidence) {
    case "high":
      return "success";
    case "medium":
      return "info";
    case "degraded":
      return "warning";
    default:
      return "neutral";
  }
}

function toneForCoverage(coverageStatus: DepositCoverageStatus): DepositBadgeTone {
  switch (coverageStatus) {
    case "full":
      return "success";
    case "share_level":
      return "info";
    case "partial":
      return "warning";
    default:
      return "neutral";
  }
}

function toneForPriceSource(priceSource: DepositPriceSource | null): DepositBadgeTone | null {
  switch (priceSource) {
    case "event":
      return "success";
    case "pricePointFallback":
      return "warning";
    case "unavailable":
      return "danger";
    default:
      return null;
  }
}

function toneForDecompositionValue(key: string, valueUsd: number): DepositBadgeTone {
  if (key === "unattributedUsd") {
    return "warning";
  }
  if (valueUsd > 0) {
    return "success";
  }
  if (valueUsd < 0) {
    return "danger";
  }
  return "neutral";
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatRangeValue(value: number | null, tokenSymbol: string | null, locale: string) {
  if (value === null) {
    return "—";
  }

  const amount = formatTokenAmount(value, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: value >= 100 ? 2 : 6,
  });

  return tokenSymbol ? `${amount} ${tokenSymbol}` : amount;
}

function shouldShowShorterCoveredRangeHint(response: DepositDetailResponse) {
  return response.coveredRange.startDayUtc !== response.deposit.coveredStartDayUtc
    || response.coveredRange.endDayUtc !== response.deposit.coveredEndDayUtc;
}

function mapDepositLifecycleMovementViewModel(
  movement: DepositLifecycleTokenDelta,
  locale: string,
  translate: (key: string, options?: { defaultValue?: string }) => string,
): DepositLifecycleTokenDeltaViewModel {
  return {
    key: `${movement.tokenAddress ?? "unknown"}:${movement.direction}:${movement.amountRaw}`,
    tokenLabel: movement.symbol ?? movement.tokenAddress ?? "—",
    directionLabel: movement.direction === "in" ? "In" : "Out",
    amountLabel: movement.amountFormatted ?? movement.amountRaw,
    usdValueLabel: movement.usdValue === null ? "—" : formatSignedUsd(movement.usdValue, locale),
    priceSourceLabel: movement.priceSource
      ? translate(`deposits:detail.movements.priceSourceValues.${movement.priceSource}`, {
          defaultValue: movement.priceSource,
        })
      : null,
    priceSourceTone: toneForPriceSource(movement.priceSource),
  };
}

function buildTooltipLabel(parts: Array<string | null>) {
  const values = parts.filter((part): part is string => Boolean(part && part.trim().length > 0));
  return values.length > 0 ? values.join(" • ") : null;
}

function formatLifecycleEventTooltipLine(input: {
  event: DepositLifecycleEventView;
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return buildTooltipLabel([
    input.translate(`deposits:events.${input.event.eventType}`, {
      defaultValue: input.event.eventType,
    }),
    formatDate(input.event.occurredAt, input.locale),
    input.event.usdValue === null ? null : formatSignedUsd(input.event.usdValue, input.locale),
    input.event.priceSource
      ? input.translate(`deposits:detail.movements.priceSourceValues.${input.event.priceSource}`, {
          defaultValue: input.event.priceSource,
        })
      : null,
  ]);
}

function buildFlowTooltipLabel(input: {
  events: DepositLifecycleEventView[];
  eventTypes: DepositLifecycleEventView["eventType"][];
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const lines = input.events
    .filter((event) => input.eventTypes.includes(event.eventType))
    .map((event) => formatLifecycleEventTooltipLine({
      event,
      locale: input.locale,
      translate: input.translate,
    }))
    .filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join("\n") : null;
}

function buildRebalanceTooltipLabel(input: {
  events: DepositLifecycleEventView[];
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const lines = input.events
    .map((event) => {
      const rebalanceEffectUsd = asFiniteNumber(event.metadata.rebalanceEffectUsd);
      if (rebalanceEffectUsd === null) {
        return null;
      }

      const hodlBenchmarkUsd = asFiniteNumber(event.metadata.hodlBenchmarkUsd);
      const withdrawalValueUsd = asFiniteNumber(event.metadata.withdrawalValueUsd);
      const fallbackReasonLabel = event.coverageReasonCodes.includes("priceFallbackDca")
        ? input.translate(getDepositCoverageReasonLabelKey("priceFallbackDca"), {
            defaultValue: "priceFallbackDca",
          })
        : null;

      return buildTooltipLabel([
        input.translate(`deposits:events.${event.eventType}`, {
          defaultValue: event.eventType,
        }),
        formatDate(event.occurredAt, input.locale),
        formatSignedUsd(rebalanceEffectUsd, input.locale),
        hodlBenchmarkUsd === null || withdrawalValueUsd === null
          ? null
          : `${formatUsd(hodlBenchmarkUsd, input.locale)} → ${formatUsd(withdrawalValueUsd, input.locale)}`,
        event.priceSource
          ? input.translate(`deposits:detail.movements.priceSourceValues.${event.priceSource}`, {
              defaultValue: event.priceSource,
            })
          : null,
        fallbackReasonLabel,
      ]);
    })
    .filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join("\n") : null;
}

export function mapDepositLifecycleEventsToViewModel(input: {
  events: DepositLifecycleEventView[];
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return input.events.map((event) => ({
    id: event.id,
    title: input.translate(`deposits:events.${event.eventType}`, { defaultValue: event.eventType }),
    occurredAtLabel: formatDate(event.occurredAt, input.locale),
    usdValueLabel: event.usdValue === null ? "—" : formatSignedUsd(event.usdValue, input.locale),
    priceSourceLabel: event.priceSource
      ? input.translate(`deposits:detail.movements.priceSourceValues.${event.priceSource}`, {
          defaultValue: event.priceSource,
        })
      : null,
    priceSourceTone: toneForPriceSource(event.priceSource),
    confidenceLabel: input.translate(getDepositConfidenceLabelKey(event.confidence), {
      defaultValue: event.confidence,
    }),
    confidenceTone: toneForConfidence(event.confidence),
    coverageReasonLabels: event.coverageReasonCodes.map((reasonCode) =>
      input.translate(getDepositCoverageReasonLabelKey(reasonCode), {
        defaultValue: reasonCode,
      }),
    ),
    movements: event.signedTokenDeltas.map((movement) =>
      mapDepositLifecycleMovementViewModel(movement, input.locale, input.translate),
    ),
  }));
}

export function mapDepositDecompositionToViewModel(input: {
  deposit: DepositDetailView;
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}): DepositPerformanceDecompositionViewModel {
  const { decomposition } = input.deposit;
  const rows = [
    ["rewardsUsd", decomposition.rewardsUsd],
    ["feesUsd", decomposition.feesUsd],
    ["assetPriceEffectUsd", decomposition.assetPriceEffectUsd],
    ["rebalanceEffectUsd", decomposition.rebalanceEffectUsd],
    ["realizedPnlUsd", decomposition.realizedPnlUsd],
    ["unrealizedPnlUsd", decomposition.unrealizedPnlUsd],
    ["unattributedUsd", decomposition.unattributedUsd],
  ] as const;
  const maxMagnitude = Math.max(
    1,
    Math.abs(decomposition.totalReturnUsd),
    ...rows.map(([, value]) => Math.abs(value)),
  );
  const totalReturnAbs = Math.abs(decomposition.totalReturnUsd);
  const unattributedReasonLabels = mapDepositUnattributedReasonLabels({
    reasonCodes: decomposition.unattributedReasonCodes,
    translate: input.translate,
  });
  const capitalEnteredTooltipLabel = buildFlowTooltipLabel({
    events: input.deposit.lifecycle,
    eventTypes: ["mint_position", "increase_liquidity", "transfer_in"],
    locale: input.locale,
    translate: input.translate,
  });
  const capitalWithdrawnTooltipLabel = buildFlowTooltipLabel({
    events: input.deposit.lifecycle,
    eventTypes: ["decrease_liquidity", "withdraw", "close", "burn"],
    locale: input.locale,
    translate: input.translate,
  });
  const rebalanceTooltipLabel = buildRebalanceTooltipLabel({
    events: input.deposit.lifecycle,
    locale: input.locale,
    translate: input.translate,
  });

  return {
    title: input.translate("deposits:detail.decomposition.title", {
      defaultValue: "Performance decomposition",
    }),
    attributionTitle: input.translate("deposits:detail.decomposition.attribution.title", {
      defaultValue: "Return attribution",
    }),
    flowTitle: input.translate("deposits:detail.decomposition.flow.title", {
      defaultValue: "Capital flow",
    }),
    flowContextLabel: input.translate("deposits:detail.decomposition.flow.context", {
      defaultValue: "Flow context",
    }),
    capitalEnteredLabel: input.translate("deposits:detail.decomposition.flow.entered", {
      defaultValue: "Capital entered",
    }),
    capitalEnteredValue: formatUsd(input.deposit.capitalEnteredUsd, input.locale),
    capitalEnteredTooltipLabel,
    capitalWithdrawnLabel: input.translate("deposits:detail.decomposition.flow.withdrawn", {
      defaultValue: "Capital withdrawn",
    }),
    capitalWithdrawnValue: formatUsd(input.deposit.capitalWithdrawnUsd, input.locale),
    capitalWithdrawnTooltipLabel,
    totalReturnLabel: input.translate("deposits:detail.decomposition.totalReturn", {
      defaultValue: "Total return",
    }),
    totalReturnValue: formatSignedUsd(decomposition.totalReturnUsd, input.locale),
    estAnnualizedReturnLabel: input.translate("deposits:detail.decomposition.estAnnualizedReturn", {
      defaultValue: "Est. annualized return",
    }),
    estAnnualizedReturnValue: input.deposit.estimatedAnnualizedReturnPct === null
      ? "—"
      : formatSignedPercent(input.deposit.estimatedAnnualizedReturnPct, input.locale),
    rows: rows.map(([key, value]) => ({
      key,
      label: input.translate(`deposits:detail.decomposition.components.${key.replace(/Usd$/, "")}`, {
        defaultValue: key,
      }),
      valueUsd: value,
      valueLabel: formatSignedUsd(value, input.locale),
      shareLabel: totalReturnAbs === 0 ? "—" : formatPercent(Math.abs(value) / totalReturnAbs, input.locale),
      barPercent: (Math.abs(value) / maxMagnitude) * 100,
      tone: toneForDecompositionValue(key, value),
      tooltipLabel: key === "rebalanceEffectUsd"
        ? rebalanceTooltipLabel
        : key === "unattributedUsd" && unattributedReasonLabels.length > 0
          ? unattributedReasonLabels.join(" • ")
          : null,
    })),
  };
}

export function mapDepositRangeToViewModel(input: {
  deposit: DepositDetailView;
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}): DepositRangeViewModel | null {
  if (input.deposit.poolKind !== "cl") {
    return null;
  }

  return {
    title: input.translate("deposits:detail.range.title", { defaultValue: "Range" }),
    lowerLabel: `${input.translate("deposits:detail.range.lower", { defaultValue: "Lower" })}: ${formatRangeValue(input.deposit.rangeLowerPrice, input.deposit.token1Symbol, input.locale)}`,
    upperLabel: `${input.translate("deposits:detail.range.upper", { defaultValue: "Upper" })}: ${formatRangeValue(input.deposit.rangeUpperPrice, input.deposit.token1Symbol, input.locale)}`,
    stateLabel: input.deposit.isInRange === null
      ? input.translate("deposits:detail.range.unavailable", { defaultValue: "Unavailable" })
      : input.deposit.isInRange
        ? input.translate("deposits:detail.range.inRange", { defaultValue: "In range" })
        : input.translate("deposits:detail.range.outOfRange", { defaultValue: "Out of range" }),
    stateTone: input.deposit.isInRange === null ? "neutral" : input.deposit.isInRange ? "success" : "warning",
  };
}

export function mapDepositSecondaryStatsToViewModel(input: {
  deposit: DepositDetailView;
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return [
    {
      key: "estApr",
      label: input.translate("deposits:detail.secondary.estApr", { defaultValue: "Est. APR" }),
      value: input.deposit.estimatedAnnualizedReturnPct === null
        ? "—"
        : formatSignedPercent(input.deposit.estimatedAnnualizedReturnPct, input.locale),
    },
    {
      key: "totalRewards",
      label: input.translate("deposits:detail.secondary.totalRewards", { defaultValue: "Total rewards" }),
      value: formatSignedUsd(input.deposit.totalRewardsUsd, input.locale),
    },
    {
      key: "realizedPnl",
      label: input.translate("deposits:detail.secondary.realizedPnl", { defaultValue: "Realized PnL" }),
      value: formatSignedUsd(input.deposit.realizedPnlUsd, input.locale),
    },
    {
      key: "unrealizedPnl",
      label: input.translate("deposits:detail.secondary.unrealizedPnl", { defaultValue: "Unrealized PnL" }),
      value: formatSignedUsd(input.deposit.unrealizedPnlUsd, input.locale),
    },
    {
      key: "coverage",
      label: input.translate("deposits:detail.secondary.coverage", { defaultValue: "Coverage" }),
      value: input.translate(getDepositCoverageLabelKey(input.deposit.coverageStatus), {
        defaultValue: input.deposit.coverageStatus,
      }),
      tone: toneForCoverage(input.deposit.coverageStatus),
      emphasized: true,
    },
    {
      key: "confidence",
      label: input.translate("deposits:detail.secondary.confidence", { defaultValue: "Confidence" }),
      value: input.translate(getDepositConfidenceLabelKey(input.deposit.confidence), {
        defaultValue: input.deposit.confidence,
      }),
      tone: toneForConfidence(input.deposit.confidence),
      emphasized: true,
    },
  ] satisfies DepositDetailSecondaryStatViewModel[];
}

export function mapDepositDetailResponseToViewModel(input: {
  response: DepositDetailResponse;
  locale: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}): DepositDetailViewModel {
  const response = input.response;
  const deposit = response.deposit;

  return {
    header: {
      title: deposit.positionLabel,
      subtitle: deposit.poolLabel,
      statusLabel: input.translate(`deposits:status.${deposit.status}`, { defaultValue: deposit.status }),
      tokenIdLabel: deposit.tokenId ? `#${deposit.tokenId}` : null,
    },
    actions: {
      viewInExplorerLabel: input.translate("deposits:detail.viewInExplorer", {
        defaultValue: "View in explorer",
      }),
      closeLabel: input.translate("deposits:detail.close", { defaultValue: "Close" }),
    },
    kpis: {
      currentValueLabel: input.translate("deposits:detail.currentValue", { defaultValue: "Current value" }),
      currentValueValue: formatUsd(deposit.currentValueUsd, input.locale),
      totalReturnLabel: input.translate("deposits:detail.totalReturn", { defaultValue: "Total return" }),
      totalReturnValue: formatSignedUsd(deposit.totalReturnUsd, input.locale),
      totalReturnMeta: deposit.totalReturnPct === null ? null : formatSignedPercent(deposit.totalReturnPct, input.locale),
    },
    secondaryStatsTitle: input.translate("deposits:detail.secondary.title", { defaultValue: "Secondary stats" }),
    secondaryStats: mapDepositSecondaryStatsToViewModel({
      deposit,
      locale: input.locale,
      translate: input.translate,
    }),
    coveredRange: {
      title: input.translate("deposits:detail.coveredRange.title", { defaultValue: "Covered range" }),
      value: formatDayRange(deposit.coveredStartDayUtc, deposit.coveredEndDayUtc, input.locale) ?? "—",
      hint: shouldShowShorterCoveredRangeHint(response)
        ? input.translate("deposits:detail.coveredRange.shorterThanWindow", {
            defaultValue: "Covered range is shorter than the requested window.",
          })
        : null,
    },
    range: mapDepositRangeToViewModel({
      deposit,
      locale: input.locale,
      translate: input.translate,
    }),
    valueChart: response.valueChart,
    valueChartCopy: {
      title: input.translate("deposits:detail.valueChart.title", { defaultValue: "Value chart" }),
      gapTitle: input.translate("deposits:detail.valueChart.gapTitle", { defaultValue: "Partial coverage" }),
      gapDescription: input.translate("deposits:detail.valueChart.gapDescription", {
        defaultValue: "The chart breaks across uncovered windows instead of interpolating missing values.",
      }),
    },
    lifecycle: {
      title: input.translate("deposits:detail.timeline.title", { defaultValue: "Lifecycle" }),
      emptyLabel: input.translate("deposits:detail.timeline.empty", {
        defaultValue: "No lifecycle events were materialized for this deposit yet.",
      }),
      movementLabels: {
        token: input.translate("deposits:detail.movements.token", { defaultValue: "Token" }),
        direction: input.translate("deposits:detail.movements.direction", { defaultValue: "Direction" }),
        amount: input.translate("deposits:detail.movements.amount", { defaultValue: "Amount" }),
        usdValue: input.translate("deposits:detail.movements.usdValue", { defaultValue: "USD at event" }),
        priceSource: input.translate("deposits:detail.movements.priceSource", { defaultValue: "Price source" }),
      },
      events: mapDepositLifecycleEventsToViewModel({
        events: deposit.lifecycle,
        locale: input.locale,
        translate: input.translate,
      }),
    },
    decomposition: mapDepositDecompositionToViewModel({
      deposit,
      locale: input.locale,
      translate: input.translate,
    }),
    strategyCrossLink: deposit.mellowStrategyCrossLinkId
      ? {
          title: input.translate("deposits:strategiesCrossLink.label", { defaultValue: "Related strategy" }),
          description: input.translate("deposits:strategiesCrossLink.placeholder", {
            defaultValue: "Strategies routing is not live yet. This placeholder preserves the target strategy id.",
          }),
          actionLabel: input.translate("deposits:strategiesCrossLink.available", { defaultValue: "Open strategy" }),
          strategyId: deposit.mellowStrategyCrossLinkId,
        }
      : null,
  };
}

export function mapDepositsListResponseToViewModel(
  response: DepositsListResponse,
): DepositsListViewModel {
  return {
    analysisStatus: response.analysisStatus,
    summary: response.summary,
    coveredRange: response.coveredRange,
    page: response.page,
    items: response.items.map((item) => ({
      ...item,
      totalReturnSign: resolveSign(item.totalReturnUsd),
    })),
  };
}
