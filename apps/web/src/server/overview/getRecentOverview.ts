import { assertSupportedChain } from "@/server/chains";
import { getLatestAnalysisRun } from "@/server/analysis/analysis-run.repository";
import {
  ASSET_TRUST_CLASSIFIER_VERSION,
  type AssetTrustClassifierInput,
  type OverviewTrustCoverageReasonCode,
} from "@/server/asset-trust/assetTrust.types";
import { classifyWalletAssetTrust } from "@/server/asset-trust/classifyWalletAssetTrust";
import { resolveKnownProtocolAssetMatch } from "@/server/asset-trust/knownProtocolAssets";
import {
  getCurrentTokenPricesByAddress,
  getHistoricalTokenPricesByAddress,
} from "@/server/providers/alchemy";
import { buildHistoricalComponentValueLookup } from "@/server/valuation/historicalValueLookup";
import { getWalletDefiPositions, getWalletHistory, getWalletTokens } from "@/server/providers/moralis";
import { detectProtocolPositions } from "@/server/protocol-positions/detectProtocolPositions";
import {
  getLatestOverviewPortfolioSnapshot,
  readLatestOverviewPricePoints,
  readKnownProtocolContracts,
  readOverviewAnalyzedPortfolioSnapshots,
  readRecentOverviewAnalyzedActivity,
  readOverviewPricePointsInRange,
  readOverviewPortfolioSnapshots,
  readOverviewRealizedRewardEvents,
  insertOverviewCoverageReport,
  insertOverviewPortfolioSnapshot,
  insertOverviewRawProviderRecord,
  readOverviewFreshness,
  upsertOverviewFreshness,
  upsertOverviewPricePoint,
} from "@/server/overview/overview.repository";
import { buildRewardValueLookup, buildSnapshotValueLookup, toBucketTimestamp } from "@/server/overview/chart-snapshots";
import type {
  OverviewChartPoint,
  OverviewCoverageReasonCode,
  OverviewExclusionSummary,
  OverviewRange,
  OverviewRequest,
  OverviewResponse,
} from "@/server/overview/overview.types";

export const DEFAULT_OVERVIEW_RANGE: OverviewRange = "7d";

const OVERVIEW_BUCKET_CONFIG: Record<OverviewRange, { granularity: "hour" | "day"; bucketCount: number }> = {
  "24h": { granularity: "hour", bucketCount: 24 },
  "7d": { granularity: "day", bucketCount: 7 },
  "30d": { granularity: "day", bucketCount: 30 },
};

const OVERVIEW_ACTIVITY_LIMIT: Record<OverviewRange, number> = {
  "24h": 16,
  "7d": 28,
  "30d": 48,
};

export function buildOverviewAnalyzedActivityReadInput(input: {
  surface: "activity" | "chart";
  walletAddress: string;
  chainId: number;
  range: OverviewRange;
  startAt?: Date;
  endAt?: Date;
}) {
  const baseInput = {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
  };

  if (input.surface === "activity") {
    return {
      ...baseInput,
      limit: OVERVIEW_ACTIVITY_LIMIT[input.range],
    };
  }

  if (!input.startAt || !input.endAt) {
    throw new Error("OVERVIEW_CHART_ACTIVITY_RANGE_REQUIRED");
  }

  return {
    ...baseInput,
    startAt: input.startAt,
    endAt: input.endAt,
  };
}

const NATIVE_ETH_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const BASE_AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const HISTORICAL_PRICE_BATCH_SIZE = 8;
const CURRENT_PRICE_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_ALCHEMY_CURRENT_PRICE_ADDRESSES_PER_REQUEST = 25;
const MAX_ALCHEMY_HISTORICAL_ADDRESSES_PER_REQUEST = 24;
const DUST_VALUE_THRESHOLD_USD = 1;

type MoralisTokenRecord = Record<string, unknown>;

type TrustHydratedAssetRow = {
  assetRow: OverviewResponse["assets"]["rows"][number];
  trustInput: AssetTrustClassifierInput;
  knownProtocolConflict: boolean;
};

function canUseAnalyzedOverviewActivity(status: OverviewResponse["analysis"]["status"]) {
  return status === "ready" || status === "stale";
}

type OverviewDepositActivityContext = NonNullable<
  Awaited<ReturnType<typeof readRecentOverviewAnalyzedActivity>>[number]["depositContext"]
>;

type OverviewApprovalActivityContext = NonNullable<
  Awaited<ReturnType<typeof readRecentOverviewAnalyzedActivity>>[number]["approvalContext"]
>;

function summarizeActivityMovementSymbols(
  movements: Array<{
    directionIn: boolean;
    amountUsd: string | number | null;
    metadataJson: Record<string, unknown>;
  }>,
) {
  const incomingSymbols = Array.from(
    new Set(
      movements
        .filter((movement) => movement.directionIn)
        .map((movement) => asString(movement.metadataJson.symbol))
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );
  const outgoingSymbols = Array.from(
    new Set(
      movements
        .filter((movement) => !movement.directionIn)
        .map((movement) => asString(movement.metadataJson.symbol))
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );

  const segments = [
    outgoingSymbols.length > 0 ? `- ${outgoingSymbols.join(", ")}` : null,
    incomingSymbols.length > 0 ? `+ ${incomingSymbols.join(", ")}` : null,
  ].filter((segment): segment is string => Boolean(segment));

  return segments.length > 0 ? segments.join(" · ") : null;
}

function sumMovementUsd(
  movements: Array<{
    directionIn: boolean;
    amountUsd: string | number | null;
  }>,
  directionIn: boolean,
) {
  return movements.reduce((sum, movement) => {
    if (movement.directionIn !== directionIn) {
      return sum;
    }

    return sum + (asNumber(movement.amountUsd) ?? 0);
  }, 0);
}

function isAeroMovement(input: {
  tokenAddress: string | null;
  metadataJson: Record<string, unknown>;
}) {
  const normalizedAddress = input.tokenAddress?.toLowerCase() ?? null;
  const normalizedSymbol = asString(input.metadataJson.symbol)?.trim().toLowerCase() ?? null;
  const normalizedName = asString(input.metadataJson.name)?.trim().toLowerCase() ?? null;

  return normalizedAddress === BASE_AERO_ADDRESS || normalizedSymbol === "aero" || normalizedName === "aerodrome";
}

function resolveAeroRewardValueUsd(
  movements: Array<{
    tokenAddress: string;
    directionIn: boolean;
    amountUsd: string | number | null;
    metadataJson: Record<string, unknown>;
  }>,
) {
  const rewardValueUsd = movements.reduce((sum, movement) => {
    if (!movement.directionIn || !isAeroMovement(movement)) {
      return sum;
    }

    return sum + (asNumber(movement.amountUsd) ?? 0);
  }, 0);

  return rewardValueUsd > 0 ? rewardValueUsd : null;
}

function isGovernanceEscrowDisplayEvent(input: {
  classification: string | null;
  metadataJson: Record<string, unknown>;
}) {
  const text = [
    input.classification,
    asString(input.metadataJson.category),
    asString(input.metadataJson.methodLabel),
    asString(input.metadataJson.summary),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return input.classification === "governance"
    || text.includes("voting escrow")
    || text.includes("veaero")
    || (text.includes("escrow") && text.includes("aerodrome"));
}

function resolveOverviewActivityDisplayClassification(input: {
  classification: string | null;
  metadataJson: Record<string, unknown>;
  movements: Array<{
    directionIn: boolean;
    amountUsd: string | number | null;
    metadataJson: Record<string, unknown>;
  }>;
}) {
  const text = [
    input.classification,
    asString(input.metadataJson.category),
    asString(input.metadataJson.methodLabel),
    asString(input.metadataJson.summary),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasIncoming = input.movements.some((movement) => movement.directionIn);
  const hasOutgoing = input.movements.some((movement) => !movement.directionIn);
  const incomingUsd = sumMovementUsd(input.movements, true);
  const outgoingUsd = sumMovementUsd(input.movements, false);
  const grossUsd = incomingUsd + outgoingUsd;
  const netUsd = Math.abs(incomingUsd - outgoingUsd);
  const hasBalancedMixedFlow = hasIncoming && hasOutgoing && grossUsd > 0 && netUsd <= grossUsd * 0.35;

  if (text.includes("rebalance") || input.classification?.startsWith("rebalance_")) {
    return "rebalance";
  }

  if (text.includes("airdrop") || input.classification === "airdrop") {
    return "airdrop";
  }

  if (text.includes("approve") || input.classification === "approve") {
    return "approve";
  }

  if (isGovernanceEscrowDisplayEvent({
    classification: input.classification,
    metadataJson: input.metadataJson,
  })) {
    return "governance";
  }

  if (text.includes("claim") || text.includes("collect") || input.classification === "claim") {
    return "claim";
  }

  if (
    hasBalancedMixedFlow &&
    !text.includes("swap") &&
    !text.includes("approve") &&
    !text.includes("airdrop") &&
    [
      "manual_deposit",
      "strategy_deposit",
      "manual_withdrawal",
      "strategy_withdraw",
      "deposit",
      "withdraw",
      "stake",
      "unstake",
    ].includes(input.classification ?? "")
  ) {
    return "rebalance";
  }

  if (text.includes("unstake")) {
    return "unstake";
  }

  if (text.includes("stake")) {
    return "stake";
  }

  if (
    text.includes("withdraw") ||
    text.includes("decrease") ||
    text.includes("burn") ||
    text.includes("remove") ||
    input.classification === "manual_withdrawal" ||
    input.classification === "strategy_withdraw"
  ) {
    return "withdraw";
  }

  if (
    text.includes("deposit") ||
    text.includes("mint") ||
    text.includes("increase") ||
    input.classification === "manual_deposit" ||
    input.classification === "strategy_deposit"
  ) {
    return "deposit";
  }

  if (text.includes("swap")) {
    return "swap";
  }

  if (text.includes("vote") || text.includes("lock") || text.includes("relay") || text.includes("bribe")) {
    return "governance";
  }

  if (hasIncoming && !hasOutgoing) {
    return "cash_in";
  }

  if (hasOutgoing && !hasIncoming) {
    return "cash_out";
  }

  return "other";
}

function getOverviewActivityLabelKey(classification: string) {
  switch (classification) {
    case "cash_in":
      return "overview:activity.classifications.cashIn";
    case "cash_out":
      return "overview:activity.classifications.cashOut";
    case "swap":
      return "overview:activity.classifications.swap";
    case "rebalance":
      return "overview:activity.classifications.rebalance";
    case "airdrop":
      return "overview:activity.classifications.airdrop";
    case "approve":
      return "overview:activity.classifications.approve";
    case "deposit":
      return "overview:activity.classifications.deposit";
    case "withdraw":
      return "overview:activity.classifications.withdraw";
    case "stake":
      return "overview:activity.classifications.stake";
    case "unstake":
      return "overview:activity.classifications.unstake";
    case "claim":
      return "overview:activity.classifications.claim";
    case "governance":
      return "overview:activity.classifications.governance";
    default:
      return "overview:activity.classifications.other";
  }
}

export function buildOverviewDepositMintDetail(input: {
  classification: string;
  depositContext: OverviewDepositActivityContext | null;
}) {
  if (input.classification !== "deposit" || !input.depositContext) {
    return null;
  }

  if (input.depositContext.protocol !== "aerodrome" || !input.depositContext.tokenId) {
    return null;
  }

  const symbolPair = [input.depositContext.primaryTokenSymbol, input.depositContext.secondaryTokenSymbol]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" / ");
  const poolLabel = input.depositContext.poolLabel?.trim() || symbolPair || null;

  return poolLabel ? `${poolLabel} · #${input.depositContext.tokenId}` : `#${input.depositContext.tokenId}`;
}

export function buildOverviewApprovalDetail(input: {
  classification: string;
  approvalContext: OverviewApprovalActivityContext | null;
}) {
  if (input.classification !== "approve" || !input.approvalContext) {
    return null;
  }

  if (
    input.approvalContext.protocol !== "aerodrome"
    || !input.approvalContext.spenderContractType.toLowerCase().includes("gauge")
    || !input.approvalContext.tokenId
  ) {
    return null;
  }

  const poolLabel = input.approvalContext.poolLabel?.trim() || null;
  return poolLabel
    ? `Approved LP NFT #${input.approvalContext.tokenId} for ${poolLabel} gauge`
    : `Approved LP NFT #${input.approvalContext.tokenId} for gauge`;
}

function buildOverviewAnalyzedActivityDetail(input: {
  classification: string;
  metadataJson: Record<string, unknown>;
  depositContext: OverviewDepositActivityContext | null;
  approvalContext: OverviewApprovalActivityContext | null;
  movements: Array<{
    directionIn: boolean;
    amountUsd: string | number | null;
    metadataJson: Record<string, unknown>;
  }>;
}) {
  const depositMintDetail = buildOverviewDepositMintDetail({
    classification: input.classification,
    depositContext: input.depositContext,
  });
  if (depositMintDetail) {
    return depositMintDetail;
  }

  const approvalDetail = buildOverviewApprovalDetail({
    classification: input.classification,
    approvalContext: input.approvalContext,
  });
  if (approvalDetail) {
    return approvalDetail;
  }

  const summary = asString(input.metadataJson.summary)?.trim();
  const category = asString(input.metadataJson.category)?.trim();
  const normalizedCategory = category?.toLowerCase() ?? null;
  const summaryLooksMisleadingForGaugeStaking =
    input.classification === "stake"
      ? normalizedCategory === "nft sale" || normalizedCategory === "nft send" || normalizedCategory === "burn"
      : input.classification === "unstake"
        ? normalizedCategory === "mint" || normalizedCategory === "nft receive"
        : false;

  if (summary && !summaryLooksMisleadingForGaugeStaking) {
    return summary;
  }

  const methodLabel = asString(input.metadataJson.methodLabel)?.trim();
  const movementSummary = summarizeActivityMovementSymbols(input.movements);

  return [methodLabel ?? category ?? null, movementSummary]
    .filter((segment): segment is string => Boolean(segment))
    .join(" · ") || null;
}

function buildOverviewActivityFromAnalyzedRows(input: {
  response: OverviewResponse;
  rows: Awaited<ReturnType<typeof readRecentOverviewAnalyzedActivity>>;
}) {
  input.response.activity = {
    ...input.response.activity,
    source: "analyzed_history",
    coverageStatus: input.rows.some((row) => !row.classification || row.classification === "other") ? "partial" : "recent",
    coverageReasonCodes: null,
    items: input.rows.map((row) => {
      const classification = resolveOverviewActivityDisplayClassification({
        classification: row.classification,
        metadataJson: row.metadataJson,
        movements: row.movements,
      });

      return {
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        eventType: row.eventType,
        classification,
        labelKey: getOverviewActivityLabelKey(classification),
        detail: buildOverviewAnalyzedActivityDetail({
          classification,
          metadataJson: row.metadataJson,
          depositContext: row.depositContext,
          approvalContext: row.approvalContext,
          movements: row.movements,
        }),
        txHash: row.txHash,
        confidence:
          row.confidence === "low" || row.confidence === "medium" || row.confidence === "high"
            ? row.confidence
            : null,
        isUnclassified: classification === "other",
      } satisfies OverviewResponse["activity"]["items"][number];
    }),
  };
}

function mapOverviewActivityItemToChartEventType(input: {
  classification: string | null;
  eventType: string;
  detail: string | null;
  rewardValueUsd: number | null;
}) {
  if ((input.rewardValueUsd ?? 0) > 0 || input.classification === "claim") {
    return "claim" as const;
  }

  if (input.classification === "cash_out") {
    return "cash_out" as const;
  }

  if (input.classification === "rebalance") {
    return "rebalance" as const;
  }

  if (input.classification === "deposit" || input.classification === "stake") {
    return "redeploy" as const;
  }

  if (input.classification === "withdraw" || input.classification === "unstake") {
    return "move_to_idle" as const;
  }

  if (input.classification === "governance") {
    const text = `${input.eventType} ${input.detail ?? ""}`.toLowerCase();
    if (text.includes("vote")) {
      return "vote" as const;
    }

    if (text.includes("lock")) {
      return "lock" as const;
    }
  }

  return null;
}

function isCoreRebalanceSwapCandidate(input: {
  row: Awaited<ReturnType<typeof readRecentOverviewAnalyzedActivity>>[number];
  rows: Awaited<ReturnType<typeof readRecentOverviewAnalyzedActivity>>;
  classification: string;
}) {
  if (input.classification !== "swap") {
    return false;
  }

  const movementSymbols = Array.from(new Set(
    input.row.movements
      .map((movement) => asString(movement.metadataJson.symbol)?.trim().toLowerCase() ?? null)
      .filter((symbol): symbol is string => Boolean(symbol)),
  ));
  const coreSymbols = new Set(["usdc", "weth", "eth", "cbbtc", "aero"]);

  if (movementSymbols.length < 2 || movementSymbols.some((symbol) => !coreSymbols.has(symbol))) {
    return false;
  }

  return input.rows.some((candidate) => {
    if (candidate.id === input.row.id) {
      return false;
    }

    const candidateClassification = resolveOverviewActivityDisplayClassification({
      classification: candidate.classification,
      metadataJson: candidate.metadataJson,
      movements: candidate.movements,
    });
    if (!["deposit", "withdraw", "stake", "unstake", "rebalance"].includes(candidateClassification)) {
      return false;
    }

    const deltaMs = Math.abs(candidate.occurredAt.getTime() - input.row.occurredAt.getTime());
    return deltaMs <= 20 * 60 * 1000;
  });
}

export function buildOverviewRewardFallbackEvents(input: {
  range: OverviewRange;
  rewardRows: Array<{
    occurredAt: Date;
    amountUsd: string | number | null;
    txHash: string;
  }>;
  existingTxHashes?: Iterable<string>;
}) {
  const granularity = getRecentOverviewBucketConfig(input.range).granularity;
  const existingTxHashes = new Set(
    Array.from(input.existingTxHashes ?? [], (txHash) => txHash.toLowerCase()),
  );
  const rewardFallbackEventsByTxHash = new Map<string, OverviewResponse["chart"]["events"][number]>();

  for (const rewardRow of input.rewardRows) {
    const txHash = rewardRow.txHash.toLowerCase();
    if (existingTxHashes.has(txHash)) {
      continue;
    }

    const rewardValueUsd = asNumber(rewardRow.amountUsd);
    if ((rewardValueUsd ?? 0) <= 0) {
      continue;
    }

    const existingEvent = rewardFallbackEventsByTxHash.get(txHash);
    if (!existingEvent) {
      rewardFallbackEventsByTxHash.set(txHash, {
        id: `reward-${txHash}`,
        type: "claim",
        occurredAt: rewardRow.occurredAt.toISOString(),
        capturedAt: toBucketTimestamp(rewardRow.occurredAt.toISOString(), granularity),
        detail: null,
        txHash: rewardRow.txHash,
        rewardValueUsd,
      });
      continue;
    }

    rewardFallbackEventsByTxHash.set(txHash, {
      ...existingEvent,
      occurredAt: rewardRow.occurredAt < new Date(existingEvent.occurredAt)
        ? rewardRow.occurredAt.toISOString()
        : existingEvent.occurredAt,
      rewardValueUsd: (existingEvent.rewardValueUsd ?? 0) + rewardValueUsd,
    });
  }

  return Array.from(rewardFallbackEventsByTxHash.values()).sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );
}

function buildOverviewChartEvents(input: {
  rows: Awaited<ReturnType<typeof readRecentOverviewAnalyzedActivity>>;
  range: OverviewRange;
  rewardValueByTxHash?: Map<string, number>;
  rewardRows?: Array<{
    occurredAt: Date;
    amountUsd: string | number | null;
    txHash: string;
  }>;
}) {
  const granularity = getRecentOverviewBucketConfig(input.range).granularity;
  const events = input.rows.flatMap((row) => {
    const baseClassification = resolveOverviewActivityDisplayClassification({
      classification: row.classification,
      metadataJson: row.metadataJson,
      movements: row.movements,
    });
    const classification = isCoreRebalanceSwapCandidate({
      row,
      rows: input.rows,
      classification: baseClassification,
    })
      ? "rebalance"
      : baseClassification;
    const detail = buildOverviewAnalyzedActivityDetail({
      classification,
      metadataJson: row.metadataJson,
      depositContext: row.depositContext,
      approvalContext: row.approvalContext,
      movements: row.movements,
    });
    const rewardValueUsd = classification === "claim"
      ? input.rewardValueByTxHash?.get(row.txHash.toLowerCase()) ?? resolveAeroRewardValueUsd(row.movements)
      : null;
    const type = mapOverviewActivityItemToChartEventType({
      classification,
      eventType: row.eventType,
      detail,
      rewardValueUsd,
    });

    if (!type) {
      return [];
    }

    return [{
      id: row.id,
      type,
      occurredAt: row.occurredAt.toISOString(),
      capturedAt: toBucketTimestamp(row.occurredAt.toISOString(), granularity),
      detail,
      txHash: row.txHash,
      rewardValueUsd,
    }] satisfies OverviewResponse["chart"]["events"];
  });

  const rewardFallbackEvents = buildOverviewRewardFallbackEvents({
    range: input.range,
    rewardRows: input.rewardRows ?? [],
    existingTxHashes: events
      .map((event) => event.txHash)
      .filter((txHash): txHash is string => Boolean(txHash)),
  });

  return [...events, ...rewardFallbackEvents].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );
}

function buildDistributionCompositionLabel(
  row: OverviewResponse["protocolPositions"]["rows"][number],
) {
  return row.strategyLabel ?? row.poolLabel ?? row.governanceLabel ?? row.label;
}

function buildDistributionSliceComposition(
  rows: OverviewResponse["protocolPositions"]["rows"],
  family: OverviewResponse["protocolPositions"]["rows"][number]["family"],
): NonNullable<OverviewResponse["distribution"]["slices"][number]["composition"]> | null {
  const composition = rows
    .filter((row) => row.family === family)
    .map((row) => ({
      positionKey: row.positionKey,
      label: buildDistributionCompositionLabel(row),
      valueUsd: row.valueUsd,
      tokens: [
        row.primaryTokenSymbol
          ? {
              symbol: row.primaryTokenSymbol,
              amount: row.primaryTokenAmount,
            }
          : null,
        row.secondaryTokenSymbol
          ? {
              symbol: row.secondaryTokenSymbol,
              amount: row.secondaryTokenAmount,
            }
          : null,
      ].filter((token): token is { symbol: string; amount: number | null } => token !== null),
    }))
    .filter((entry) => entry.label.length > 0 || entry.tokens.length > 0 || entry.valueUsd !== null)
    .sort((left, right) => {
      const leftValue = left.valueUsd ?? -1;
      const rightValue = right.valueUsd ?? -1;

      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return left.label.localeCompare(right.label);
    });

  return composition.length > 0 ? composition : null;
}

export function normalizeOverviewRange(range?: string | null): OverviewRange {
  if (range === "24h" || range === "30d") {
    return range;
  }

  return DEFAULT_OVERVIEW_RANGE;
}

export function getRecentOverviewBucketConfig(range: OverviewRange) {
  return OVERVIEW_BUCKET_CONFIG[range];
}

export function createEmptyRecentOverviewResponse(input: OverviewRequest): OverviewResponse {
  const chain = assertSupportedChain(input.chainId);

  return {
    walletAddress: input.walletAddress.toLowerCase(),
    chainId: input.chainId,
    mode: "recent_view",
    selectedRange: input.range,
    analysis: {
      status: "not_analyzed",
      runId: null,
      stage: "idle",
      progressPct: 0,
      lastSuccessfulRunAt: null,
      lastUpdatedAt: null,
      lastError: null,
    },
    coverage: {
      status: "recent",
      confidence: "medium",
      reasonCodes: ["analysisPending"],
      details: null,
    },
    summary: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: ["analysisPending"],
      walletAddress: input.walletAddress.toLowerCase(),
      chainId: input.chainId,
      chainLabel: chain.name,
      lastRefreshedAt: null,
      modeLabelKey: "mode.recentView",
    },
    metrics: {
      source: "recent_provider_data",
      coverageStatus: "partial",
      coverageReasonCodes: ["analysisPending"],
      netPortfolioValueUsd: null,
      deployedValueUsd: null,
      idleValueUsd: null,
      changeOverSelectedPeriodPct: null,
      estimatedRealizedRewardsUsd: null,
      manualDepositsValueUsd: null,
      automatedStrategiesValueUsd: null,
      residualAttributedValueUsd: null,
      governanceValueUsd: null,
      exclusions: null,
    },
    chart: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: ["analysisPending"],
      range: input.range,
      hasRewardMarkers: false,
      points: [],
      events: [],
    },
    distribution: {
      source: "partial_fallback",
      coverageStatus: "partial",
      coverageReasonCodes: ["analysisPending"],
      slices: [],
      exclusions: null,
    },
    assets: {
      source: "recent_provider_data",
      coverageStatus: "partial",
      coverageReasonCodes: ["analysisPending"],
      rows: [],
      hiddenSummary: null,
      defaultVisibleCount: 0,
    },
    protocolPositions: {
      source: "partial_fallback",
      coverageStatus: "unknown",
      coverageReasonCodes: null,
      rows: [],
      summary: {
        totalCount: 0,
        familyCounts: {
          manualDeposit: 0,
          strategyExposure: 0,
          governanceLock: 0,
          stakedLp: 0,
        },
        hasPartialValuation: false,
        hasShareLevelPositions: false,
        lastRefreshedAt: null,
      },
    },
    activity: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: ["analysisPending"],
      items: [],
    },
  };
}

function createOverviewAnalysisState(input: {
  latestRun: Awaited<ReturnType<typeof getLatestAnalysisRun>>;
  freshness: Awaited<ReturnType<typeof readOverviewFreshness>>;
}) {
  const priorAnalyzedAt = input.freshness?.lastAnalyzedAt ?? input.latestRun?.completedAt ?? null;
  const analysisStatus = input.latestRun?.status === "queued" || input.latestRun?.status === "running"
    ? input.latestRun.status
    : input.latestRun?.status === "failed"
      ? "failed"
      : isStale(priorAnalyzedAt)
        ? "stale"
        : priorAnalyzedAt
          ? "ready"
          : "not_analyzed";

  return {
    status: analysisStatus,
    runId: input.latestRun?.id ?? input.freshness?.lastSuccessfulRunId ?? null,
    stage:
      input.latestRun?.stage ??
      (analysisStatus === "ready" || analysisStatus === "stale" ? "completed" : "idle"),
    progressPct:
      input.latestRun?.progressPct ?? (analysisStatus === "ready" || analysisStatus === "stale" ? 100 : 0),
    lastSuccessfulRunAt: priorAnalyzedAt ? priorAnalyzedAt.toISOString() : null,
    lastUpdatedAt: input.latestRun?.updatedAt ? input.latestRun.updatedAt.toISOString() : null,
    lastError: input.latestRun?.lastError ?? null,
  } as OverviewResponse["analysis"];
}

function buildOverviewActivityBlock(input: {
  response: OverviewResponse;
  history: MoralisHistoryRecord[];
  historyFulfilled: boolean;
  now: Date;
  walletAddress: string;
}) {
  input.response.activity = {
    ...input.response.activity,
    coverageStatus: input.historyFulfilled ? "recent" : "partial",
    coverageReasonCodes:
      input.historyFulfilled ? ["analysisPending"] : ["providerPartial", "analysisPending"],
    items: input.history.slice(0, 10).map((item: MoralisHistoryRecord, index) => ({
      id:
        asString(item.transaction_hash) ??
        asString(item.hash) ??
        `${input.walletAddress.toLowerCase()}-${index}`,
      occurredAt:
        asString(item.block_timestamp) ??
        asString(item.block_time) ??
        asString(item.created_at) ??
        input.now.toISOString(),
      eventType: asString(item.category) ?? "unclassified",
      classification: null,
      labelKey: "overview.activity.unclassified",
      detail: asString(item.summary) ?? asString(item.method_label) ?? asString(item.category),
      txHash: asString(item.transaction_hash) ?? asString(item.hash),
      confidence: "low",
      isUnclassified: true,
    })),
  };
}

export async function getRecentOverviewShell(input: OverviewRequest): Promise<OverviewResponse> {
  const response = createEmptyRecentOverviewResponse(input);
  const [latestRun, freshness, latestSnapshot] = await Promise.all([
    getLatestAnalysisRun(input.walletAddress, input.chainId),
    readOverviewFreshness(input),
    getLatestOverviewPortfolioSnapshot(input),
  ]);

  response.analysis = createOverviewAnalysisState({ latestRun, freshness });

  const snapshotCapturedAt = latestSnapshot?.capturedAt instanceof Date
    ? latestSnapshot.capturedAt.toISOString()
    : null;
  const freshnessMetadata = freshness?.metadataJson as Record<string, unknown> | null | undefined;
  const lastOverviewRefreshedAt = asString(freshnessMetadata?.lastOverviewRefreshedAt) ?? snapshotCapturedAt;
  const coverageReasonCodes: OverviewCoverageReasonCode[] = latestSnapshot ? [] : ["analysisPending"];
  const coverageStatus = latestSnapshot ? "recent" : "partial";

  response.coverage = {
    status: coverageStatus,
    confidence: latestSnapshot ? "high" : "medium",
    reasonCodes: coverageReasonCodes,
    details: null,
  };
  response.summary = {
    ...response.summary,
    coverageStatus,
    coverageReasonCodes,
    lastRefreshedAt: lastOverviewRefreshedAt,
  };
  response.metrics = {
    ...response.metrics,
    coverageStatus,
    coverageReasonCodes,
    netPortfolioValueUsd: asNumber(latestSnapshot?.totalValueUsd),
    deployedValueUsd: asNumber(latestSnapshot?.deployedValueUsd),
    idleValueUsd: asNumber(latestSnapshot?.idleValueUsd),
  };

  return response;
}

export async function getRecentOverviewActivity(input: OverviewRequest): Promise<OverviewResponse> {
  const response = createEmptyRecentOverviewResponse(input);
  const [historyResult, latestRun, freshness] = await Promise.all([
    getWalletHistory(input.walletAddress, input.chainId, 50).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getLatestAnalysisRun(input.walletAddress, input.chainId),
    readOverviewFreshness(input),
  ]);

  const now = new Date();
  const historyFulfilled = historyResult.status === "fulfilled";
  const history = historyFulfilled ? (historyResult.value.result ?? []) : [];
  response.analysis = createOverviewAnalysisState({ latestRun, freshness });

  if (canUseAnalyzedOverviewActivity(response.analysis.status)) {
    const analyzedActivityRows = await readRecentOverviewAnalyzedActivity({
      ...buildOverviewAnalyzedActivityReadInput({
        surface: "activity",
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        range: input.range,
      }),
    });

    if (analyzedActivityRows.length > 0) {
      buildOverviewActivityFromAnalyzedRows({
        response,
        rows: analyzedActivityRows,
      });

      return response;
    }
  }

  if (!historyFulfilled) {
    const coverageReasonCodes = buildProviderPartialReasonCodes(response.coverage.reasonCodes);
    response.coverage = {
      ...response.coverage,
      status: "partial",
      confidence: "medium",
      reasonCodes: coverageReasonCodes,
    };
    response.summary = {
      ...response.summary,
      coverageStatus: "partial",
      coverageReasonCodes,
      lastRefreshedAt: response.summary.lastRefreshedAt,
    };
  }

  response.summary = {
    ...response.summary,
    lastRefreshedAt: historyFulfilled ? now.toISOString() : response.summary.lastRefreshedAt,
  };

  if (historyFulfilled) {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/history",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId, limit: 50 },
      responseJson: {
        resultCount: history.length,
        items: history.slice(0, 20).map((item) => sanitizeMoralisHistoryForPersistence(item as MoralisHistoryRecord)),
      },
    });
  }

  buildOverviewActivityBlock({
    response,
    history,
    historyFulfilled,
    now,
    walletAddress: input.walletAddress,
  });

  return response;
}

export async function getRecentOverviewProtocolPositions(input: OverviewRequest): Promise<OverviewResponse> {
  const response = createEmptyRecentOverviewResponse(input);
  const [tokensResult, historyResult, defiPositionsResult, latestRun, freshness, protocolMetadata] = await Promise.all([
    getWalletTokens(input.walletAddress, input.chainId).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getWalletHistory(input.walletAddress, input.chainId, 50).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getWalletDefiPositions(input.walletAddress, input.chainId).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getLatestAnalysisRun(input.walletAddress, input.chainId),
    readOverviewFreshness(input),
    readKnownProtocolContracts({ chainId: input.chainId }),
  ]);

  if (
    tokensResult.status === "rejected" &&
    historyResult.status === "rejected" &&
    defiPositionsResult.status === "rejected"
  ) {
    const coverageReasonCodes = buildProviderPartialReasonCodes(response.coverage.reasonCodes);
    const now = new Date().toISOString();

    response.analysis = createOverviewAnalysisState({ latestRun, freshness });
    response.coverage = {
      ...response.coverage,
      status: "partial",
      confidence: "medium",
      reasonCodes: coverageReasonCodes,
    };
    response.summary = {
      ...response.summary,
      coverageStatus: "partial",
      coverageReasonCodes,
      lastRefreshedAt: response.summary.lastRefreshedAt ?? now,
    };
    response.protocolPositions = {
      ...response.protocolPositions,
      source: "partial_fallback",
      coverageStatus: "partial",
      coverageReasonCodes: null,
    };

    return response;
  }

  const now = new Date();
  const tokens = tokensResult.status === "fulfilled" ? (tokensResult.value.result ?? []) : [];
  const history = historyResult.status === "fulfilled" ? (historyResult.value.result ?? []) : [];
  const defiPositions = defiPositionsResult.status === "fulfilled" ? defiPositionsResult.value : [];

  response.analysis = createOverviewAnalysisState({ latestRun, freshness });
  response.summary = {
    ...response.summary,
    lastRefreshedAt: now.toISOString(),
  };

  if (tokensResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/tokens",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId },
      responseJson: {
        resultCount: tokens.length,
        tokens: tokens.map((token) => sanitizeMoralisTokenForPersistence(token as MoralisTokenRecord)),
      },
    });
  }

  if (historyResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/history",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId, limit: 50 },
      responseJson: {
        resultCount: history.length,
        items: history.slice(0, 20).map((item) => sanitizeMoralisHistoryForPersistence(item as MoralisHistoryRecord)),
      },
    });
  }

  if (defiPositionsResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/defi/positions",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId },
      responseJson: {
        resultCount: defiPositions.length,
        items: defiPositions.slice(0, 20).map((position) => sanitizeMoralisDefiPositionForPersistence(position)),
      },
    });
  }

  const protocolPositions = await detectProtocolPositions({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    protocolContracts: protocolMetadata,
    walletTokens: tokens,
    defiPositions,
    history,
    now,
  });

  if (protocolPositions.artifacts.manualCurrentState) {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "alchemy",
      endpoint: "/rpc/aerodrome/manual-positions",
      requestJson: {
        walletAddress: input.walletAddress,
        chainId: input.chainId,
      },
      responseJson: protocolPositions.artifacts.manualCurrentState,
    });
  }

  if (protocolPositions.artifacts.mellowCurrentState) {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "alchemy",
      endpoint: "/rpc/mellow/strategy-wrappers",
      requestJson: {
        walletAddress: input.walletAddress,
        chainId: input.chainId,
      },
      responseJson: protocolPositions.artifacts.mellowCurrentState,
    });
  }

  response.protocolPositions = protocolPositions.block;
  response.coverage = {
    ...response.coverage,
    status: toRequiredOverviewCoverageStatus(protocolPositions.block.coverageStatus),
    confidence: protocolPositions.block.coverageStatus === "full" ? "high" : "medium",
    reasonCodes: protocolPositions.block.coverageReasonCodes ?? [],
  };
  response.summary = {
    ...response.summary,
    coverageStatus: toRequiredOverviewCoverageStatus(protocolPositions.block.coverageStatus),
    coverageReasonCodes: protocolPositions.block.coverageReasonCodes,
  };

  return response;
}

export async function getRecentOverviewChart(input: OverviewRequest): Promise<OverviewResponse> {
  try {
    return await getRecentOverview(input);
  } catch (error) {
    if (!isProviderRequestFailed(error)) {
      throw error;
    }

    return getRecentOverviewChartFallback(input);
  }
}

export async function getRecentOverviewCurrentState(input: OverviewRequest): Promise<OverviewResponse> {
  try {
    return await getRecentOverview(input);
  } catch (error) {
    if (!isProviderRequestFailed(error)) {
      throw error;
    }

    return getRecentOverviewCurrentStateFallback(input);
  }
}

type MoralisHistoryRecord = Record<string, unknown>;
function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function asBooleanOrNull(value: unknown): boolean | null {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  return null;
}

function formatBalance(balanceRaw: string | null, decimals: number | null) {
  if (!balanceRaw || !/^\d+$/.test(balanceRaw)) {
    return "0";
  }

  const safeDecimals = Math.max(0, decimals ?? 0);
  const raw = BigInt(balanceRaw);
  const divisor = BigInt(10) ** BigInt(safeDecimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (safeDecimals === 0) {
    return whole.toString();
  }

  const fractionText = fraction.toString().padStart(safeDecimals, "0").replace(/0+$/, "");
  if (!fractionText) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractionText.slice(0, 6)}`;
}

function buildChartPoints(
  bucketTimestamps: string[],
  seriesByToken: Map<string, Map<string, number>>,
  tokenBalances: Array<{ tokenAddress: string; balance: number }>,
  snapshotValuesByBucket: Map<string, {
    totalValueUsd: number | null;
    deployedValueUsd: number | null;
    idleValueUsd: number | null;
    rewardValueUsd: number | null;
  }>,
  rewardValuesByBucket: Map<string, number>,
  estimatedDeployedValueByBucket: Map<string, number | null>,
  hasProtocolPositions: boolean,
  hasPartialProtocolHistory: boolean,
) {
  let hasPartialHistory = hasPartialProtocolHistory;

  const points: OverviewChartPoint[] = bucketTimestamps.map((bucketTimestamp) => {
    const snapshotPoint = snapshotValuesByBucket.get(bucketTimestamp);
    if (snapshotPoint) {
      const estimatedDeployedValueUsd = estimatedDeployedValueByBucket.get(bucketTimestamp) ?? null;
      const shouldMergeDeployedValue = snapshotPoint.deployedValueUsd === null && estimatedDeployedValueUsd !== null;
      const deployedValueUsd = shouldMergeDeployedValue
        ? estimatedDeployedValueUsd
        : snapshotPoint.deployedValueUsd;
      const totalValueUsd =
        shouldMergeDeployedValue
          ? (snapshotPoint.idleValueUsd === null && deployedValueUsd === null
              ? null
              : (snapshotPoint.idleValueUsd ?? 0) + (deployedValueUsd ?? 0))
          : snapshotPoint.totalValueUsd ??
            (snapshotPoint.idleValueUsd === null && deployedValueUsd === null
              ? null
              : (snapshotPoint.idleValueUsd ?? 0) + (deployedValueUsd ?? 0));

      return {
        capturedAt: bucketTimestamp,
        totalValueUsd,
        deployedValueUsd,
        idleValueUsd: snapshotPoint.idleValueUsd,
        rewardValueUsd:
          (() => {
            const derivedRewardValueUsd = rewardValuesByBucket.get(bucketTimestamp) ?? null;
            if (derivedRewardValueUsd !== null && derivedRewardValueUsd > 0) {
              return derivedRewardValueUsd;
            }

            return snapshotPoint.rewardValueUsd ?? null;
          })(),
      };
    }

    if (hasProtocolPositions && !estimatedDeployedValueByBucket.has(bucketTimestamp)) {
      hasPartialHistory = true;
    }

    let idleValueUsd = 0;
    let hasIdleValue = false;

    for (const tokenBalance of tokenBalances) {
      const priceByBucket = seriesByToken.get(tokenBalance.tokenAddress);
      const historicalPriceUsd = priceByBucket?.get(bucketTimestamp);

      if (historicalPriceUsd === undefined) {
        hasPartialHistory = true;
        continue;
      }

      idleValueUsd += tokenBalance.balance * historicalPriceUsd;
      hasIdleValue = true;
    }

    const estimatedDeployedValueUsd = estimatedDeployedValueByBucket.get(bucketTimestamp) ?? null;
    const totalValueUsd =
      !hasIdleValue && estimatedDeployedValueUsd === null
        ? null
        : (hasIdleValue ? idleValueUsd : 0) + (estimatedDeployedValueUsd ?? 0);

    return {
      capturedAt: bucketTimestamp,
      totalValueUsd,
      deployedValueUsd: estimatedDeployedValueUsd,
      idleValueUsd: hasIdleValue ? idleValueUsd : null,
      rewardValueUsd: rewardValuesByBucket.get(bucketTimestamp) ?? null,
    };
  });

  return {
    points,
    hasPartialHistory,
  };
}

function sanitizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("MORALIS_REQUEST_FAILED") || message.startsWith("ALCHEMY_")) {
    return new Error("PROVIDER_REQUEST_FAILED");
  }

  return error instanceof Error ? error : new Error("OVERVIEW_FAILED");
}

function isStale(lastSuccessfulRunAt: Date | null) {
  if (!lastSuccessfulRunAt) {
    return false;
  }

  return Date.now() - lastSuccessfulRunAt.getTime() > 7 * 24 * 60 * 60 * 1000;
}

function floorDateToGranularity(date: Date, granularity: "hour" | "day") {
  const alignedDate = new Date(date);

  alignedDate.setUTCMinutes(0, 0, 0);
  if (granularity === "day") {
    alignedDate.setUTCHours(0, 0, 0, 0);
  }

  return alignedDate;
}

function buildBucketTimestamps(range: OverviewRange, referenceDate: Date) {
  const config = getRecentOverviewBucketConfig(range);
  const alignedEndDate = floorDateToGranularity(referenceDate, config.granularity);
  const bucketMs = config.granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  return Array.from({ length: config.bucketCount }, (_, index) => {
    const offset = config.bucketCount - index - 1;
    return new Date(alignedEndDate.getTime() - offset * bucketMs).toISOString();
  });
}

function fillMissingBucketPrices(
  bucketTimestamps: string[],
  priceSeriesByBucket: Map<string, number>,
  fallbackPriceUsd: number | null,
) {
  let lastSeenPriceUsd: number | null = null;

  for (const bucketTimestamp of bucketTimestamps) {
    const nextPriceUsd = priceSeriesByBucket.get(bucketTimestamp);
    if (nextPriceUsd !== undefined) {
      lastSeenPriceUsd = nextPriceUsd;
      continue;
    }

    if (lastSeenPriceUsd !== null) {
      priceSeriesByBucket.set(bucketTimestamp, lastSeenPriceUsd);
    }
  }

  let nextSeenPriceUsd: number | null = null;
  for (const bucketTimestamp of [...bucketTimestamps].reverse()) {
    const previousPriceUsd = priceSeriesByBucket.get(bucketTimestamp);
    if (previousPriceUsd !== undefined) {
      nextSeenPriceUsd = previousPriceUsd;
      continue;
    }

    if (nextSeenPriceUsd !== null) {
      priceSeriesByBucket.set(bucketTimestamp, nextSeenPriceUsd);
      continue;
    }

    if (fallbackPriceUsd !== null) {
      priceSeriesByBucket.set(bucketTimestamp, fallbackPriceUsd);
    }
  }
}

async function hydrateCurrentPriceLookup(input: {
  walletAddress: string;
  chainId: number;
  addresses: string[];
  now: Date;
  priceLookup: Map<string, { priceUsd: number; pricedAt: string | null; confidence: "high" | "medium" }>;
}) {
  const normalizedAddresses = Array.from(
    new Set(
      input.addresses
        .map((address) => address.toLowerCase())
        .filter((address) => address.length > 0),
    ),
  );

  if (normalizedAddresses.length === 0) {
    return false;
  }

  const cachedPricePoints = await readLatestOverviewPricePoints({
    chainId: input.chainId,
    tokenAddresses: normalizedAddresses,
  });
  const staleFallbackPriceLookup = new Map<string, { priceUsd: number; pricedAt: string | null; confidence: "high" | "medium" }>();

  for (const cachedPricePoint of cachedPricePoints) {
    const address = cachedPricePoint.tokenAddress.toLowerCase();
    const priceUsd = Number(cachedPricePoint.priceUsd);
    if (!Number.isFinite(priceUsd)) {
      continue;
    }

    const cachedEntry = {
      priceUsd,
      pricedAt: cachedPricePoint.pricedAt.toISOString(),
      confidence: cachedPricePoint.confidence === "high" ? "high" as const : "medium" as const,
    };
    const ageMs = Math.max(0, input.now.getTime() - cachedPricePoint.pricedAt.getTime());

    if (ageMs <= CURRENT_PRICE_CACHE_TTL_MS) {
      input.priceLookup.set(address, cachedEntry);
    } else {
      staleFallbackPriceLookup.set(address, {
        ...cachedEntry,
        confidence: "medium",
      });
    }
  }

  const missingAddresses = normalizedAddresses.filter((address) => !input.priceLookup.has(address));
  if (missingAddresses.length === 0) {
    return false;
  }

  let priceFetchFailed = false;

  for (
    let batchStart = 0;
    batchStart < missingAddresses.length;
    batchStart += MAX_ALCHEMY_CURRENT_PRICE_ADDRESSES_PER_REQUEST
  ) {
    const addressBatch = missingAddresses.slice(
      batchStart,
      batchStart + MAX_ALCHEMY_CURRENT_PRICE_ADDRESSES_PER_REQUEST,
    );

    if (addressBatch.length === 0) {
      continue;
    }

    try {
      const prices = await getCurrentTokenPricesByAddress(input.chainId, addressBatch);
      await insertOverviewRawProviderRecord({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        provider: "alchemy",
        endpoint: "/prices/v1/tokens/by-address",
        requestJson: {
          chainId: input.chainId,
          addresses: addressBatch,
          maxAddressesPerRequest: MAX_ALCHEMY_CURRENT_PRICE_ADDRESSES_PER_REQUEST,
          batchSize: addressBatch.length,
        },
        responseJson: { resultCount: prices.data?.length ?? 0 },
      });

      for (const item of prices.data ?? []) {
        const address = item.address.toLowerCase();
        const usdPrice = item.prices?.find((price) => price.currency === "usd") ?? item.prices?.[0];
        const priceUsd = usdPrice ? Number(usdPrice.value) : NaN;
        if (!Number.isFinite(priceUsd)) {
          continue;
        }

        input.priceLookup.set(address, {
          priceUsd,
          pricedAt: usdPrice?.lastUpdatedAt ?? null,
          confidence: "high",
        });

        await upsertOverviewPricePoint({
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          tokenAddress: address,
          pricedAt: usdPrice?.lastUpdatedAt ? new Date(usdPrice.lastUpdatedAt) : input.now,
          priceUsd: String(priceUsd),
          metadataJson: { provider: "alchemy" },
        });
      }
    } catch {
      priceFetchFailed = true;
    }
  }

  for (const address of missingAddresses) {
    if (input.priceLookup.has(address)) {
      continue;
    }

    const staleFallbackEntry = staleFallbackPriceLookup.get(address);
    if (staleFallbackEntry) {
      input.priceLookup.set(address, staleFallbackEntry);
    }
  }

  return priceFetchFailed || missingAddresses.some((address) => !input.priceLookup.has(address));
}

async function hydrateHistoricalPriceLookup(input: {
  walletAddress: string;
  chainId: number;
  range: OverviewRange;
  bucketTimestamps: string[];
  granularity: "hour" | "day";
  addresses: string[];
  historicalPriceLookup: Map<string, Map<string, number>>;
  latestHistoricalPriceLookup: Map<string, { priceUsd: number; pricedAt: string | null }>;
  currentPriceLookup: Map<string, { priceUsd: number; pricedAt: string | null; confidence: "high" | "medium" }>;
}) {
  const normalizedAddresses = Array.from(
    new Set(
      input.addresses
        .map((address) => address.toLowerCase())
        .filter((address) => address.length > 0)
        .filter((address) => !input.historicalPriceLookup.has(address)),
    ),
  );

  if (normalizedAddresses.length === 0) {
    return false;
  }

  const startTime = input.bucketTimestamps[0] ?? new Date().toISOString();
  const endTime = input.bucketTimestamps[input.bucketTimestamps.length - 1] ?? new Date().toISOString();
  const resolution = input.granularity === "hour" ? "1h" : "1d";
  const cachedPriceRows = await readOverviewPricePointsInRange({
    chainId: input.chainId,
    tokenAddresses: normalizedAddresses,
    startAt: new Date(startTime),
    endAt: new Date(endTime),
    resolution,
  });
  const cachedRowsByAddress = new Map<string, typeof cachedPriceRows>();

  for (const cachedPriceRow of cachedPriceRows) {
    const address = cachedPriceRow.tokenAddress.toLowerCase();
    const existingRows = cachedRowsByAddress.get(address);
    if (existingRows) {
      existingRows.push(cachedPriceRow);
      continue;
    }

    cachedRowsByAddress.set(address, [cachedPriceRow]);
  }

  const addressesNeedingRemoteLookup: string[] = [];

  for (const address of normalizedAddresses) {
    const priceSeriesByBucket = new Map<string, number>();
    let latestHistoricalPoint: { priceUsd: number; pricedAt: string | null } | null = null;

    for (const cachedPriceRow of cachedRowsByAddress.get(address) ?? []) {
      const priceUsd = Number(cachedPriceRow.priceUsd);
      if (!Number.isFinite(priceUsd)) {
        continue;
      }

      if (
        !latestHistoricalPoint ||
        cachedPriceRow.pricedAt.getTime() > new Date(latestHistoricalPoint.pricedAt ?? 0).getTime()
      ) {
        latestHistoricalPoint = {
          priceUsd,
          pricedAt: cachedPriceRow.pricedAt.toISOString(),
        };
      }

      const bucketTimestamp = toBucketTimestamp(cachedPriceRow.pricedAt.toISOString(), input.granularity);
      if (!priceSeriesByBucket.has(bucketTimestamp)) {
        priceSeriesByBucket.set(bucketTimestamp, priceUsd);
      }
    }

    fillMissingBucketPrices(
      input.bucketTimestamps,
      priceSeriesByBucket,
      latestHistoricalPoint?.priceUsd ?? input.currentPriceLookup.get(address)?.priceUsd ?? null,
    );

    if (priceSeriesByBucket.size > 0) {
      input.historicalPriceLookup.set(address, priceSeriesByBucket);

      if (latestHistoricalPoint) {
        input.latestHistoricalPriceLookup.set(address, latestHistoricalPoint);
      }

      continue;
    }

    const currentPriceFallback = input.currentPriceLookup.get(address);
    if (currentPriceFallback) {
      for (const bucketTimestamp of input.bucketTimestamps) {
        priceSeriesByBucket.set(bucketTimestamp, currentPriceFallback.priceUsd);
      }

      input.historicalPriceLookup.set(address, priceSeriesByBucket);
      input.latestHistoricalPriceLookup.set(address, {
        priceUsd: currentPriceFallback.priceUsd,
        pricedAt: currentPriceFallback.pricedAt,
      });
      continue;
    }

    addressesNeedingRemoteLookup.push(address);
  }

  if (addressesNeedingRemoteLookup.length === 0) {
    return false;
  }

  const boundedAddresses = addressesNeedingRemoteLookup.slice(0, MAX_ALCHEMY_HISTORICAL_ADDRESSES_PER_REQUEST);
  const skippedAddressCount = addressesNeedingRemoteLookup.length - boundedAddresses.length;
  const historicalPriceResults: PromiseSettledResult<void>[] = [];

  for (let batchStart = 0; batchStart < boundedAddresses.length; batchStart += HISTORICAL_PRICE_BATCH_SIZE) {
    const batchAddresses = boundedAddresses.slice(batchStart, batchStart + HISTORICAL_PRICE_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batchAddresses.map(async (address) => {
        const priceSeriesByBucket = new Map<string, number>();
        let latestHistoricalPoint: { priceUsd: number; pricedAt: string | null } | null = null;

        try {
          const historicalPrices = await getHistoricalTokenPricesByAddress(input.chainId, {
            address,
            startTime,
            endTime,
            interval: resolution,
          });

          await insertOverviewRawProviderRecord({
            walletAddress: input.walletAddress,
            chainId: input.chainId,
            provider: "alchemy",
            endpoint: "/prices/v1/tokens/historical",
            requestJson: {
              chainId: input.chainId,
              address,
              startTime,
              endTime,
              interval: resolution,
              range: input.range,
              maxAddressesPerRequest: MAX_ALCHEMY_HISTORICAL_ADDRESSES_PER_REQUEST,
              skippedAddressCount,
            },
            responseJson: { resultCount: historicalPrices.data?.length ?? 0 },
          });

          for (const pricePoint of historicalPrices.data ?? []) {
            const priceUsd = Number(pricePoint.value);
            if (!Number.isFinite(priceUsd)) {
              continue;
            }

            if (
              !latestHistoricalPoint ||
              new Date(pricePoint.timestamp).getTime() > new Date(latestHistoricalPoint.pricedAt ?? 0).getTime()
            ) {
              latestHistoricalPoint = {
                priceUsd,
                pricedAt: pricePoint.timestamp,
              };
            }

            const bucketTimestamp = toBucketTimestamp(pricePoint.timestamp, input.granularity);
            priceSeriesByBucket.set(bucketTimestamp, priceUsd);

            await upsertOverviewPricePoint({
              walletAddress: input.walletAddress,
              chainId: input.chainId,
              tokenAddress: address,
              pricedAt: new Date(pricePoint.timestamp),
              priceUsd: String(priceUsd),
              resolution,
              metadataJson: {
                provider: "alchemy",
                range: input.range,
              },
            });
          }
        } catch (error) {
          const fallbackPriceEntry = input.currentPriceLookup.get(address);
          if (!fallbackPriceEntry) {
            throw error;
          }

          latestHistoricalPoint = {
            priceUsd: fallbackPriceEntry.priceUsd,
            pricedAt: fallbackPriceEntry.pricedAt,
          };
        }

        if (priceSeriesByBucket.size === 0 && latestHistoricalPoint) {
          for (const bucketTimestamp of input.bucketTimestamps) {
            priceSeriesByBucket.set(bucketTimestamp, latestHistoricalPoint.priceUsd);
          }
        }

        fillMissingBucketPrices(
          input.bucketTimestamps,
          priceSeriesByBucket,
          latestHistoricalPoint?.priceUsd ?? input.currentPriceLookup.get(address)?.priceUsd ?? null,
        );

        input.historicalPriceLookup.set(address, priceSeriesByBucket);

        if (latestHistoricalPoint) {
          input.latestHistoricalPriceLookup.set(address, latestHistoricalPoint);
        }
      }),
    );

    historicalPriceResults.push(...batchResults);
  }

  return skippedAddressCount > 0 || historicalPriceResults.some((result) => result.status === "rejected");
}

function buildHistoricalProtocolValueLookup(input: {
  bucketTimestamps: string[];
  seriesByToken: Map<string, Map<string, number>>;
  protocolRows: OverviewResponse["protocolPositions"]["rows"];
  manualArtifacts: {
    positions: Array<{
      tokenId: string;
      token0Address: string;
      token1Address: string;
    }>;
  } | null;
  mellowArtifacts: {
    wrappers: Array<{
      wrapperAddress: string;
      token0Address: string;
      token1Address: string;
    }>;
  } | null;
}) {
  const manualArtifactByTokenId = new Map(
    (input.manualArtifacts?.positions ?? []).map((position) => [position.tokenId, position] as const),
  );
  const mellowArtifactByWrapperAddress = new Map(
    (input.mellowArtifacts?.wrappers ?? []).map((wrapper) => [wrapper.wrapperAddress.toLowerCase(), wrapper] as const),
  );
  const pricedComponents: Array<{
    token0Address: string;
    token1Address: string;
    token0Amount: number | null;
    token1Amount: number | null;
  }> = [];
  let hasPartialHistory = false;

  for (const row of input.protocolRows) {
    if (row.family === "governance_lock") {
      hasPartialHistory = true;
      continue;
    }

    if (row.family === "manual_deposit" || row.family === "staked_lp") {
      if (!row.tokenId) {
        hasPartialHistory = true;
        continue;
      }

      const artifact = manualArtifactByTokenId.get(row.tokenId);
      if (!artifact) {
        hasPartialHistory = true;
        continue;
      }

      pricedComponents.push({
        token0Address: artifact.token0Address.toLowerCase(),
        token1Address: artifact.token1Address.toLowerCase(),
        token0Amount: row.primaryTokenAmount,
        token1Amount: row.secondaryTokenAmount,
      });
      continue;
    }

    if (row.family === "strategy_exposure") {
      const wrapperAddress = row.metadata.wrapperAddress?.toLowerCase() ?? null;
      if (!wrapperAddress) {
        hasPartialHistory = true;
        continue;
      }

      const artifact = mellowArtifactByWrapperAddress.get(wrapperAddress);
      if (!artifact) {
        hasPartialHistory = true;
        continue;
      }

      pricedComponents.push({
        token0Address: artifact.token0Address.toLowerCase(),
        token1Address: artifact.token1Address.toLowerCase(),
        token0Amount: row.primaryTokenAmount,
        token1Amount: row.secondaryTokenAmount,
      });
    }
  }

  const estimatedValues = buildHistoricalComponentValueLookup({
    bucketKeys: input.bucketTimestamps,
    seriesByToken: input.seriesByToken,
    components: pricedComponents,
  });

  return {
    estimatedDeployedValueByBucket: estimatedValues.valueByBucket,
    hasPartialHistory: hasPartialHistory || estimatedValues.hasPartialHistory,
  };
}

function calculatePercentChange(currentValue: number | null, previousValue: number | null) {
  if (currentValue === null || previousValue === null || previousValue === 0) {
    return null;
  }

  return (currentValue - previousValue) / previousValue;
}

function normalizeTokenMetadata(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function hasTokenMetadata(symbol: string | null, name: string | null, decimals: number | null) {
  return Boolean(symbol && name && decimals !== null);
}

function hasTokenLogo(token: MoralisTokenRecord) {
  return Boolean(
    asString(token.logo) ?? asString(token.logo_url) ?? asString(token.thumbnail),
  );
}

function sanitizeMoralisTokenForPersistence(token: MoralisTokenRecord) {
  return {
    tokenAddress: asString(token.token_address)?.toLowerCase() ?? null,
    symbol: asString(token.symbol),
    name: asString(token.name),
    balanceRaw: asString(token.balance),
    balanceFormatted: asString(token.balance_formatted),
    decimals: asNumber(token.decimals),
    possibleSpam: asBooleanOrNull(token.possible_spam),
    verifiedContract: asBooleanOrNull(token.verified_contract),
    nativeToken: asBoolean(token.native_token),
    hasLogo: hasTokenLogo(token),
  };
}

function sanitizeMoralisHistoryForPersistence(record: MoralisHistoryRecord) {
  return {
    hash: asString(record.hash) ?? asString(record.transaction_hash),
    category: asString(record.category),
    methodLabel: asString(record.method_label),
    summary: asString(record.summary),
    fromAddress: asString(record.from_address)?.toLowerCase() ?? null,
    toAddress: asString(record.to_address)?.toLowerCase() ?? null,
    fromAddressLabel: asString(record.from_address_label),
    toAddressLabel: asString(record.to_address_label),
    nftTransferCount: Array.isArray(record.nft_transfers) ? record.nft_transfers.length : 0,
    erc20TransferCount: Array.isArray(record.erc20_transfers) ? record.erc20_transfers.length : 0,
    blockTimestamp: asString(record.block_timestamp) ?? asString(record.block_time),
  };
}

function sanitizeMoralisDefiPositionForPersistence(position: Record<string, unknown>) {
  const keys = Object.keys(position).slice(0, 24);
  const labels = keys
    .map((key) => (typeof position[key] === "string" ? asString(position[key]) : null))
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);

  return {
    keys,
    labels,
  };
}

function sumNullableUsd(values: Array<number | null>) {
  const pricedValues = values.filter((value): value is number => value !== null);
  if (pricedValues.length === 0) {
    return null;
  }

  return pricedValues.reduce((sum, value) => sum + value, 0);
}

function sumRewardEventValueUsd(values: Array<{ amountUsd: string | number | null }>) {
  return values.reduce((sum, row) => sum + (asNumber(row.amountUsd) ?? 0), 0);
}

function toOverviewCoverageStatus(
  status: OverviewResponse["protocolPositions"]["coverageStatus"],
): OverviewResponse["distribution"]["slices"][number]["coverageStatus"] {
  if (status === "full") {
    return "recent";
  }

  return status;
}

function toRequiredOverviewCoverageStatus(
  status: OverviewResponse["protocolPositions"]["coverageStatus"],
): OverviewResponse["coverage"]["status"] {
  if (status === "full") {
    return "recent";
  }

  if (status === "partial") {
    return "partial";
  }

  return "unknown";
}

function buildHiddenAssetReasonCodes(rows: TrustHydratedAssetRow[]): OverviewTrustCoverageReasonCode[] {
  const reasonCodes: OverviewTrustCoverageReasonCode[] = [];

  if (rows.length > 0) {
    reasonCodes.push("hiddenAssetsPresent");
  }

  if (rows.some((row) => row.assetRow.trustStatus === "possible_spam" || row.assetRow.trustStatus === "blocked")) {
    reasonCodes.push("excludedSuspiciousAssets");
  }

  if (rows.some((row) => row.assetRow.trustStatus === "low_confidence")) {
    reasonCodes.push("lowConfidenceAssetsHidden");
  }

  if (rows.some((row) => row.trustInput.isDustValue)) {
    reasonCodes.push("dustAssetsHidden");
  }

  return Array.from(new Set(reasonCodes));
}

function buildExclusionSummary(
  hiddenRows: TrustHydratedAssetRow[],
  visibleRows: TrustHydratedAssetRow[],
): OverviewExclusionSummary | null {
  const visibleUnpricedRows = visibleRows.filter((row) => row.assetRow.valueUsd === null);
  const excludedAssetCount = hiddenRows.length + visibleUnpricedRows.length;

  if (excludedAssetCount === 0) {
    return null;
  }

  const reasonCodes: OverviewTrustCoverageReasonCode[] = [
    ...buildHiddenAssetReasonCodes(hiddenRows),
    ...(visibleUnpricedRows.length > 0 ? (["visibleUnpricedAssets", "valuationPartial"] as const) : []),
  ];

  return {
    excludedAssetCount,
    excludedValueUsd: sumNullableUsd(hiddenRows.map((row) => row.assetRow.valueUsd)),
    reasonCodes: Array.from(new Set(reasonCodes)),
    includesUnpricedVisibleAssets: visibleUnpricedRows.length > 0,
  };
}

function buildCoverageReasonCodes(
  rows: TrustHydratedAssetRow[],
  input: {
    providerPartial: boolean;
    chartPartial: boolean;
    hasRecentActivity: boolean;
  },
): OverviewCoverageReasonCode[] {
  const hiddenRows = rows.filter((row) => row.assetRow.isHiddenByDefault);
  const visibleRows = rows.filter((row) => !row.assetRow.isHiddenByDefault);
  const visibleUnpricedRows = visibleRows.filter((row) => row.assetRow.valueUsd === null);
  const reasonCodes: OverviewCoverageReasonCode[] = ["analysisPending"];

  if (input.providerPartial) {
    reasonCodes.push("providerPartial");
  }

  if (!input.hasRecentActivity) {
    reasonCodes.push("noRecentActivity");
  }

  if (rows.some((row) => row.assetRow.priceUsd === null) || input.chartPartial) {
    reasonCodes.push("missingPrices");
  }

  if (visibleUnpricedRows.length > 0) {
    reasonCodes.push("visibleUnpricedAssets", "valuationPartial");
  }

  if (hiddenRows.length > 0) {
    reasonCodes.push(...buildHiddenAssetReasonCodes(hiddenRows));
  }

  if (rows.some((row) => !row.trustInput.hasMetadata || !row.trustInput.hasLogo)) {
    reasonCodes.push("metadataIncomplete");
  }

  if (rows.some((row) => row.trustInput.moralisPossibleSpam === null || row.trustInput.moralisVerifiedContract === null)) {
    reasonCodes.push("providerTrustSignalsMissing");
  }

  if (rows.some((row) => row.knownProtocolConflict)) {
    reasonCodes.push("knownProtocolSignalConflict");
  }

  return Array.from(new Set(reasonCodes));
}

function buildProviderPartialReasonCodes(
  existingReasonCodes: OverviewCoverageReasonCode[] | null | undefined,
): OverviewCoverageReasonCode[] {
  return Array.from(new Set([...(existingReasonCodes ?? []), "analysisPending", "providerPartial"]));
}

function isProviderRequestFailed(error: unknown) {
  return error instanceof Error && error.message.startsWith("PROVIDER_REQUEST_FAILED");
}

async function getRecentOverviewChartFallback(input: OverviewRequest): Promise<OverviewResponse> {
  const response = await getRecentOverviewShell(input);
  const now = new Date();
  const bucketConfig = getRecentOverviewBucketConfig(input.range);
  const bucketTimestamps = buildBucketTimestamps(input.range, now);
  const rangeStartAt = new Date(bucketTimestamps[0] ?? now.toISOString());
  const [historicalSnapshotRows, analyzedSnapshotRows, realizedRewardRows] = await Promise.all([
    readOverviewPortfolioSnapshots({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      startAt: rangeStartAt,
      endAt: now,
    }),
    canUseAnalyzedOverviewActivity(response.analysis.status) && bucketConfig.granularity === "day"
      ? readOverviewAnalyzedPortfolioSnapshots({
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          startAt: rangeStartAt,
          endAt: now,
        })
      : Promise.resolve([]),
    readOverviewRealizedRewardEvents({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      startAt: rangeStartAt,
      endAt: now,
    }),
  ]);
  const coverageReasonCodes = buildProviderPartialReasonCodes(response.coverage.reasonCodes);
  const rewardValuesByBucket = buildRewardValueLookup({
    granularity: bucketConfig.granularity,
    rewardRows: realizedRewardRows,
  });
  const estimatedRealizedRewardsUsd = sumRewardEventValueUsd(realizedRewardRows);
  const snapshotValuesByBucket = buildSnapshotValueLookup({
    range: input.range,
    granularity: bucketConfig.granularity,
    snapshotRows: [...historicalSnapshotRows, ...analyzedSnapshotRows],
    currentPoint: {
      capturedAt: now,
      totalValueUsd: response.metrics.netPortfolioValueUsd,
      deployedValueUsd: response.metrics.deployedValueUsd,
      idleValueUsd: response.metrics.idleValueUsd,
      rewardValueUsd: rewardValuesByBucket.get(toBucketTimestamp(now.toISOString(), bucketConfig.granularity)) ?? null,
    },
  });
  const chartPoints: OverviewChartPoint[] = bucketTimestamps.map((bucketTimestamp) => {
    const snapshot = snapshotValuesByBucket.get(bucketTimestamp);

    return {
      capturedAt: bucketTimestamp,
      totalValueUsd: snapshot?.totalValueUsd ?? null,
      deployedValueUsd: snapshot?.deployedValueUsd ?? null,
      idleValueUsd: snapshot?.idleValueUsd ?? null,
      rewardValueUsd:
        (() => {
          const derivedRewardValueUsd = rewardValuesByBucket.get(bucketTimestamp) ?? null;
          if (derivedRewardValueUsd !== null && derivedRewardValueUsd > 0) {
            return derivedRewardValueUsd;
          }

          return snapshot?.rewardValueUsd ?? null;
        })(),
    };
  });
  const hasRewardMarkers = chartPoints.some((point) => (point.rewardValueUsd ?? 0) > 0);
  const hasChartValues = chartPoints.some((point) =>
    point.totalValueUsd !== null || point.deployedValueUsd !== null || point.idleValueUsd !== null,
  );
  const distributionSlices: OverviewResponse["distribution"]["slices"] = [];

  if (response.metrics.idleValueUsd && response.metrics.idleValueUsd > 0) {
    distributionSlices.push({
      dimension: "idle",
      label: "Idle assets",
      valueUsd: response.metrics.idleValueUsd,
      coverageStatus: "partial",
      composition: null,
    });
  }

  if (response.metrics.deployedValueUsd && response.metrics.deployedValueUsd > 0) {
    distributionSlices.push({
      dimension: "strategy",
      label: "Deployed positions",
      valueUsd: response.metrics.deployedValueUsd,
      coverageStatus: "partial",
      composition: null,
    });
  }

  response.coverage = {
    ...response.coverage,
    status: "partial",
    confidence: "medium",
    reasonCodes: coverageReasonCodes,
  };
  response.summary = {
    ...response.summary,
    coverageStatus: "partial",
    coverageReasonCodes,
    lastRefreshedAt: response.summary.lastRefreshedAt,
  };
  response.metrics = {
    ...response.metrics,
    coverageStatus: "partial",
    coverageReasonCodes,
    estimatedRealizedRewardsUsd,
  };
  response.chart = {
    ...response.chart,
    source: "partial_fallback",
    coverageStatus: "partial",
    coverageReasonCodes,
    range: input.range,
    hasRewardMarkers,
    points: hasChartValues ? chartPoints : [],
    events: [],
  };
  response.distribution = {
    ...response.distribution,
    source: "partial_fallback",
    coverageStatus: "partial",
    coverageReasonCodes,
    slices: distributionSlices,
  };

  return response;
}

async function getRecentOverviewCurrentStateFallback(input: OverviewRequest): Promise<OverviewResponse> {
  const response = await getRecentOverviewShell(input);
  const coverageReasonCodes = buildProviderPartialReasonCodes(response.coverage.reasonCodes);

  response.coverage = {
    ...response.coverage,
    status: "partial",
    confidence: "medium",
    reasonCodes: coverageReasonCodes,
  };
  response.summary = {
    ...response.summary,
    coverageStatus: "partial",
    coverageReasonCodes,
    lastRefreshedAt: response.summary.lastRefreshedAt,
  };
  response.metrics = {
    ...response.metrics,
    coverageStatus: "partial",
    coverageReasonCodes,
    exclusions: null,
  };
  response.assets = {
    ...response.assets,
    source: "partial_fallback",
    coverageStatus: "partial",
    coverageReasonCodes,
    rows: [],
    hiddenSummary: null,
    defaultVisibleCount: 0,
  };

  return response;
}

function resolveAlchemyPricingAddress(
  chainId: number,
  tokenAddress: string | null,
  symbol: string | null,
  options?: {
    name?: string | null;
    nativeToken?: boolean;
    verifiedContract?: boolean;
  },
) {
  const normalizedAddress = tokenAddress?.toLowerCase() ?? null;
  const normalizedSymbol = normalizeTokenMetadata(symbol);
  const normalizedName = normalizeTokenMetadata(options?.name ?? null);
  const nativeToken = options?.nativeToken === true;
  const trustedToken = nativeToken || options?.verifiedContract === true;

  if (chainId === 8453) {
    if (
      nativeToken ||
      normalizedAddress === NATIVE_ETH_SENTINEL ||
      normalizedAddress === BASE_WETH_ADDRESS ||
      (trustedToken && (
        normalizedSymbol === "weth" ||
        (normalizedSymbol === "eth" && normalizedName === "ether") ||
        normalizedName === "wrapped ether"
      ))
    ) {
      return BASE_WETH_ADDRESS;
    }

    if (
      normalizedAddress === BASE_CBBTC_ADDRESS ||
      (trustedToken && (
        normalizedSymbol === "cbbtc" ||
        normalizedName === "coinbase wrapped btc" ||
        normalizedName === "coinbase wrapped bitcoin"
      ))
    ) {
      return BASE_CBBTC_ADDRESS;
    }

    if (
      normalizedAddress === BASE_AERO_ADDRESS ||
      (trustedToken && (
        normalizedSymbol === "aero" ||
        normalizedName === "aerodrome" ||
        normalizedName === "aerodrome finance"
      ))
    ) {
      return BASE_AERO_ADDRESS;
    }
  }

  return normalizedAddress;
}

function isPriorityPricingAsset(pricingAddress: string | null) {
  return pricingAddress === BASE_WETH_ADDRESS ||
    pricingAddress === BASE_USDC_ADDRESS ||
    pricingAddress === BASE_CBBTC_ADDRESS ||
    pricingAddress === BASE_AERO_ADDRESS;
}

function getHistoricalBaselinePrice(
  priceSeries: Map<string, number> | undefined,
  fallbackBucketTimestamp: string | null,
) {
  if (!priceSeries || !fallbackBucketTimestamp) {
    return null;
  }

  return priceSeries.get(fallbackBucketTimestamp) ?? null;
}

export async function getRecentOverview(input: OverviewRequest): Promise<OverviewResponse> {
  const response = createEmptyRecentOverviewResponse(input);
  const now = new Date();
  const bucketConfig = getRecentOverviewBucketConfig(input.range);
  const bucketTimestamps = buildBucketTimestamps(input.range, now);
  const rangeStartAt = new Date(bucketTimestamps[0] ?? now.toISOString());
  const [tokensResult, historyResult, defiPositionsResult, latestRun, freshness, protocolMetadata, realizedRewardRows] = await Promise.all([
    getWalletTokens(input.walletAddress, input.chainId).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getWalletHistory(input.walletAddress, input.chainId, 50).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getWalletDefiPositions(input.walletAddress, input.chainId).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getLatestAnalysisRun(input.walletAddress, input.chainId),
    readOverviewFreshness(input),
    readKnownProtocolContracts({ chainId: input.chainId }),
    readOverviewRealizedRewardEvents({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      startAt: rangeStartAt,
      endAt: now,
    }),
  ]);

  if (
    tokensResult.status === "rejected" &&
    historyResult.status === "rejected" &&
    defiPositionsResult.status === "rejected"
  ) {
    throw new Error("PROVIDER_REQUEST_FAILED");
  }
  response.analysis = createOverviewAnalysisState({ latestRun, freshness });

  const analyzedActivityRows = canUseAnalyzedOverviewActivity(response.analysis.status)
    ? await readRecentOverviewAnalyzedActivity(
        buildOverviewAnalyzedActivityReadInput({
          surface: "chart",
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          range: input.range,
          startAt: rangeStartAt,
          endAt: now,
        }),
      )
    : [];

  const tokens = tokensResult.status === "fulfilled" ? (tokensResult.value.result ?? []) : [];
  const history = historyResult.status === "fulfilled" ? (historyResult.value.result ?? []) : [];
  const defiPositions = defiPositionsResult.status === "fulfilled" ? defiPositionsResult.value : [];
  const estimatedRealizedRewardsUsd = sumRewardEventValueUsd(realizedRewardRows);

  const tokenPricingContexts = tokens.map((token) => {
    const tokenAddress = asString(token.token_address)?.toLowerCase() ?? null;
    const symbol = asString(token.symbol) ?? "UNKNOWN";
    const name = asString(token.name);
    const pricingAddress = resolveAlchemyPricingAddress(input.chainId, tokenAddress, symbol, {
      name,
      nativeToken: asBoolean(token.native_token),
      verifiedContract: asBoolean(token.verified_contract),
    });

    return {
      token,
      tokenAddress,
      symbol,
      name,
      pricingAddress,
      moralisPriceUsd: asNumber(token.usd_price),
      moralisValueUsd: asNumber(token.usd_value),
      isPriorityPricingAsset: isPriorityPricingAsset(pricingAddress),
    };
  });

  if (tokensResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/tokens",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId },
      responseJson: {
        resultCount: tokens.length,
        tokens: tokens.map((token) => sanitizeMoralisTokenForPersistence(token as MoralisTokenRecord)),
      },
    });
  }

  if (historyResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/history",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId, limit: 50 },
      responseJson: {
        resultCount: history.length,
        items: history.slice(0, 20).map((item) => sanitizeMoralisHistoryForPersistence(item as MoralisHistoryRecord)),
      },
    });
  }

  if (defiPositionsResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/defi/positions",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId },
      responseJson: {
        resultCount: defiPositions.length,
        items: defiPositions.slice(0, 20).map((position) => sanitizeMoralisDefiPositionForPersistence(position)),
      },
    });
  }

  const uniqueTokenAddresses = Array.from(
    new Map(
      [...tokenPricingContexts]
        .sort((left, right) => {
          if (left.isPriorityPricingAsset !== right.isPriorityPricingAsset) {
            return Number(right.isPriorityPricingAsset) - Number(left.isPriorityPricingAsset);
          }

          return (right.moralisValueUsd ?? -1) - (left.moralisValueUsd ?? -1);
        })
        .filter((context) => Boolean(context.pricingAddress))
        .map((context) => [context.pricingAddress as string, context]),
    ).keys(),
  );

  const priceLookup = new Map<string, { priceUsd: number; pricedAt: string | null; confidence: "high" | "medium" }>();
  const historicalPriceLookup = new Map<string, Map<string, number>>();
  const latestHistoricalPriceLookup = new Map<string, { priceUsd: number; pricedAt: string | null }>();
  let priceFetchFailed = false;
  let historicalPriceFetchFailed = false;
  priceFetchFailed = await hydrateCurrentPriceLookup({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    addresses: uniqueTokenAddresses,
    now,
    priceLookup,
  });

  const [historicalSnapshotRows, analyzedSnapshotRows] = await Promise.all([
    readOverviewPortfolioSnapshots({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      startAt: rangeStartAt,
      endAt: now,
    }),
    canUseAnalyzedOverviewActivity(response.analysis.status) && bucketConfig.granularity === "day"
      ? readOverviewAnalyzedPortfolioSnapshots({
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          startAt: rangeStartAt,
          endAt: now,
        })
      : Promise.resolve([]),
  ]);

  historicalPriceFetchFailed = await hydrateHistoricalPriceLookup({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    range: input.range,
    bucketTimestamps,
    granularity: bucketConfig.granularity,
    addresses: uniqueTokenAddresses,
    historicalPriceLookup,
    latestHistoricalPriceLookup,
    currentPriceLookup: priceLookup,
  });

  const hydratedAssetRows = tokenPricingContexts.map((context) => {
    const decimals = asNumber(context.token.decimals);
    const balanceRaw = asString(context.token.balance);
    const balance = asString(context.token.balance_formatted) ?? formatBalance(balanceRaw, decimals);
    const pricingAddress = context.pricingAddress;
    const priceEntry = pricingAddress ? priceLookup.get(pricingAddress) : null;
    const historicalFallbackPriceEntry = pricingAddress ? latestHistoricalPriceLookup.get(pricingAddress) : null;
    const historicalSeries = pricingAddress ? historicalPriceLookup.get(pricingAddress) : undefined;
    const resolvedPriceEntry =
      priceEntry ??
      (historicalFallbackPriceEntry
        ? {
            priceUsd: historicalFallbackPriceEntry.priceUsd,
            pricedAt: historicalFallbackPriceEntry.pricedAt,
            confidence: "medium" as const,
          }
        : null);
    const priceUsd = resolvedPriceEntry?.priceUsd ?? null;
    const valueUsd = priceUsd !== null ? Number.parseFloat(balance) * priceUsd : null;
    const movement24hBaseline = getHistoricalBaselinePrice(
      historicalSeries,
      bucketTimestamps[Math.max(0, bucketTimestamps.length - 2)] ?? null,
    );
    const movement7dBaseline = getHistoricalBaselinePrice(historicalSeries, bucketTimestamps[0] ?? null);
    const knownProtocolMatch = resolveKnownProtocolAssetMatch(
      input.chainId,
      context.tokenAddress,
      protocolMetadata,
    );
    const trustInput: AssetTrustClassifierInput = {
      walletAddress: input.walletAddress.toLowerCase(),
      chainId: input.chainId,
      tokenAddress: context.tokenAddress,
      symbol: context.symbol,
      name: context.name,
      balanceRaw: balanceRaw ?? "0",
      balanceFormatted: balance,
      valueUsd,
      hasReliableAlchemyPrice: resolvedPriceEntry !== null,
      moralisPossibleSpam: asBooleanOrNull(context.token.possible_spam),
      moralisVerifiedContract: asBooleanOrNull(context.token.verified_contract),
      hasLogo: hasTokenLogo(context.token),
      hasMetadata: hasTokenMetadata(context.symbol, context.name, decimals),
      isKnownProtocolAsset: knownProtocolMatch !== null,
      isNativeAsset: asBoolean(context.token.native_token),
      isDustValue: valueUsd !== null ? valueUsd < DUST_VALUE_THRESHOLD_USD : Number.parseFloat(balance) === 0,
      classifierVersion: ASSET_TRUST_CLASSIFIER_VERSION,
    };
    const trustClassification = classifyWalletAssetTrust(trustInput, {
      knownProtocolReasonCode: knownProtocolMatch?.reasonCode ?? null,
    });

    return {
      assetRow: {
        tokenAddress: context.tokenAddress,
        chainId: input.chainId,
        symbol: context.symbol,
        name: context.name,
        balance,
        priceUsd,
        valueUsd,
        movement24hPct: calculatePercentChange(priceUsd, movement24hBaseline),
        movement7dPct:
          input.range === "24h" ? null : calculatePercentChange(priceUsd, movement7dBaseline),
        classification: "idle" as const,
        priceConfidence: resolvedPriceEntry?.confidence ?? null,
        trustStatus: trustClassification.trustStatus,
        trustReasonCodes: trustClassification.trustReasonCodes,
        isHiddenByDefault: trustClassification.isHiddenByDefault,
        classifierVersion: trustClassification.classifierVersion,
      },
      trustInput,
      knownProtocolConflict:
        knownProtocolMatch !== null && asBooleanOrNull(context.token.possible_spam) === true,
    };
  });

  const assetRows = hydratedAssetRows.map((row) => row.assetRow);
  const hiddenAssetRows = hydratedAssetRows.filter((row) => row.assetRow.isHiddenByDefault);
  const visibleAssetRows = hydratedAssetRows.filter((row) => !row.assetRow.isHiddenByDefault);
  const pricedVisibleAssetRows = visibleAssetRows.filter((row) => row.assetRow.valueUsd !== null);
  const idleValueUsd = sumNullableUsd(pricedVisibleAssetRows.map((row) => row.assetRow.valueUsd));
  const hiddenAssetReasonCodes = buildHiddenAssetReasonCodes(hiddenAssetRows);
  const exclusionSummary = buildExclusionSummary(hiddenAssetRows, visibleAssetRows);
  const protocolPositions = await detectProtocolPositions({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    protocolContracts: protocolMetadata,
    walletTokens: tokens,
    defiPositions,
    history,
    now,
  });
  if (protocolPositions.artifacts.manualCurrentState) {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "alchemy",
      endpoint: "/rpc/aerodrome/manual-positions",
      requestJson: {
        walletAddress: input.walletAddress,
        chainId: input.chainId,
      },
      responseJson: protocolPositions.artifacts.manualCurrentState,
    });
  }
  if (protocolPositions.artifacts.mellowCurrentState) {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "alchemy",
      endpoint: "/rpc/mellow/strategy-wrappers",
      requestJson: {
        walletAddress: input.walletAddress,
        chainId: input.chainId,
      },
      responseJson: protocolPositions.artifacts.mellowCurrentState,
    });
  }
  const manualDepositsValueUsd = sumNullableUsd(
    protocolPositions.block.rows
      .filter((row) => row.family === "manual_deposit")
      .map((row) => row.valueUsd),
  );
  const automatedStrategiesValueUsd = sumNullableUsd(
    protocolPositions.block.rows
      .filter((row) => row.family === "strategy_exposure")
      .map((row) => row.valueUsd),
  );
  const governanceValueUsd = sumNullableUsd(
    protocolPositions.block.rows
      .filter((row) => row.family === "governance_lock")
      .map((row) => row.valueUsd),
  );
  const residualAttributedValueUsd = sumNullableUsd(
    protocolPositions.block.rows
      .filter((row) => row.family === "staked_lp")
      .map((row) => row.valueUsd),
  );
  const deployedValueUsd = sumNullableUsd(protocolPositions.block.rows.map((row) => row.valueUsd));
  const totalValueUsd =
    idleValueUsd === null && deployedValueUsd === null
      ? null
      : (idleValueUsd ?? 0) + (deployedValueUsd ?? 0);

  const protocolPriceAddresses = Array.from(
    new Set(
      [
        ...(protocolPositions.artifacts.manualCurrentState?.priceAddresses ?? []),
        ...(protocolPositions.artifacts.mellowCurrentState?.priceAddresses ?? []),
      ].map((address) => address.toLowerCase()),
    ),
  );
  const missingCurrentProtocolPriceAddresses = protocolPriceAddresses.filter(
    (address) => !priceLookup.has(address),
  );

  if (missingCurrentProtocolPriceAddresses.length > 0) {
    priceFetchFailed =
      (await hydrateCurrentPriceLookup({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        addresses: missingCurrentProtocolPriceAddresses,
        now,
        priceLookup,
      })) || priceFetchFailed;
  }

  historicalPriceFetchFailed =
    (await hydrateHistoricalPriceLookup({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      range: input.range,
      bucketTimestamps,
      granularity: bucketConfig.granularity,
      addresses: protocolPriceAddresses,
      historicalPriceLookup,
      latestHistoricalPriceLookup,
      currentPriceLookup: priceLookup,
    })) || historicalPriceFetchFailed;

  const historicalProtocolValues = buildHistoricalProtocolValueLookup({
    bucketTimestamps,
    seriesByToken: historicalPriceLookup,
    protocolRows: protocolPositions.block.rows,
    manualArtifacts: protocolPositions.artifacts.manualCurrentState,
    mellowArtifacts: protocolPositions.artifacts.mellowCurrentState,
  });

  const snapshotValuesByBucket = buildSnapshotValueLookup({
    range: input.range,
    granularity: bucketConfig.granularity,
    snapshotRows: [...historicalSnapshotRows, ...analyzedSnapshotRows],
    currentPoint: {
      capturedAt: now,
      totalValueUsd,
      deployedValueUsd,
      idleValueUsd,
      rewardValueUsd: null,
    },
  });
  const rewardValuesByBucket = buildRewardValueLookup({
    granularity: bucketConfig.granularity,
    rewardRows: realizedRewardRows,
  });
  const rewardValueByTxHash = new Map(
    realizedRewardRows
      .filter((row) => (asNumber(row.amountUsd) ?? 0) > 0)
      .map((row) => [row.txHash.toLowerCase(), asNumber(row.amountUsd) ?? 0] as const),
  );

  const chartSeries = buildChartPoints(
    bucketTimestamps,
    historicalPriceLookup,
    visibleAssetRows
      .filter(
        (row) => Number.isFinite(Number.parseFloat(row.assetRow.balance)),
      )
      .map((row) => ({
        tokenAddress: resolveAlchemyPricingAddress(
          input.chainId,
          row.assetRow.tokenAddress,
          row.assetRow.symbol,
        ) ?? "",
        balance: Number.parseFloat(row.assetRow.balance),
      }))
      .filter((row) => row.tokenAddress.length > 0),
    snapshotValuesByBucket,
    rewardValuesByBucket,
    historicalProtocolValues.estimatedDeployedValueByBucket,
    protocolPositions.block.rows.length > 0,
    historicalProtocolValues.hasPartialHistory,
  );
  const hasRewardMarkers = chartSeries.points.some((point) => (point.rewardValueUsd ?? 0) > 0);

  const firstChartValue = chartSeries.points.find((point) => point.totalValueUsd !== null)?.totalValueUsd ?? null;
  const lastChartValue = [...chartSeries.points]
    .reverse()
    .find((point) => point.totalValueUsd !== null)?.totalValueUsd ?? null;

  const providerPartial =
    tokensResult.status === "rejected" ||
    historyResult.status === "rejected" ||
    defiPositionsResult.status === "rejected" ||
    protocolPositions.providerPartial ||
    priceFetchFailed ||
    historicalPriceFetchFailed;
  const missingPrices = assetRows.some((row) => row.priceUsd === null);
  const chartPartial = chartSeries.hasPartialHistory || chartSeries.points.some((point) => point.totalValueUsd === null);
  const uniqueCoverageReasonCodes = Array.from(
    new Set([
      ...buildCoverageReasonCodes(hydratedAssetRows, {
        providerPartial,
        chartPartial,
        hasRecentActivity: history.length > 0,
      }),
      ...(protocolPositions.block.coverageReasonCodes ?? []),
    ]),
  );
  const coverageStatus =
    providerPartial ||
    missingPrices ||
    hiddenAssetRows.length > 0 ||
    Boolean(exclusionSummary) ||
    chartPartial ||
    (protocolPositions.block.rows.length > 0 && protocolPositions.block.coverageStatus !== "full")
      ? "partial"
      : "recent";

  response.coverage = {
    status: coverageStatus,
    confidence: coverageStatus === "partial" ? "medium" : "high",
    reasonCodes: uniqueCoverageReasonCodes,
    details: null,
  };

  response.summary = {
    ...response.summary,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    lastRefreshedAt: now.toISOString(),
  };

  response.metrics = {
    ...response.metrics,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    netPortfolioValueUsd: totalValueUsd,
    deployedValueUsd,
    idleValueUsd,
    changeOverSelectedPeriodPct:
      protocolPositions.block.rows.length > 0 ? null : calculatePercentChange(lastChartValue, firstChartValue),
    estimatedRealizedRewardsUsd,
    manualDepositsValueUsd,
    automatedStrategiesValueUsd,
    residualAttributedValueUsd,
    governanceValueUsd,
    exclusions: exclusionSummary,
  };

  response.chart = {
    ...response.chart,
    source: chartPartial ? "partial_fallback" : "recent_provider_data",
    coverageStatus: chartPartial ? "partial" : coverageStatus,
    coverageReasonCodes: chartPartial ? uniqueCoverageReasonCodes : uniqueCoverageReasonCodes,
    hasRewardMarkers,
    points: chartSeries.points,
    events: buildOverviewChartEvents({
      rows: analyzedActivityRows,
      range: input.range,
      rewardValueByTxHash,
      rewardRows: realizedRewardRows,
    }),
  };

  await Promise.all(
    chartSeries.points
      .filter((point) => point.totalValueUsd !== null)
      .map((point) =>
        insertOverviewPortfolioSnapshot({
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          capturedAt: new Date(point.capturedAt),
          totalValueUsd: String(point.totalValueUsd),
          deployedValueUsd: point.deployedValueUsd !== null ? String(point.deployedValueUsd) : null,
          idleValueUsd: point.idleValueUsd !== null ? String(point.idleValueUsd) : null,
          metadataJson: {
            range: input.range,
            source: "recent_provider_data",
            snapshotKind: "range_bucket",
            coverageStatus: response.chart.coverageStatus,
            coverageReasonCodes: uniqueCoverageReasonCodes,
            rewardValueUsd: point.rewardValueUsd,
          },
        }),
      ),
  );

  const distributionSlices: OverviewResponse["distribution"]["slices"] = [];

  if (idleValueUsd && idleValueUsd > 0) {
    distributionSlices.push({
      dimension: "idle",
      label: "Idle assets",
      valueUsd: idleValueUsd,
      coverageStatus,
      composition: null,
    });
  }

  if (manualDepositsValueUsd && manualDepositsValueUsd > 0) {
    distributionSlices.push({
      dimension: "manual_deposit",
      label: "Manual deposits",
      valueUsd: manualDepositsValueUsd,
      coverageStatus: toOverviewCoverageStatus(protocolPositions.block.coverageStatus),
      composition: buildDistributionSliceComposition(protocolPositions.block.rows, "manual_deposit"),
    });
  }

  if (automatedStrategiesValueUsd && automatedStrategiesValueUsd > 0) {
    distributionSlices.push({
      dimension: "strategy",
      label: "Automated strategies",
      valueUsd: automatedStrategiesValueUsd,
      coverageStatus: toOverviewCoverageStatus(protocolPositions.block.coverageStatus),
      composition: buildDistributionSliceComposition(protocolPositions.block.rows, "strategy_exposure"),
    });
  }

  if (governanceValueUsd && governanceValueUsd > 0) {
    distributionSlices.push({
      dimension: "governance",
      label: "Governance locks",
      valueUsd: governanceValueUsd,
      coverageStatus: toOverviewCoverageStatus(protocolPositions.block.coverageStatus),
      composition: buildDistributionSliceComposition(protocolPositions.block.rows, "governance_lock"),
    });
  }

  if (residualAttributedValueUsd && residualAttributedValueUsd > 0) {
    distributionSlices.push({
      dimension: "staked_lp",
      label: "Staked LP",
      valueUsd: residualAttributedValueUsd,
      coverageStatus: toOverviewCoverageStatus(protocolPositions.block.coverageStatus),
      composition: buildDistributionSliceComposition(protocolPositions.block.rows, "staked_lp"),
    });
  }

  response.distribution = {
    ...response.distribution,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    exclusions: exclusionSummary,
    slices: distributionSlices,
  };

  response.assets = {
    ...response.assets,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    rows: assetRows,
    hiddenSummary:
      hiddenAssetRows.length > 0
        ? {
            hiddenCount: hiddenAssetRows.length,
            hiddenValueUsd: sumNullableUsd(hiddenAssetRows.map((row) => row.assetRow.valueUsd)),
            reasonCodes: hiddenAssetReasonCodes,
            affectsTotals: true,
            allVisibleAssetsUnpricedOrZero:
              visibleAssetRows.length === 0 ||
              visibleAssetRows.every((row) => (row.assetRow.valueUsd ?? 0) <= 0),
          }
        : null,
    defaultVisibleCount: visibleAssetRows.length,
  };

  response.protocolPositions = protocolPositions.block;

  if (analyzedActivityRows.length > 0) {
    buildOverviewActivityFromAnalyzedRows({
      response,
      rows: analyzedActivityRows,
    });
  } else {
    buildOverviewActivityBlock({
      response,
      history,
      historyFulfilled: historyResult.status === "fulfilled",
      now,
      walletAddress: input.walletAddress,
    });
  }

  await insertOverviewCoverageReport({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    scope: "overview",
    status: coverageStatus,
    confidence: response.coverage.confidence ?? "medium",
    metadataJson: {
      reasonCodes: uniqueCoverageReasonCodes,
      range: input.range,
      classifierVersion: ASSET_TRUST_CLASSIFIER_VERSION,
      protocolPositions: {
        summary: protocolPositions.block.summary,
        coverageReasonCodes: protocolPositions.block.coverageReasonCodes,
        usedRecentReconstruction: protocolPositions.usedRecentReconstruction,
        evidenceSummary: protocolPositions.evidenceSummary,
      },
      trustInputHydration: {
        source: "normalized_overview_response",
        totalAssets: hydratedAssetRows.length,
        hiddenAssetCount: hiddenAssetRows.length,
        visibleAssetCount: visibleAssetRows.length,
        knownProtocolMatchCount: hydratedAssetRows.filter((row) => row.trustInput.isKnownProtocolAsset).length,
      },
      exclusions: exclusionSummary,
    },
  });

  if (totalValueUsd !== null) {
    await insertOverviewPortfolioSnapshot({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      capturedAt: now,
      totalValueUsd: String(totalValueUsd),
      deployedValueUsd: deployedValueUsd !== null ? String(deployedValueUsd) : null,
      idleValueUsd: idleValueUsd !== null ? String(idleValueUsd) : null,
      metadataJson: {
        range: input.range,
        source: "recent_provider_data",
        classifierVersion: ASSET_TRUST_CLASSIFIER_VERSION,
        protocolPositions: {
          summary: protocolPositions.block.summary,
          coverageReasonCodes: protocolPositions.block.coverageReasonCodes,
          usedRecentReconstruction: protocolPositions.usedRecentReconstruction,
          evidenceSummary: protocolPositions.evidenceSummary,
        },
        hiddenSummary: response.assets.hiddenSummary,
        exclusions: exclusionSummary,
        trustInputs: hydratedAssetRows.map((row) => row.trustInput),
      },
    });
  }

  await upsertOverviewFreshness({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    lastAnalyzedAt: freshness?.lastAnalyzedAt ?? null,
    lastSuccessfulRunId: freshness?.lastSuccessfulRunId ?? null,
    metadataJson: {
      ...(freshness?.metadataJson ?? {}),
      lastOverviewRefreshedAt: now.toISOString(),
      lastOverviewRange: input.range,
    },
  });

  return response;
}