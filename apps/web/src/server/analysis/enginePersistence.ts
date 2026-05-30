import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  assetMovements,
  deposits,
  ledgerEvents,
  performanceSnapshots,
  poolMetricsSnapshots,
  pools,
  portfolioSnapshots,
  pricePoints,
  protocolContracts,
  rewardEvents,
  strategies,
  strategyExposures,
} from "@/server/db/schema";
import { insertProcessedTxs, listProcessedTxs } from "@/server/analysis/processed-tx.repository";
import {
  materializeStrategyReadModels as materializeStrategyReadModelsProjection,
  type MaterializeStrategyReadModelsInput,
} from "@/server/analysis/strategy-read-models";
import { insertRawProviderRecord } from "@/server/providers/raw-provider-records.repository";
import type { OverviewProtocolPosition } from "@/server/protocol-positions/protocolPositions.types";

type ManualPositionArtifacts = {
  positions: Array<{
    tokenId: string;
    poolAddress: string | null;
    token0Address: string;
    token1Address: string;
    tickSpacing: number;
    tickLower: number;
    tickUpper: number;
    liquidity: string;
    currentTick: number | null;
    valueUsd: number | null;
  }>;
} | null;

type MellowWrapperArtifacts = {
  wrappers: Array<{
    wrapperAddress: string;
    strategyLabel: string;
    externalDepositReference: string | null;
    externalDepositReferenceStatus: "resolved" | "unresolved";
    feeTierLabel: string | null;
    shareBalanceRaw: string;
    token0Address: string;
    token1Address: string;
    token0AmountRaw: string;
    token1AmountRaw: string;
    valueUsd: number | null;
    poolAddress?: string | null;
  }>;
} | null;

type RawProviderSnapshot = {
  provider: string;
  endpoint: string;
  requestJson: Record<string, unknown>;
  responseJson: Record<string, unknown>;
};

const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const BASE_AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const BASE_EURC_ADDRESS = "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42";

const KNOWN_BASE_TOKEN_ADDRESSES: Record<string, string> = {
  weth: BASE_WETH_ADDRESS,
  eth: BASE_WETH_ADDRESS,
  usdc: BASE_USDC_ADDRESS,
  cbbtc: BASE_CBBTC_ADDRESS,
  aero: BASE_AERO_ADDRESS,
  eurc: BASE_EURC_ADDRESS,
};

export type ManualDepositLifecycleRecord = {
  txHash: string;
  tokenId: string | null;
  action: "mint" | "increaseLiquidity" | "decreaseLiquidity" | "collect";
  occurredAt?: Date;
  positionManagerAddress?: string | null;
  poolAddress?: string | null;
  category?: string | null;
  methodLabel?: string | null;
  summary?: string | null;
};

export type PersistedManualDepositLifecycleRecord = {
  txHash: string;
  action: ManualDepositLifecycleRecord["action"];
  occurredAt: string | null;
  positionManagerAddress: string | null;
  poolAddress: string | null;
  category: string | null;
  methodLabel: string | null;
  summary: string | null;
};

export type SliceHistoryRecord = Record<string, unknown>;

type SliceWindow = {
  sliceStartUtc: Date;
  sliceEndUtc: Date;
};

export function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function resolveManualDepositMintTxHash(input: {
  tokenId: string;
  lifecycle?: ManualDepositLifecycleRecord[];
}) {
  for (const record of input.lifecycle ?? []) {
    if (record.action === "mint" && record.tokenId === input.tokenId) {
      return record.txHash.toLowerCase();
    }
  }

  return null;
}

export function serializeManualDepositLifecycle(input: {
  tokenId: string;
  lifecycle?: ManualDepositLifecycleRecord[];
}): PersistedManualDepositLifecycleRecord[] {
  return (input.lifecycle ?? [])
    .filter((record) => record.tokenId === input.tokenId)
    .map((record) => ({
      txHash: record.txHash.toLowerCase(),
      action: record.action,
      occurredAt: record.occurredAt instanceof Date ? record.occurredAt.toISOString() : null,
      positionManagerAddress: record.positionManagerAddress?.toLowerCase() ?? null,
      poolAddress: record.poolAddress?.toLowerCase() ?? null,
      category: record.category ?? null,
      methodLabel: record.methodLabel ?? null,
      summary: record.summary ?? null,
    }));
}

export function resolvePersistedManualDepositStatus(input: {
  hasManualPosition: boolean;
  hasStakedPosition: boolean;
  lifecycle?: ManualDepositLifecycleRecord[];
}) {
  const hasBurnLifecycle = (input.lifecycle ?? []).some((record) => {
    if (record.category === "burn") {
      return true;
    }

    return record.action === "decreaseLiquidity"
      && typeof record.summary === "string"
      && /burned\s+1\s+nft/i.test(record.summary);
  });

  if (hasBurnLifecycle) {
    return "closed" as const;
  }

  if (input.hasStakedPosition) {
    return "staked" as const;
  }

  if (input.hasManualPosition) {
    return "open" as const;
  }

  return "closed" as const;
}

function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function hasPositiveAmountRaw(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return false;
  }

  return BigInt(value) > BigInt(0);
}

export function isSuspiciousSpoofedTransferActivity(input: {
  walletAddress: string;
  category: string;
  methodLabel: string;
  fromAddress: string | null;
  toAddress: string | null;
  meaningfulOutflowCount: number;
  suspiciousOutflowCount: number;
  trustedOutflowCount: number;
}) {
  const isTransferLike =
    input.category === "token send" ||
    input.category === "send" ||
    input.methodLabel === "transfer";

  if (!isTransferLike) {
    return false;
  }

  if (input.fromAddress === input.walletAddress || input.toAddress === input.walletAddress) {
    return false;
  }

  if (input.meaningfulOutflowCount === 0) {
    return false;
  }

  if (input.trustedOutflowCount > 0) {
    return false;
  }

  return input.suspiciousOutflowCount === input.meaningfulOutflowCount;
}

function toNumericString(value: number | string | null | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const PRESERVED_RANGE_METADATA_KEYS = [
  "feeTierLabel",
  "rangeLowerTick",
  "rangeUpperTick",
  "currentTick",
  "isInRange",
  "rangeLowerPrice",
  "rangeUpperPrice",
  "rangeQuoteTokenSymbol",
  "rangeDisplayFractionDigits",
] as const;

export function mergePersistedPositionMetadataJson(input: {
  existing: unknown;
  next: Record<string, unknown>;
}) {
  const existingJson = asRecord(input.existing);
  const nextJson = asRecord(input.next);
  const existingMetadata = asRecord(existingJson.metadata);
  const nextMetadata = asRecord(nextJson.metadata);
  const mergedMetadata = {
    ...existingMetadata,
    ...nextMetadata,
  } as Record<string, unknown>;

  for (const key of PRESERVED_RANGE_METADATA_KEYS) {
    const nextValue = nextMetadata[key];
    if (nextValue === null || nextValue === undefined) {
      const existingValue = existingMetadata[key];
      if (existingValue !== null && existingValue !== undefined) {
        mergedMetadata[key] = existingValue;
      }
    }
  }

  return {
    ...existingJson,
    ...nextJson,
    metadata: mergedMetadata,
  } satisfies Record<string, unknown>;
}

function normalizeTokenAddress(value: string | null | undefined) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

function normalizeTokenSymbol(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

function hasAlphabeticCharacter(value: string | null | undefined) {
  return typeof value === "string" && /[A-Za-z]/.test(value);
}

function resolveKnownPoolTokenSymbol(input: {
  chainId: number;
  tokenAddress?: string | null;
}) {
  const normalizedAddress = normalizeTokenAddress(input.tokenAddress ?? null);
  if (!normalizedAddress || input.chainId !== 8453) {
    return null;
  }

  if (normalizedAddress === BASE_WETH_ADDRESS) return "WETH";
  if (normalizedAddress === BASE_CBBTC_ADDRESS) return "cbBTC";
  if (normalizedAddress === BASE_AERO_ADDRESS) return "AERO";
  if (normalizedAddress === BASE_USDC_ADDRESS) return "USDC";
  if (normalizedAddress === BASE_EURC_ADDRESS) return "EURC";

  return null;
}

function resolveKnownPoolTokenAddress(input: {
  chainId: number;
  tokenAddress?: string | null;
  symbol?: string | null;
}) {
  const normalizedAddress = normalizeTokenAddress(input.tokenAddress ?? null);
  if (normalizedAddress) {
    return normalizedAddress;
  }

  if (input.chainId !== 8453) {
    return null;
  }

  const normalizedSymbol = normalizeTokenSymbol(input.symbol ?? null);
  return normalizedSymbol ? (KNOWN_BASE_TOKEN_ADDRESSES[normalizedSymbol] ?? null) : null;
}

function isAddressLikeLabel(label: string) {
  // Matches a raw 0x… address, optionally followed by extra text (e.g. fee/density suffix).
  return /^0x[0-9a-f]{40}(\b|$)/i.test(label.trim());
}

function isPairOnlyLabelWithoutDensity(label: string) {
  // Matches "TOKEN0 / TOKEN1" without a trailing density/fee tier suffix.
  // Density is required so identical pairs at different fee tiers don't
  // collapse to the same label (e.g. USDC / cbBTC at densities 100 and 2000).
  return /^[A-Za-z0-9]+\s*\/\s*[A-Za-z0-9]+$/.test(label.trim());
}

function isGenericPoolLabel(label: string | null | undefined) {
  if (typeof label !== "string") {
    return false;
  }
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (/^Aerodrome CL position #\d+$/i.test(trimmed)) {
    return true;
  }
  if (isAddressLikeLabel(trimmed)) {
    return true;
  }
  if (/^Manual protocol position$/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Za-z]+ staked LP$/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Za-z]+ strategy exposure$/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Za-z]+ governance lock$/i.test(trimmed)) {
    return true;
  }
  if (isPairOnlyLabelWithoutDensity(trimmed)) {
    return true;
  }
  return false;
}

// Aerodrome pool taxonomy (https://aerodrome.finance/docs):
//   - Slipstream / Concentrated Liquidity (CL): pools created by CLFactory.
//     Labelled by tick spacing (the "density"): 1, 50, 100, 200, 2000…
//   - v1 Volatile (vAMM): x*y=k constant-product pool. PoolFactory.stable=false.
//   - v1 Stable  (sAMM): x³y + y³x = k stable curve. PoolFactory.stable=true.
//
// We mirror that taxonomy: every canonical label MUST carry a density-or-type
// suffix so identical token pairs across pool types/densities never collide.
function resolveAerodromePoolSuffix(input: {
  feeTierLabel?: string | null;
  poolType?: string | null;
}) {
  const fee = typeof input.feeTierLabel === "string" ? input.feeTierLabel.trim() : "";
  if (fee) {
    return fee;
  }
  const type = typeof input.poolType === "string" ? input.poolType.trim().toLowerCase() : "";
  if (type === "stable") {
    return "Stable";
  }
  if (type === "volatile") {
    return "Volatile";
  }
  return null;
}

function buildCanonicalPoolLabel(input: {
  primarySymbol?: string | null;
  secondarySymbol?: string | null;
  feeTierLabel?: string | null;
  poolType?: string | null;
  fallback?: string | null;
}) {
  const primary = typeof input.primarySymbol === "string" ? input.primarySymbol.trim() : "";
  const secondary = typeof input.secondarySymbol === "string" ? input.secondarySymbol.trim() : "";
  const suffix = resolveAerodromePoolSuffix(input);
  if (primary && secondary && suffix) {
    return `${primary} / ${secondary} ${suffix}`;
  }
  // Pair-only labels are forbidden: two pools at different densities (or one
  // CL + one v1) would collapse into the same display label. Drop to the
  // caller's fallback so we never emit "TOKEN0 / TOKEN1" without a suffix.
  if (input.fallback && !isAddressLikeLabel(input.fallback) && !isPairOnlyLabelWithoutDensity(input.fallback)) {
    return input.fallback;
  }
  return null;
}

function preferPoolLabel(existingLabel: string | null | undefined, incomingLabel: string | null | undefined) {
  if (incomingLabel && !isGenericPoolLabel(incomingLabel)) {
    return incomingLabel;
  }

  if (existingLabel && !isGenericPoolLabel(existingLabel)) {
    return existingLabel;
  }

  return existingLabel ?? incomingLabel ?? null;
}

function extractCanonicalPoolSymbols(label: string | null | undefined) {
  if (typeof label !== "string") {
    return {
      primaryTokenSymbol: null,
      secondaryTokenSymbol: null,
    };
  }

  const match = label.trim().match(/^([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)\s+.+$/);
  return {
    primaryTokenSymbol: match?.[1] ?? null,
    secondaryTokenSymbol: match?.[2] ?? null,
  };
}

export function resolveManualDepositDisplayMetadata(input: {
  chainId: number;
  family?: OverviewProtocolPosition["family"] | null;
  canonicalPoolLabel?: string | null;
  token0Address?: string | null;
  token1Address?: string | null;
  fallbackLabel?: string | null;
  fallbackPoolLabel?: string | null;
  fallbackPrimaryTokenSymbol?: string | null;
  fallbackSecondaryTokenSymbol?: string | null;
}) {
  const canonicalPoolLabel = preferPoolLabel(input.canonicalPoolLabel, input.fallbackPoolLabel)
    ?? input.canonicalPoolLabel
    ?? input.fallbackPoolLabel
    ?? null;
  const canonicalPoolSymbols = extractCanonicalPoolSymbols(canonicalPoolLabel);
  const primaryTokenSymbol = canonicalPoolSymbols.primaryTokenSymbol
    ?? resolveKnownPoolTokenSymbol({ chainId: input.chainId, tokenAddress: input.token0Address })
    ?? (hasAlphabeticCharacter(input.fallbackPrimaryTokenSymbol) ? input.fallbackPrimaryTokenSymbol ?? null : null);
  const secondaryTokenSymbol = canonicalPoolSymbols.secondaryTokenSymbol
    ?? resolveKnownPoolTokenSymbol({ chainId: input.chainId, tokenAddress: input.token1Address })
    ?? (hasAlphabeticCharacter(input.fallbackSecondaryTokenSymbol) ? input.fallbackSecondaryTokenSymbol ?? null : null);
  const canonicalPairLabel = primaryTokenSymbol && secondaryTokenSymbol
    ? `${primaryTokenSymbol} / ${secondaryTokenSymbol}`
    : null;
  const fallbackLabelMatchesCanonicalPair = canonicalPairLabel && typeof input.fallbackLabel === "string"
    ? input.fallbackLabel.toLowerCase().includes(canonicalPairLabel.toLowerCase())
    : false;
  const label = fallbackLabelMatchesCanonicalPair
    ? input.fallbackLabel ?? null
    : canonicalPairLabel
      ? input.family === "staked_lp"
        ? `${canonicalPairLabel} staked LP`
        : input.family === "manual_deposit"
          ? `${canonicalPairLabel} manual position`
          : (input.fallbackLabel ?? canonicalPairLabel)
      : (input.fallbackLabel ?? null);

  return {
    label,
    poolLabel: canonicalPoolLabel,
    primaryTokenSymbol,
    secondaryTokenSymbol,
  };
}

function mergePoolMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  incomingMetadata: Record<string, unknown> | null | undefined,
) {
  const merged: Record<string, unknown> = { ...(existingMetadata ?? {}) };

  for (const [key, value] of Object.entries(incomingMetadata ?? {})) {
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

function parseHistoryTimestamp(record: SliceHistoryRecord) {
  const raw = asString(record.block_timestamp) ?? asString(record.block_time);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractHistoryHash(record: SliceHistoryRecord) {
  return (asString(record.transaction_hash) ?? asString(record.hash))?.toLowerCase() ?? null;
}

function extractHistoryTransferAmountRaw(record: Record<string, unknown>) {
  return (
    asString(record.value) ??
    asString(record.amount) ??
    toNumericString(asNumber(record.amount_raw)) ??
    toNumericString(asNumber(record.value_decimal))
  );
}

function extractHistoryTransferTokenAddress(record: Record<string, unknown>) {
  return (
    asString(record.token_address) ??
    asString(record.contract_address) ??
    asString(record.address) ??
    (record.native_transfer === true ? "0x0000000000000000000000000000000000000000" : null)
  )?.toLowerCase() ?? null;
}

function extractHistoryTransferAmountUsd(record: Record<string, unknown>) {
  return asNumber(record.value_usd) ?? asNumber(record.usd_value) ?? asNumber(record.amount_usd);
}

function buildAssetMovementRows(input: {
  walletAddress: string;
  chainId: number;
  ledgerEventId: string;
  historyRecord: SliceHistoryRecord;
}) {
  const walletAddress = input.walletAddress.toLowerCase();
  const transfers = [
    ...asRecordArray(input.historyRecord.erc20_transfers).map((record) => ({ record, source: "erc20" as const })),
    ...asRecordArray(input.historyRecord.native_transfers).map((record) => ({ record, source: "native" as const })),
  ];

  return transfers.flatMap(({ record, source }, index) => {
    const tokenAddress = extractHistoryTransferTokenAddress(record);
    const amountRaw = extractHistoryTransferAmountRaw(record);
    const toAddress = asString(record.to_address)?.toLowerCase() ?? null;
    const fromAddress = asString(record.from_address)?.toLowerCase() ?? null;

    if (!tokenAddress || !amountRaw || (toAddress !== walletAddress && fromAddress !== walletAddress)) {
      return [];
    }

    return [{
      chainId: input.chainId,
      ledgerEventId: input.ledgerEventId,
      movementIndex: index,
      walletAddress,
      tokenAddress,
      directionIn: toAddress === walletAddress,
      amountRaw,
      amountUsd: extractHistoryTransferAmountUsd(record)?.toString() ?? null,
      metadataJson: {
        source,
        logIndex: asNumber(record.log_index) ?? asNumber(record.logIndex) ?? index,
        symbol: asString(record.token_symbol) ?? asString(record.symbol),
        name: asString(record.token_name) ?? asString(record.name),
        fromAddress,
        toAddress,
        possibleSpam: record.possible_spam === true || record.verified_contract === false,
        verifiedContract: record.verified_contract === true,
      },
    }];
  });
}

function isWithinSlice(date: Date | null, window: SliceWindow) {
  if (!date) {
    return false;
  }

  return date >= window.sliceStartUtc && date < window.sliceEndUtc;
}

function isRewardLikeRecord(record: SliceHistoryRecord) {
  const fields = [
    asString(record.category),
    asString(record.method_label),
    asString(record.summary),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return fields.includes("reward") || fields.includes("claim") || fields.includes("collect");
}

function isAerodromeVotingEscrowInteraction(input: {
  category?: string | null;
  methodLabel?: string | null;
  summary?: string | null;
  protocol?: string | null;
  contractType?: string | null;
}) {
  const text = [input.category, input.methodLabel, input.summary, input.protocol, input.contractType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const touchesVotingEscrow =
    text.includes("voting escrow") ||
    text.includes("veaero") ||
    (input.protocol === "aerodrome" && (text.includes("escrow") || text.includes("governance")));

  if (!touchesVotingEscrow) {
    return false;
  }

  return text.includes("claim")
    || text.includes("collect")
    || text.includes("lock")
    || text.includes("relock")
    || text.includes("delegate")
    || text.includes("vote");
}

async function upsertPool(input: {
  chainId: number;
  poolAddress: string;
  label: string;
  token0Address?: string | null;
  token1Address?: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  const db = getDb();
  const normalizedPoolAddress = input.poolAddress.toLowerCase();
  const existing = await db.query.pools.findFirst({
    where: and(eq(pools.chainId, input.chainId), eq(pools.poolAddress, normalizedPoolAddress)),
  });
  const mergedLabel = preferPoolLabel(existing?.label, input.label) ?? input.label;
  const mergedToken0Address = normalizeTokenAddress(input.token0Address ?? null) ?? existing?.token0Address ?? null;
  const mergedToken1Address = normalizeTokenAddress(input.token1Address ?? null) ?? existing?.token1Address ?? null;
  const mergedMetadataJson = mergePoolMetadata(existing?.metadataJson, input.metadataJson ?? {});
  const [row] = await db
    .insert(pools)
    .values({
      chainId: input.chainId,
      poolAddress: normalizedPoolAddress,
      label: mergedLabel,
      token0Address: mergedToken0Address,
      token1Address: mergedToken1Address,
      metadataJson: mergedMetadataJson,
    })
    .onConflictDoUpdate({
      target: [pools.chainId, pools.poolAddress],
      set: {
        label: mergedLabel,
        token0Address: mergedToken0Address,
        token1Address: mergedToken1Address,
        metadataJson: mergedMetadataJson,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function persistRawProviderSnapshots(input: {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
  records: RawProviderSnapshot[];
}) {
  if (input.records.length === 0) {
    return [];
  }

  return Promise.all(input.records.map((record) =>
    insertRawProviderRecord({
      runId: input.runId,
      sliceId: input.sliceId,
      provider: record.provider,
      endpoint: record.endpoint,
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      requestJson: record.requestJson,
      responseJson: record.responseJson,
      confidence: "medium",
    }),
  ));
}

export async function persistProtocolPositions(input: {
  walletAddress: string;
  chainId: number;
  positions: OverviewProtocolPosition[];
  manualArtifacts?: ManualPositionArtifacts;
  manualLifecycle?: ManualDepositLifecycleRecord[];
  mellowArtifacts?: MellowWrapperArtifacts;
}) {
  const db = getDb();
  const normalizedWalletAddress = input.walletAddress.toLowerCase();
  const manualByTokenId = new Map((input.manualArtifacts?.positions ?? []).map((item) => [item.tokenId, item] as const));
  const mellowByWrapper = new Map(
    (input.mellowArtifacts?.wrappers ?? []).map((item) => [item.wrapperAddress.toLowerCase(), item] as const),
  );
  const manualLifecycleByTokenId = new Map<string, ManualDepositLifecycleRecord[]>();
  for (const record of input.manualLifecycle ?? []) {
    if (!record.tokenId) {
      continue;
    }

    const bucket = manualLifecycleByTokenId.get(record.tokenId) ?? [];
    bucket.push(record);
    manualLifecycleByTokenId.set(record.tokenId, bucket);
  }
  for (const bucket of manualLifecycleByTokenId.values()) {
    bucket.sort((left, right) => {
      const leftTime = left.occurredAt?.getTime() ?? 0;
      const rightTime = right.occurredAt?.getTime() ?? 0;
      return leftTime - rightTime;
    });
  }

  const manualPositionByTokenId = new Map<string, {
    primaryPosition: OverviewProtocolPosition;
    hasManualPosition: boolean;
    hasStakedPosition: boolean;
  }>();
  for (const position of input.positions) {
    if ((position.family !== "manual_deposit" && position.family !== "staked_lp") || !position.tokenId) {
      continue;
    }

    const existing = manualPositionByTokenId.get(position.tokenId) ?? null;
    const currentPrimary = existing?.primaryPosition ?? null;
    const shouldReplacePrimary = !currentPrimary
      || (currentPrimary.valueUsd === null && position.valueUsd !== null)
      || (currentPrimary.family === "staked_lp" && position.family === "manual_deposit");

    manualPositionByTokenId.set(position.tokenId, {
      primaryPosition: shouldReplacePrimary ? position : (currentPrimary ?? position),
      hasManualPosition: (existing?.hasManualPosition ?? false) || position.family === "manual_deposit",
      hasStakedPosition: (existing?.hasStakedPosition ?? false) || position.family === "staked_lp",
    });
  }
  const poolTotals = new Map<string, { poolId: string; valueUsd: number }>();
  const depositIds: string[] = [];
  const strategyIds: string[] = [];

  const manualTokenIds = Array.from(new Set([
    ...manualPositionByTokenId.keys(),
    ...manualByTokenId.keys(),
    ...manualLifecycleByTokenId.keys(),
  ]));
  const strategyWrapperAddresses = Array.from(new Set(
    input.positions
      .filter((position) => position.family === "strategy_exposure" && typeof position.metadata.wrapperAddress === "string")
      .map((position) => position.metadata.wrapperAddress as string)
      .map((wrapperAddress) => wrapperAddress.toLowerCase()),
  ));

  const [existingManualDeposits, existingStrategies, existingStrategyExposureRows] = await Promise.all([
    manualTokenIds.length > 0
      ? db
        .select({ tokenId: deposits.tokenId, metadataJson: deposits.metadataJson })
        .from(deposits)
        .where(and(
          eq(deposits.chainId, input.chainId),
          eq(deposits.walletAddress, normalizedWalletAddress),
          inArray(deposits.tokenId, manualTokenIds),
        ))
      : Promise.resolve([]),
    strategyWrapperAddresses.length > 0
      ? db
        .select({ wrapperAddress: strategies.wrapperAddress, metadataJson: strategies.metadataJson })
        .from(strategies)
        .where(and(
          eq(strategies.chainId, input.chainId),
          inArray(strategies.wrapperAddress, strategyWrapperAddresses),
        ))
      : Promise.resolve([]),
    strategyWrapperAddresses.length > 0
      ? db
        .select({ wrapperAddress: strategyExposures.wrapperAddress, metadataJson: strategyExposures.metadataJson })
        .from(strategyExposures)
        .where(and(
          eq(strategyExposures.chainId, input.chainId),
          eq(strategyExposures.walletAddress, normalizedWalletAddress),
          inArray(strategyExposures.wrapperAddress, strategyWrapperAddresses),
        ))
      : Promise.resolve([]),
  ]);

  const existingManualMetadataByTokenId = new Map(
    existingManualDeposits
      .filter((row) => typeof row.tokenId === "string" && row.tokenId.length > 0)
      .map((row) => [row.tokenId as string, asRecord(row.metadataJson)] as const),
  );
  const existingStrategyMetadataByWrapperAddress = new Map(
    existingStrategies
      .filter((row) => typeof row.wrapperAddress === "string" && row.wrapperAddress.length > 0)
      .map((row) => [row.wrapperAddress as string, asRecord(row.metadataJson)] as const),
  );
  const existingStrategyExposureMetadataByWrapperAddress = new Map(
    existingStrategyExposureRows
      .filter((row) => typeof row.wrapperAddress === "string" && row.wrapperAddress.length > 0)
      .map((row) => [row.wrapperAddress as string, asRecord(row.metadataJson)] as const),
  );

  for (const tokenId of manualTokenIds) {
    const positionState = manualPositionByTokenId.get(tokenId) ?? null;
    const position = positionState?.primaryPosition ?? null;
    const manual = manualByTokenId.get(tokenId) ?? null;
    const lifecycle = manualLifecycleByTokenId.get(tokenId) ?? [];
    const mintTxHash = resolveManualDepositMintTxHash({ tokenId, lifecycle });
    const firstLifecycleRecord = lifecycle.find((record) => record.occurredAt instanceof Date) ?? lifecycle[0] ?? null;
    const lastLifecycleRecord = lifecycle.at(-1) ?? null;
    const positionManagerAddress = (
      lifecycle.find((record) => typeof record.positionManagerAddress === "string" && record.positionManagerAddress.length > 0)?.positionManagerAddress
      ?? (position?.family === "manual_deposit" ? position.metadata.positionContractAddress : null)
      ?? null
    )?.toLowerCase() ?? null;
    const poolAddress = (
      manual?.poolAddress
      ?? lifecycle.find((record) => typeof record.poolAddress === "string" && record.poolAddress.length > 0)?.poolAddress
      ?? null
    )?.toLowerCase() ?? null;
    let poolId: string | null = null;
    let canonicalPoolLabel: string | null = null;
    let canonicalToken0Address: string | null = null;
    let canonicalToken1Address: string | null = null;

    if (poolAddress) {
      const token0Address = resolveKnownPoolTokenAddress({
        chainId: input.chainId,
        tokenAddress: manual?.token0Address ?? null,
        symbol: position?.primaryTokenSymbol ?? null,
      });
      const token1Address = resolveKnownPoolTokenAddress({
        chainId: input.chainId,
        tokenAddress: manual?.token1Address ?? null,
        symbol: position?.secondaryTokenSymbol ?? null,
      });
      const pool = await upsertPool({
        chainId: input.chainId,
        poolAddress,
        label:
          buildCanonicalPoolLabel({
            primarySymbol: position?.primaryTokenSymbol ?? null,
            secondarySymbol: position?.secondaryTokenSymbol ?? null,
            feeTierLabel: position?.metadata.feeTierLabel ?? null,
            poolType: "cl",
            fallback: position?.poolLabel ?? position?.label ?? null,
          }) ?? `Aerodrome CL position #${tokenId}`,
        token0Address,
        token1Address,
        metadataJson: {
          protocol: "aerodrome",
          feeTierLabel: position?.metadata.feeTierLabel ?? null,
          poolType: "cl",
          source: manual ? "manual_current_state" : "manual_lifecycle",
        },
      });
      poolId = pool.id;
      canonicalPoolLabel = pool.label;
      canonicalToken0Address = pool.token0Address;
      canonicalToken1Address = pool.token1Address;

      if (position?.valueUsd !== null && position?.valueUsd !== undefined) {
        const currentTotal = poolTotals.get(pool.id)?.valueUsd ?? 0;
        poolTotals.set(pool.id, {
          poolId: pool.id,
          valueUsd: currentTotal + position.valueUsd,
        });
      }
    }

    const displayMetadata = resolveManualDepositDisplayMetadata({
      chainId: input.chainId,
      family: position?.family ?? null,
      canonicalPoolLabel,
      token0Address: canonicalToken0Address,
      token1Address: canonicalToken1Address,
      fallbackLabel: position?.label ?? null,
      fallbackPoolLabel: position?.poolLabel ?? null,
      fallbackPrimaryTokenSymbol: position?.primaryTokenSymbol ?? null,
      fallbackSecondaryTokenSymbol: position?.secondaryTokenSymbol ?? null,
    });

    if (!positionManagerAddress && !poolId) {
      continue;
    }

    const status = resolvePersistedManualDepositStatus({
      hasManualPosition: positionState?.hasManualPosition ?? false,
      hasStakedPosition: positionState?.hasStakedPosition ?? false,
      lifecycle,
    });
    const metadataJson = mergePersistedPositionMetadataJson({
      existing: existingManualMetadataByTokenId.get(tokenId) ?? null,
      next: {
      label: displayMetadata.label ?? position?.label ?? `Aerodrome CL position #${tokenId}`,
      protocol: "aerodrome",
      poolLabel: displayMetadata.poolLabel,
      valueUsd: position?.valueUsd ?? manual?.valueUsd ?? null,
      valueUpdatedAt: position?.valueUpdatedAt ?? null,
      primaryTokenSymbol: displayMetadata.primaryTokenSymbol,
      secondaryTokenSymbol: displayMetadata.secondaryTokenSymbol,
      primaryTokenAmount: position?.primaryTokenAmount,
      secondaryTokenAmount: position?.secondaryTokenAmount,
      metadata: {
        ...(position?.metadata ?? {}),
        positionContractAddress: positionManagerAddress,
      },
      lifecycle: serializeManualDepositLifecycle({ tokenId, lifecycle }),
      historicalPersistenceSource: lifecycle.length > 0 ? "manual_lifecycle" : "current_position",
      },
    });

    const [deposit] = await db
      .insert(deposits)
      .values({
        chainId: input.chainId,
        walletAddress: normalizedWalletAddress,
        poolId,
        positionManagerAddress,
        tokenId,
        mintTxHash,
        status,
        coverageStatus: position?.coverageStatus ?? (poolId ? "partial" : "unknown"),
        metadataJson,
        createdAt: firstLifecycleRecord?.occurredAt ?? new Date(),
        updatedAt: lastLifecycleRecord?.occurredAt ?? parseOptionalDate(position?.valueUpdatedAt) ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [deposits.chainId, deposits.positionManagerAddress, deposits.tokenId],
        targetWhere: sql`${deposits.tokenId} is not null and ${deposits.positionManagerAddress} is not null`,
        set: {
          poolId,
          mintTxHash: sql`coalesce(${mintTxHash}, ${deposits.mintTxHash})`,
          status,
          coverageStatus: position?.coverageStatus ?? (poolId ? "partial" : "unknown"),
          metadataJson,
          updatedAt: lastLifecycleRecord?.occurredAt ?? parseOptionalDate(position?.valueUpdatedAt) ?? new Date(),
        },
      })
      .returning();

    existingManualMetadataByTokenId.set(tokenId, metadataJson);
    depositIds.push(deposit.id);
  }

  for (const position of input.positions) {
    if (position.family === "manual_deposit" || position.family === "staked_lp") {
      continue;
    }

    if (position.family === "strategy_exposure" && position.metadata.wrapperAddress) {
      const wrapperAddress = position.metadata.wrapperAddress.toLowerCase();
      const wrapper = mellowByWrapper.get(wrapperAddress);
      const strategyPoolAddress =
        typeof position.metadata.poolAddress === "string" && position.metadata.poolAddress.length > 0
          ? position.metadata.poolAddress.toLowerCase()
          : wrapper?.poolAddress?.toLowerCase() ?? null;
      let primaryPoolId: string | null = null;

      if (strategyPoolAddress) {
        const pool = await upsertPool({
          chainId: input.chainId,
          poolAddress: strategyPoolAddress,
          label:
            buildCanonicalPoolLabel({
              primarySymbol: position.primaryTokenSymbol,
              secondarySymbol: position.secondaryTokenSymbol,
              feeTierLabel: position.metadata.feeTierLabel ?? null,
              poolType: "cl",
              fallback: position.poolLabel ?? position.strategyLabel ?? position.label,
            }) ?? position.strategyLabel ?? position.label,
          token0Address: wrapper?.token0Address,
          token1Address: wrapper?.token1Address,
          metadataJson: {
            protocol: position.protocol,
            feeTierLabel: position.metadata.feeTierLabel,
            poolType: "cl",
            source: "mellow_wrapper_pool",
          },
        });
        primaryPoolId = pool.id;

        const currentTotal = poolTotals.get(pool.id)?.valueUsd ?? 0;
        poolTotals.set(pool.id, {
          poolId: pool.id,
          valueUsd: currentTotal + (position.valueUsd ?? 0),
        });
      }

      const strategyMetadataJson = mergePersistedPositionMetadataJson({
        existing: existingStrategyMetadataByWrapperAddress.get(wrapperAddress) ?? null,
        next: {
          label: position.label,
          poolLabel: position.poolLabel,
          valueUsd: position.valueUsd,
          valueUpdatedAt: position.valueUpdatedAt,
          metadata: position.metadata,
        },
      });

      const [strategy] = await db
        .insert(strategies)
        .values({
          chainId: input.chainId,
          label: position.strategyLabel ?? position.label,
          protocol: position.protocol,
          wrapperAddress,
          primaryPoolId,
          coverageStatus: position.coverageStatus,
          metadataJson: strategyMetadataJson,
        })
        .onConflictDoUpdate({
          target: [strategies.chainId, strategies.wrapperAddress],
          targetWhere: sql`${strategies.wrapperAddress} is not null`,
          set: {
            label: position.strategyLabel ?? position.label,
            primaryPoolId,
            coverageStatus: position.coverageStatus,
            metadataJson: strategyMetadataJson,
            updatedAt: new Date(),
          },
        })
        .returning();

      existingStrategyMetadataByWrapperAddress.set(wrapperAddress, strategyMetadataJson);
      strategyIds.push(strategy.id);

      const strategyExposureMetadataJson = mergePersistedPositionMetadataJson({
        existing: existingStrategyExposureMetadataByWrapperAddress.get(wrapperAddress) ?? null,
        next: {
          label: position.label,
          strategyLabel: position.strategyLabel,
          poolLabel: position.poolLabel,
          valueUsd: position.valueUsd,
          valueUpdatedAt: position.valueUpdatedAt,
          token0Address: wrapper?.token0Address?.toLowerCase() ?? null,
          token1Address: wrapper?.token1Address?.toLowerCase() ?? null,
          externalDepositReference: wrapper?.externalDepositReference ?? null,
          externalDepositReferenceStatus: wrapper?.externalDepositReferenceStatus ?? "unresolved",
          metadata: position.metadata,
        },
      });

      await db
        .insert(strategyExposures)
        .values({
          chainId: input.chainId,
          strategyId: strategy.id,
          walletAddress: normalizedWalletAddress,
          wrapperAddress,
          sharesRaw: toNumericString(wrapper?.shareBalanceRaw) ?? "0",
          underlying0AmountRaw: toNumericString(wrapper?.token0AmountRaw),
          underlying1AmountRaw: toNumericString(wrapper?.token1AmountRaw),
          coverageStatus: position.coverageStatus,
          metadataJson: strategyExposureMetadataJson,
        })
        .onConflictDoUpdate({
          target: [
            strategyExposures.chainId,
            strategyExposures.strategyId,
            strategyExposures.walletAddress,
            strategyExposures.wrapperAddress,
          ],
          set: {
            sharesRaw: toNumericString(wrapper?.shareBalanceRaw) ?? "0",
            underlying0AmountRaw: toNumericString(wrapper?.token0AmountRaw),
            underlying1AmountRaw: toNumericString(wrapper?.token1AmountRaw),
            coverageStatus: position.coverageStatus,
            metadataJson: strategyExposureMetadataJson,
            updatedAt: new Date(),
          },
        });

      existingStrategyExposureMetadataByWrapperAddress.set(wrapperAddress, strategyExposureMetadataJson);
    }
  }

  return {
    depositIds,
    strategyIds,
    poolTotals: Array.from(poolTotals.values()),
  };
}

export async function persistSliceHistory(input: {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
  sliceStartUtc: Date;
  sliceEndUtc: Date;
  history: SliceHistoryRecord[];
  forceReprocessTxHashes?: string[];
}) {
  const recordsInWindow = input.history.filter((record) =>
    isWithinSlice(parseHistoryTimestamp(record), {
      sliceStartUtc: input.sliceStartUtc,
      sliceEndUtc: input.sliceEndUtc,
    }) && Boolean(extractHistoryHash(record)),
  );

  const txHashes = recordsInWindow
    .map((record) => extractHistoryHash(record))
    .filter((value): value is string => Boolean(value));
  const forceReprocessTxHashes = new Set((input.forceReprocessTxHashes ?? []).map((txHash) => txHash.toLowerCase()));
  const seen = new Set((await listProcessedTxs({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    txHashes,
  }))
    .map((row) => row.txHash.toLowerCase())
    .filter((txHash) => !forceReprocessTxHashes.has(txHash)));

  const unseen = recordsInWindow.filter((record) => {
    const txHash = extractHistoryHash(record);
    return txHash ? !seen.has(txHash) : false;
  });

  const dedupedUnseen = Array.from(
    new Map(
      unseen.map((record) => [extractHistoryHash(record) as string, record] as const),
    ).values(),
  );

  const db = getDb();
  let assetMovementCount = 0;
  const inboundMovementByTxHash = new Map<string, boolean>();
  if (dedupedUnseen.length > 0) {
    const insertedLedgerEvents = await db
      .insert(ledgerEvents)
      .values(
        dedupedUnseen.map((record) => ({
          chainId: input.chainId,
          txHash: extractHistoryHash(record) as string,
          logIndex: 0,
          eventType: "wallet_activity",
          walletAddress: input.walletAddress.toLowerCase(),
          occurredAt: parseHistoryTimestamp(record) ?? input.sliceEndUtc,
          confidence: "medium",
          metadataJson: {
            runId: input.runId,
            sliceId: input.sliceId,
            category: asString(record.category),
            methodLabel: asString(record.method_label),
            summary: asString(record.summary),
            fromAddress: asString(record.from_address)?.toLowerCase() ?? null,
            toAddress: asString(record.to_address)?.toLowerCase() ?? null,
            blockNumber: asString(record.block_number) ?? asString(record.blockNumber),
            blockTimestamp:
              asString(record.block_timestamp) ?? asString(record.block_time),
          },
        })),
      )
      .onConflictDoNothing()
      .returning({
        id: ledgerEvents.id,
        txHash: ledgerEvents.txHash,
      });

    const ledgerEventIdByHash = new Map(insertedLedgerEvents.map((row) => [row.txHash.toLowerCase(), row.id] as const));
    const assetMovementRows = dedupedUnseen.flatMap((record) => {
      const txHash = extractHistoryHash(record);
      const ledgerEventId = txHash ? ledgerEventIdByHash.get(txHash) : null;
      if (!ledgerEventId) {
        return [];
      }

      const movementRows = buildAssetMovementRows({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        ledgerEventId,
        historyRecord: record,
      });

      if (txHash && movementRows.some((row) => row.directionIn)) {
        inboundMovementByTxHash.set(txHash, true);
      }

      return movementRows;
    });

    if (assetMovementRows.length > 0) {
      await db.insert(assetMovements).values(assetMovementRows).onConflictDoNothing();
      assetMovementCount = assetMovementRows.length;
    }

    await insertProcessedTxs(
      dedupedUnseen.map((record) => ({
        chainId: input.chainId,
        txHash: extractHistoryHash(record) as string,
        walletAddress: input.walletAddress,
        blockNumber: asString(record.block_number) ?? "0",
        firstRunId: input.runId,
        firstSliceId: input.sliceId,
      })),
    );
  }

  return {
    txCountSeen: recordsInWindow.length,
    txCountProcessed: dedupedUnseen.length,
    assetMovementCount,
    rewardCandidates: dedupedUnseen
      .filter((record) => {
        const txHash = extractHistoryHash(record);
        return Boolean(txHash && inboundMovementByTxHash.get(txHash) && isRewardLikeRecord(record));
      })
      .map((record) => ({
        txHash: extractHistoryHash(record) as string,
        occurredAt: parseHistoryTimestamp(record) ?? input.sliceEndUtc,
        category: asString(record.category),
        summary: asString(record.summary),
      })),
  };
}

export async function classifyRunLedgerEvents(input: {
  walletAddress: string;
  chainId: number;
  txHashes: string[];
  runId: string;
  spamTokenAddresses?: string[];
  walletTokenSignals?: Array<{
    tokenAddress: string;
    possibleSpam?: boolean;
    verifiedContract?: boolean;
    usdPrice?: number | null;
    usdValue?: number | null;
  }>;
}) {
  if (input.txHashes.length === 0) {
    return 0;
  }

  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const txHashesLower = input.txHashes.map((txHash) => txHash.toLowerCase());
  const [rows, protocolContractRows, movementRows] = await Promise.all([
    db
      .select({
        id: ledgerEvents.id,
        txHash: ledgerEvents.txHash,
        confidence: ledgerEvents.confidence,
        metadataJson: ledgerEvents.metadataJson,
      })
      .from(ledgerEvents)
      .where(
        and(
          eq(ledgerEvents.walletAddress, walletAddress),
          eq(ledgerEvents.chainId, input.chainId),
          inArray(ledgerEvents.txHash, txHashesLower),
        ),
      ),
    db
      .select({
        address: protocolContracts.address,
        protocol: protocolContracts.protocol,
        contractType: protocolContracts.contractType,
      })
      .from(protocolContracts)
      .where(eq(protocolContracts.chainId, input.chainId)),
    db
      .select({
        ledgerEventId: assetMovements.ledgerEventId,
        tokenAddress: assetMovements.tokenAddress,
        directionIn: assetMovements.directionIn,
        amountRaw: assetMovements.amountRaw,
        amountUsd: assetMovements.amountUsd,
        metadataJson: assetMovements.metadataJson,
      })
      .from(assetMovements)
      .innerJoin(ledgerEvents, eq(assetMovements.ledgerEventId, ledgerEvents.id))
      .where(
        and(
          eq(assetMovements.walletAddress, walletAddress),
          eq(assetMovements.chainId, input.chainId),
          inArray(ledgerEvents.txHash, txHashesLower),
        ),
      ),
  ]);

  const protocolMap = new Map<string, { protocol: string; contractType: string }>();
  for (const row of protocolContractRows) {
    protocolMap.set(row.address.toLowerCase(), { protocol: row.protocol, contractType: row.contractType });
  }

  const spamSet = new Set((input.spamTokenAddresses ?? []).map((address) => address.toLowerCase()));
  const walletTokenSignalMap = new Map(
    (input.walletTokenSignals ?? [])
      .map((signal) => ({
        ...signal,
        tokenAddress: signal.tokenAddress.toLowerCase(),
      }))
      .filter((signal) => signal.tokenAddress.length > 0)
      .map((signal) => [signal.tokenAddress, signal] as const),
  );

  const movementsByEventId = new Map<string, typeof movementRows>();
  const movementTokenAddresses = new Set<string>();
  for (const movement of movementRows) {
    if (!movement.ledgerEventId) continue;
    const list = movementsByEventId.get(movement.ledgerEventId) ?? [];
    list.push(movement);
    movementsByEventId.set(movement.ledgerEventId, list);
    movementTokenAddresses.add(movement.tokenAddress.toLowerCase());
  }

  const pricedTokenRows = movementTokenAddresses.size === 0
    ? []
    : await db
      .select({
        tokenAddress: pricePoints.tokenAddress,
        priceUsd: pricePoints.priceUsd,
      })
      .from(pricePoints)
      .where(
        and(
          eq(pricePoints.chainId, input.chainId),
          inArray(pricePoints.tokenAddress, Array.from(movementTokenAddresses)),
        ),
      );
  const pricedTokenSet = new Set(
    pricedTokenRows
      .filter((row) => {
        const price = asNumber(row.priceUsd);
        return price !== null && price > 0;
      })
      .map((row) => row.tokenAddress.toLowerCase()),
  );

  let updated = 0;
  for (const row of rows) {
    const category = asString(row.metadataJson.category)?.toLowerCase() ?? "";
    const methodLabel = asString(row.metadataJson.methodLabel)?.toLowerCase() ?? "";
    const summary = asString(row.metadataJson.summary)?.toLowerCase() ?? "";
    const fromAddress = asString(row.metadataJson.fromAddress)?.toLowerCase() ?? null;
    const toAddress = asString(row.metadataJson.toAddress)?.toLowerCase() ?? null;
    const counterpartyAddress = fromAddress === walletAddress
      ? toAddress
      : toAddress === walletAddress
        ? fromAddress
        : null;
    const counterpartyInfo = counterpartyAddress ? protocolMap.get(counterpartyAddress) ?? null : null;
    const counterpartyContractType = counterpartyInfo?.contractType.toLowerCase() ?? "";

    const movements = movementsByEventId.get(row.id) ?? [];
    let netUsdIn = 0;
    let netUsdOut = 0;
    let hasSpamInflow = false;
    let hasUntrustedInflow = false;
    let hasValuelessInflow = false;
    let meaningfulOutflowCount = 0;
    let suspiciousOutflowCount = 0;
    let trustedOutflowCount = 0;
    let hasInflow = false;
    let hasOutflow = false;
    for (const movement of movements) {
      const usd = movement.amountUsd ? Number(movement.amountUsd) : 0;
      const tokenAddr = movement.tokenAddress.toLowerCase();
      const movementMeta = (movement.metadataJson ?? {}) as Record<string, unknown>;
      const tokenSignal = walletTokenSignalMap.get(tokenAddr) ?? null;
      const movementPossibleSpam = movementMeta.possibleSpam === true;
      const tokenPossibleSpam = tokenSignal?.possibleSpam === true;
      const movementVerified = typeof movementMeta.verifiedContract === "boolean"
        ? movementMeta.verifiedContract
        : null;
      const tokenVerified = typeof tokenSignal?.verifiedContract === "boolean"
        ? tokenSignal.verifiedContract
        : null;
      const verifiedContract = movementVerified !== null ? movementVerified : tokenVerified;
      const hasPriceSignal =
        movement.amountUsd !== null ||
        pricedTokenSet.has(tokenAddr) ||
        (typeof tokenSignal?.usdPrice === "number" && Number.isFinite(tokenSignal.usdPrice) && tokenSignal.usdPrice > 0) ||
        (typeof tokenSignal?.usdValue === "number" && Number.isFinite(tokenSignal.usdValue) && tokenSignal.usdValue > 0);

      if (movement.directionIn) {
        hasInflow = true;
        netUsdIn += Number.isFinite(usd) ? usd : 0;
        if (spamSet.has(tokenAddr) || movementPossibleSpam || tokenPossibleSpam) {
          hasSpamInflow = true;
        }
        if (verifiedContract === false) {
          hasUntrustedInflow = true;
        }
        if (!hasPriceSignal) {
          hasValuelessInflow = true;
        }
      } else {
        hasOutflow = true;
        netUsdOut += Number.isFinite(usd) ? usd : 0;

        const hasMeaningfulOutflow =
          hasPositiveAmountRaw(movement.amountRaw) ||
          (movement.amountUsd !== null && Number.isFinite(usd) && usd > 0);
        if (!hasMeaningfulOutflow) {
          continue;
        }

        meaningfulOutflowCount += 1;

        const isSpamLikeOutflow = spamSet.has(tokenAddr) || movementPossibleSpam || tokenPossibleSpam;
        const isUntrustedOutflow = verifiedContract === false;
        const isValuelessOutflow = !hasPriceSignal;
        if (isSpamLikeOutflow || isUntrustedOutflow || isValuelessOutflow) {
          suspiciousOutflowCount += 1;
        }

        if (!isSpamLikeOutflow && !isUntrustedOutflow && hasPriceSignal) {
          trustedOutflowCount += 1;
        }
      }
    }
    const netUsdFlow = netUsdIn - netUsdOut;
    const isReceiveLike =
      category === "token receive" ||
      category === "receive" ||
      (methodLabel === "transfer" && toAddress === walletAddress);
    const isAirdropLikeMethod = new Set([
      "airdrop",
      "dispersetoken",
      "dispersetokensimple",
      "multisend",
      "batchtransfer",
    ]).has(methodLabel);

    const isAirdropTagged = category === "airdrop" || methodLabel === "airdrop";
    const isApprove = methodLabel === "approve" || category === "approve";
    const isSwap = category.includes("swap") || methodLabel.includes("swap");
    const isSpoofedTransferActivity = isSuspiciousSpoofedTransferActivity({
      walletAddress,
      category,
      methodLabel,
      fromAddress,
      toAddress,
      meaningfulOutflowCount,
      suspiciousOutflowCount,
      trustedOutflowCount,
    });
    const claimMethods = new Set(["getrewards", "getreward", "claim", "claimfees", "claimrewards", "collect"]);
    const depositMethods = new Set([
      "deposit",
      "mint",
      "stake",
      "increaseliquidity",
      "addliquidity",
      "lock",
      "createlock",
      "wrap",
    ]);
    const withdrawMethods = new Set([
      "withdraw",
      "redeem",
      "unstake",
      "decreaseliquidity",
      "removeliquidity",
      "burn",
      "unwrap",
    ]);

    let classification: string;

    if (isApprove) {
      classification = "approve";
    } else if (isSwap) {
      classification = "swap";
    } else if (isAerodromeVotingEscrowInteraction({
      category,
      methodLabel,
      summary,
      protocol: counterpartyInfo?.protocol ?? null,
      contractType: counterpartyInfo?.contractType ?? null,
    })) {
      classification = "governance";
    } else if (!isAirdropTagged && (
      claimMethods.has(methodLabel)
      || summary.includes("reward")
      || summary.includes("claimed")
      || category.includes("reward")
    )) {
      classification = "claim";
    } else if (counterpartyInfo) {
      const isMellow = counterpartyInfo.protocol === "mellow";
      const isGauge = counterpartyContractType.includes("gauge");
      const depositKey = isMellow ? "strategy_deposit" : "manual_deposit";
      const withdrawKey = isMellow ? "strategy_withdraw" : "manual_withdrawal";
      const sentPositionLikeAssetToGauge =
        isGauge &&
        fromAddress === walletAddress &&
        toAddress === counterpartyAddress &&
        (category === "nft sale" || category === "nft send" || category === "burn");
      const receivedPositionLikeAssetFromGauge =
        isGauge &&
        toAddress === walletAddress &&
        fromAddress === counterpartyAddress &&
        (category === "mint" || category === "nft receive");

      // Aerodrome CL Position Manager multicalls often expose methodLabel="deposit" even when
      // the underlying action is decreaseLiquidity + collect + burn. Trust category and the
      // signed net USD flow over Moralis' methodLabel for these ambiguous cases.
      const categoryOverridesMethod =
        category === "nft sale"
        || category === "nft send"
        || category === "burn"
        || category === "mint"
        || methodLabel === "multicall";

      if (sentPositionLikeAssetToGauge) {
        classification = "stake";
      } else if (receivedPositionLikeAssetFromGauge) {
        classification = "unstake";
      } else if (isGauge && depositMethods.has(methodLabel)) {
        classification = "stake";
      } else if (isGauge && withdrawMethods.has(methodLabel)) {
        classification = "unstake";
      } else if (isGauge && category === "deposit") {
        classification = "stake";
      } else if (isGauge && category === "withdraw") {
        classification = "unstake";
      } else if (categoryOverridesMethod) {
        if (netUsdFlow > 0 || (hasInflow && !hasOutflow)) {
          classification = isGauge ? "unstake" : withdrawKey;
        } else if (netUsdFlow < 0 || (hasOutflow && !hasInflow)) {
          classification = isGauge ? "stake" : depositKey;
        } else if (category === "nft sale" || category === "burn") {
          classification = isGauge ? "stake" : withdrawKey;
        } else if (category === "mint" || category === "nft send") {
          classification = isGauge ? "unstake" : depositKey;
        } else {
          classification = "other";
        }
      } else if (depositMethods.has(methodLabel)) {
        classification = isGauge ? "stake" : depositKey;
      } else if (withdrawMethods.has(methodLabel)) {
        classification = isGauge ? "unstake" : withdrawKey;
      } else if (category === "deposit") {
        classification = isGauge ? "stake" : depositKey;
      } else if (category === "withdraw") {
        classification = isGauge ? "unstake" : withdrawKey;
      } else {
        // Counterparty is a known protocol but the action is unclear; trust net flow.
        if (netUsdFlow > 0) {
          classification = isGauge ? "unstake" : withdrawKey;
        } else if (netUsdFlow < 0) {
          classification = isGauge ? "stake" : depositKey;
        } else {
          classification = "other";
        }
      }
    } else if (category === "mint" || category === "deposit") {
      classification = "manual_deposit";
    } else if (category === "burn" || category === "withdraw") {
      classification = "manual_withdrawal";
    } else if (category === "nft sale" && hasInflow) {
      classification = "manual_withdrawal";
    } else if (category === "nft send" && hasOutflow) {
      classification = "manual_deposit";
    } else if (isAirdropTagged || hasSpamInflow || (!counterpartyInfo && isReceiveLike && (isAirdropLikeMethod || hasUntrustedInflow || hasValuelessInflow))) {
      classification = "airdrop";
    } else if (isSpoofedTransferActivity) {
      classification = "other";
    } else if (category === "token receive" || category === "receive") {
      classification = "cash_in";
    } else if (category === "token send" || category === "send") {
      classification = "cash_out";
    } else if (methodLabel === "transfer" && toAddress === walletAddress) {
      classification = "cash_in";
    } else if (methodLabel === "transfer" && fromAddress === walletAddress) {
      classification = "cash_out";
    } else {
      classification = "other";
    }

    const nextMetadataJson = {
      ...row.metadataJson,
    } satisfies Record<string, unknown>;

    if (isSpoofedTransferActivity) {
      nextMetadataJson.excludeFromUiDefault = true;
      nextMetadataJson.suspiciousActivity = true;
      nextMetadataJson.suspiciousReasonCodes = ["spoofedTransfer", "spamTokenOutflow"];
    } else {
      delete nextMetadataJson.excludeFromUiDefault;
      delete nextMetadataJson.suspiciousActivity;
      delete nextMetadataJson.suspiciousReasonCodes;
    }

    // Spec: spam/airdrop ledger events are excluded from the economic pipeline.
    // The exclusion reason is stamped here as an audit trail so downstream
    // consumers can filter without re-deriving spam signals.
    // See docs/spec/the-cab-aerodrome-claim-surfaces-research.md §4.
    if (classification === "airdrop") {
      nextMetadataJson.economicExclusionReason = "airdrop_spam";
    } else {
      delete nextMetadataJson.economicExclusionReason;
    }

    await db
      .update(ledgerEvents)
      .set({
        classification,
        classificationRunId: input.runId,
        confidence: isSpoofedTransferActivity ? "low" : row.confidence,
        metadataJson: nextMetadataJson,
      })
      .where(eq(ledgerEvents.id, row.id));
    updated += 1;
  }

  return updated;
}

export async function persistRewardCandidates(input: {
  walletAddress: string;
  chainId: number;
  rewardCandidates: Array<{
    txHash: string;
    occurredAt: Date;
    category: string | null;
    summary: string | null;
  }>;
}) {
  if (input.rewardCandidates.length === 0) {
    return 0;
  }

  const db = getDb();
  await db
    .insert(rewardEvents)
    .values(
      input.rewardCandidates.map((candidate) => ({
        chainId: input.chainId,
        walletAddress: input.walletAddress.toLowerCase(),
        txHash: candidate.txHash.toLowerCase(),
        logIndex: 0,
        rewardType: candidate.category?.toLowerCase().includes("reward") ? "reward_claim" : "claim",
        occurredAt: candidate.occurredAt,
        metadataJson: {
          category: candidate.category,
          summary: candidate.summary,
        },
      })),
    )
    .onConflictDoNothing();

  return input.rewardCandidates.length;
}

function toUtcDayBucket(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSyntheticRewardSnapshotTxHash(input: {
  chainId: number;
  walletAddress: string;
  depositOrStrategyId: string;
  dayUtc: string;
  rewardType: string;
}) {
  const hash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 64);

  return `0x${hash}`;
}

export function resolvePersistedRewardResolutionStatus(input: {
  depositOrStrategyId?: string | null;
  strategyExposureId?: string | null;
}) {
  return input.depositOrStrategyId || input.strategyExposureId ? "resolved" as const : "unresolved" as const;
}

export function buildAccrualRewardSnapshotRows(input: {
  walletAddress: string;
  chainId: number;
  sliceEndUtc: Date;
  accrualSnapshotDayUtc: string;
  accrualSnapshots: Array<{
    depositOrStrategyId: string;
    strategyExposureId?: string | null;
    resolvedPoolId?: string | null;
    rewardType: string;
    protocol: string | null;
    targetType: "deposit" | "strategy";
    resolutionBasis?: string | null;
    resolutionReasonCodes?: string[];
    targetTokenId?: string | null;
    targetWrapperAddress?: string | null;
    surfaceKind?: string | null;
    componentKey?: string | null;
    economicComponentKind?: string | null;
    movementLogIndexes?: number[];
    feeAttributionBasis?: string | null;
    externalStrategyPositionReference?: string | null;
    externalStrategyPositionReferenceStatus?: "resolved" | "unresolved";
  }>;
}) {
  const walletAddress = input.walletAddress.toLowerCase();

  return input.accrualSnapshots.map((snapshot) => ({
    chainId: input.chainId,
    walletAddress,
    txHash: buildSyntheticRewardSnapshotTxHash({
      chainId: input.chainId,
      walletAddress,
      depositOrStrategyId: snapshot.depositOrStrategyId,
      dayUtc: input.accrualSnapshotDayUtc,
      rewardType: snapshot.rewardType,
    }),
    // Synthetic accrual snapshots have no real log ordering. Keep this stable so reruns upsert cleanly.
    logIndex: 0,
    rewardType: snapshot.rewardType,
    depositOrStrategyId: snapshot.depositOrStrategyId,
    strategyExposureId: snapshot.strategyExposureId ?? null,
    resolvedPoolId: snapshot.resolvedPoolId ?? null,
    occurredAt: input.sliceEndUtc,
    accrualSnapshotDayUtc: input.accrualSnapshotDayUtc,
    isAccrualSnapshot: true,
    resolutionBasis: snapshot.resolutionBasis ?? null,
    resolutionReasonCodes: snapshot.resolutionReasonCodes ?? [],
    resolutionStatus: "resolved" as const,
    metadataJson: {
      protocol: snapshot.protocol,
      targetType: snapshot.targetType,
      targetTokenId: snapshot.targetTokenId ?? null,
      targetWrapperAddress: snapshot.targetWrapperAddress ?? null,
      externalStrategyPositionReference: snapshot.externalStrategyPositionReference ?? null,
      externalStrategyPositionReferenceStatus:
        snapshot.externalStrategyPositionReferenceStatus ??
        (snapshot.externalStrategyPositionReference ? "resolved" : "unresolved"),
      valuationMethod: "extrapolated",
    },
  }));
}

export async function persistResolvedRewardEvents(input: {
  walletAddress: string;
  chainId: number;
  sliceEndUtc: Date;
  claims: Array<{
    txHash: string;
    logIndex: number;
    rewardType: string;
    depositOrStrategyId: string | null;
    strategyExposureId?: string | null;
    resolvedPoolId?: string | null;
    occurredAt: Date;
    resolutionBasis?: string | null;
    resolutionReasonCodes?: string[];
    category: string | null;
    summary: string | null;
    protocol: string | null;
    targetType: "deposit" | "strategy" | null;
    targetTokenId?: string | null;
    targetWrapperAddress?: string | null;
    surfaceKind?: string | null;
    componentKey?: string | null;
    economicComponentKind?: string | null;
    movementLogIndexes?: number[];
    feeAttributionBasis?: string | null;
    externalStrategyPositionReference?: string | null;
    externalStrategyPositionReferenceStatus?: "resolved" | "unresolved";
  }>;
  accrualSnapshots: Array<{
    depositOrStrategyId: string;
    strategyExposureId?: string | null;
    resolvedPoolId?: string | null;
    rewardType: string;
    protocol: string | null;
    targetType: "deposit" | "strategy";
    resolutionBasis?: string | null;
    resolutionReasonCodes?: string[];
    targetTokenId?: string | null;
    targetWrapperAddress?: string | null;
    externalStrategyPositionReference?: string | null;
    externalStrategyPositionReferenceStatus?: "resolved" | "unresolved";
  }>;
}) {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const accrualSnapshotDayUtc = toUtcDayBucket(new Date(input.sliceEndUtc.getTime() - 24 * 60 * 60 * 1000));

  if (input.claims.length > 0) {
    await db
      .insert(rewardEvents)
      .values(
        input.claims.map((claim) => ({
          chainId: input.chainId,
          walletAddress,
          txHash: claim.txHash.toLowerCase(),
          logIndex: claim.logIndex,
          rewardType: claim.rewardType,
          depositOrStrategyId: claim.depositOrStrategyId,
          strategyExposureId: claim.strategyExposureId ?? null,
          resolvedPoolId: claim.resolvedPoolId ?? null,
          occurredAt: claim.occurredAt,
          resolutionBasis: claim.resolutionBasis ?? null,
          resolutionReasonCodes: claim.resolutionReasonCodes ?? [],
          resolutionStatus: resolvePersistedRewardResolutionStatus(claim),
          metadataJson: {
            category: claim.category,
            summary: claim.summary,
            protocol: claim.protocol,
            targetType: claim.targetType,
            targetTokenId: claim.targetTokenId ?? null,
            targetWrapperAddress: claim.targetWrapperAddress ?? null,
            surfaceKind: claim.surfaceKind ?? null,
            componentKey: claim.componentKey ?? null,
            economicComponentKind: claim.economicComponentKind ?? null,
            movementLogIndexes: claim.movementLogIndexes ?? [],
            feeAttributionBasis: claim.feeAttributionBasis ?? null,
            externalStrategyPositionReference: claim.externalStrategyPositionReference ?? null,
            externalStrategyPositionReferenceStatus: claim.externalStrategyPositionReferenceStatus ?? (claim.externalStrategyPositionReference ? "resolved" : "unresolved"),
            valuationMethod: "event",
          },
        })),
      )
      .onConflictDoUpdate({
        target: [rewardEvents.chainId, rewardEvents.txHash, rewardEvents.logIndex, rewardEvents.rewardType],
        set: {
          depositOrStrategyId: sql`excluded.deposit_or_strategy_id`,
          strategyExposureId: sql`excluded.strategy_exposure_id`,
          resolvedPoolId: sql`excluded.resolved_pool_id`,
          occurredAt: sql`excluded.occurred_at`,
          resolutionBasis: sql`excluded.resolution_basis`,
          resolutionReasonCodes: sql`excluded.resolution_reason_codes`,
          resolutionStatus: sql`excluded.resolution_status`,
          metadataJson: sql`COALESCE(${rewardEvents.metadataJson}, '{}'::jsonb) || COALESCE(excluded.metadata_json, '{}'::jsonb) || jsonb_build_object('valuationMethod', 'event')`,
        },
      });

    await enrichRewardEventsFromMovements({
      chainId: input.chainId,
      walletAddress,
      txHashes: input.claims.map((claim) => claim.txHash.toLowerCase()),
    });
  }

  if (input.accrualSnapshots.length > 0) {
    const accrualSnapshotRows = buildAccrualRewardSnapshotRows({
      walletAddress,
      chainId: input.chainId,
      sliceEndUtc: input.sliceEndUtc,
      accrualSnapshotDayUtc,
      accrualSnapshots: input.accrualSnapshots,
    });

    await db
      .insert(rewardEvents)
      .values(accrualSnapshotRows)
      .onConflictDoUpdate({
        target: [rewardEvents.chainId, rewardEvents.depositOrStrategyId, rewardEvents.accrualSnapshotDayUtc],
        targetWhere: sql`${rewardEvents.isAccrualSnapshot} = true`,
        set: {
          txHash: sql`excluded.tx_hash`,
          logIndex: sql`excluded.log_index`,
          rewardType: sql`excluded.reward_type`,
          occurredAt: input.sliceEndUtc,
          accrualSnapshotDayUtc,
          isAccrualSnapshot: true,
          resolutionStatus: "resolved",
          metadataJson: sql`COALESCE(${rewardEvents.metadataJson}, '{}'::jsonb) || COALESCE(excluded.metadata_json, '{}'::jsonb) || jsonb_build_object('valuationMethod', 'extrapolated')`,
        },
      });
  }

  return {
    claimCount: input.claims.length,
    accrualSnapshotCount: input.accrualSnapshots.length,
    accrualSnapshotDayUtc,
  };
}

async function enrichRewardEventsFromMovements(input: {
  chainId: number;
  walletAddress: string;
  txHashes: string[];
}) {
  if (input.txHashes.length === 0) {
    return;
  }

  const db = getDb();
  const txHashesArray = sql`ARRAY[${sql.join(input.txHashes.map((txHash) => sql`${txHash}`), sql`, `)}]::text[]`;
  // Aggregate all inbound movements for the tx so split claim transfers are valued the same way as overview reads.
  await db.execute(sql`
    WITH movement_rollup AS (
      SELECT
        re.id AS reward_event_id,
        CASE WHEN count(DISTINCT am.token_address) = 1 THEN min(am.token_address) ELSE null END AS token_address,
        CASE
          WHEN count(DISTINCT am.token_address) = 1 AND bool_and(am.amount_raw IS NOT NULL)
          THEN sum(am.amount_raw::numeric)
          ELSE null
        END AS amount_raw,
        sum(
          coalesce(
            am.amount_usd,
            CASE
              WHEN priced_movement.price_usd IS NULL OR am.amount_raw IS NULL THEN null
              WHEN am.token_address = '0x4200000000000000000000000000000000000006'
              THEN (am.amount_raw::numeric / 1000000000000000000::numeric) * priced_movement.price_usd
              WHEN am.token_address = '0x940181a94a35a4569e4529a3cdfb74e38fd98631'
              THEN (am.amount_raw::numeric / 1000000000000000000::numeric) * priced_movement.price_usd
              WHEN am.token_address = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
              THEN (am.amount_raw::numeric / 1000000::numeric) * priced_movement.price_usd
              WHEN am.token_address = '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'
              THEN (am.amount_raw::numeric / 100000000::numeric) * priced_movement.price_usd
              WHEN am.token_address = '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'
              THEN (am.amount_raw::numeric / 1000000::numeric) * priced_movement.price_usd
              ELSE null
            END
          )
        ) AS amount_usd
      FROM ${ledgerEvents} le
      JOIN ${rewardEvents} re
        ON re.tx_hash = le.tx_hash
        AND re.chain_id = ${input.chainId}
        AND re.wallet_address = ${input.walletAddress}
        AND re.is_accrual_snapshot = false
      JOIN ${assetMovements} am ON am.ledger_event_id = le.id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS selected_count
        FROM ${assetMovements} selected_am
        WHERE selected_am.ledger_event_id = le.id
          AND selected_am.wallet_address = ${input.walletAddress}
          AND selected_am.chain_id = ${input.chainId}
          AND selected_am.direction_in = true
          AND (selected_am.metadata_json ->> 'logIndex') IN (
            SELECT jsonb_array_elements_text(COALESCE(re.metadata_json -> 'movementLogIndexes', '[]'::jsonb))
          )
      ) selected_movements ON true
      LEFT JOIN LATERAL (
        SELECT pp.price_usd
        FROM ${pricePoints} pp
        WHERE pp.chain_id = ${input.chainId}
          AND pp.token_address = am.token_address
          AND pp.priced_at <= le.occurred_at
        ORDER BY pp.priced_at DESC
        LIMIT 1
      ) priced_movement ON true
      WHERE am.wallet_address = ${input.walletAddress}
        AND am.chain_id = ${input.chainId}
        AND am.direction_in = true
        AND le.tx_hash = ANY(${txHashesArray})
        AND (
          jsonb_array_length(COALESCE(re.metadata_json -> 'movementLogIndexes', '[]'::jsonb)) = 0
          OR COALESCE(selected_movements.selected_count, 0) = 0
          OR (am.metadata_json ->> 'logIndex') IN (
            SELECT jsonb_array_elements_text(COALESCE(re.metadata_json -> 'movementLogIndexes', '[]'::jsonb))
          )
        )
      GROUP BY re.id
    )
    UPDATE ${rewardEvents} re
    SET
      token_address = mr.token_address,
      amount_raw = mr.amount_raw,
      amount_usd = mr.amount_usd,
      metadata_json = COALESCE(re.metadata_json, '{}'::jsonb) || jsonb_build_object('enrichedFromMovement', true)
    FROM movement_rollup mr
    WHERE re.id = mr.reward_event_id
      AND re.chain_id = ${input.chainId}
      AND re.wallet_address = ${input.walletAddress}
      AND re.is_accrual_snapshot = false
      AND (re.token_address IS NULL OR re.amount_raw IS NULL OR re.amount_usd IS NULL)
  `);
}

export async function persistCurrentSnapshots(input: {
  walletAddress: string;
  chainId: number;
  dayUtc: string;
  capturedAt: Date;
}) {
  const db = getDb();
  const [depositRows, exposureRows] = await Promise.all([
    db
      .select({ id: deposits.id, metadataJson: deposits.metadataJson, coverageStatus: deposits.coverageStatus })
      .from(deposits)
      .where(
        and(
          eq(deposits.walletAddress, input.walletAddress.toLowerCase()),
          eq(deposits.chainId, input.chainId),
        ),
      ),
    db
      .select({
        id: strategyExposures.id,
        strategyId: strategyExposures.strategyId,
        metadataJson: strategyExposures.metadataJson,
        coverageStatus: strategyExposures.coverageStatus,
      })
      .from(strategyExposures)
      .where(
        and(
          eq(strategyExposures.walletAddress, input.walletAddress.toLowerCase()),
          eq(strategyExposures.chainId, input.chainId),
        ),
      ),
  ]);

  const depositValue = depositRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const strategyValue = exposureRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const totalValue = depositValue + strategyValue;

  await db
    .delete(performanceSnapshots)
    .where(
      and(
        eq(performanceSnapshots.chainId, input.chainId),
        eq(performanceSnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(performanceSnapshots.dayUtc, input.dayUtc),
        eq(performanceSnapshots.resolution, "daily"),
      ),
    );

  await db.insert(performanceSnapshots).values([
    {
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      scope: "portfolio",
      scopeRefId: null,
      capturedAt: input.capturedAt,
      dayUtc: input.dayUtc,
      resolution: "daily",
      coverageStatus: totalValue > 0 ? "full" : "unknown",
      valueUsd: String(totalValue),
      metadataJson: {
        depositValueUsd: depositValue,
        strategyValueUsd: strategyValue,
      },
    },
    ...depositRows.map((row) => ({
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      scope: "deposit",
      scopeRefId: row.id,
      capturedAt: input.capturedAt,
      dayUtc: input.dayUtc,
      resolution: "daily",
      coverageStatus: row.coverageStatus,
      valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
      metadataJson: row.metadataJson,
    })),
    ...exposureRows.map((row) => ({
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      scope: "strategy",
      scopeRefId: row.strategyId,
      capturedAt: input.capturedAt,
      dayUtc: input.dayUtc,
      resolution: "daily",
      coverageStatus: row.coverageStatus,
      valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
      metadataJson: row.metadataJson,
    })),
  ]);

  await db.insert(portfolioSnapshots).values({
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    capturedAt: input.capturedAt,
    totalValueUsd: String(totalValue),
    deployedValueUsd: String(totalValue),
    idleValueUsd: "0",
    metadataJson: {
      depositValueUsd: depositValue,
      strategyValueUsd: strategyValue,
      scope: "analysis_engine",
      dayUtc: input.dayUtc,
    },
  });

  return {
    totalValueUsd: totalValue,
    depositValueUsd: depositValue,
    strategyValueUsd: strategyValue,
  };
}

export async function persistPoolSnapshots(input: {
  chainId: number;
  dayUtc: string;
  poolTotals: Array<{ poolId: string; valueUsd: number }>;
}) {
  if (input.poolTotals.length === 0) {
    return 0;
  }

  const db = getDb();
  for (const poolTotal of input.poolTotals) {
    await db
      .delete(poolMetricsSnapshots)
      .where(
        and(
          eq(poolMetricsSnapshots.chainId, input.chainId),
          eq(poolMetricsSnapshots.poolId, poolTotal.poolId),
          eq(poolMetricsSnapshots.dayUtc, input.dayUtc),
        ),
      );

    await db.insert(poolMetricsSnapshots).values({
      chainId: input.chainId,
      poolId: poolTotal.poolId,
      dayUtc: input.dayUtc,
      tvlUsd: String(poolTotal.valueUsd),
      metadataJson: {
        source: "analysis_engine",
      },
    });
  }

  return input.poolTotals.length;
}

export async function materializeStrategyReadModels(input: MaterializeStrategyReadModelsInput) {
  return materializeStrategyReadModelsProjection(input);
}
