import {
  asRecordArray,
  asString,
  buildProtocolMetadataIndex,
  collectAddressSignals,
  collectStringSignals,
  detectProtocolFromSignals,
  extractTokenId,
  normalizeAddress,
  type KnownProtocolContract,
} from "@/server/protocol-positions/protocolMetadata";
import { readAerodromeManualPositions } from "@/server/protocol-positions/readAerodromeManualPositions";
import { reconstructRecentPositionState } from "@/server/protocol-positions/reconstructRecentPositionState";
import type { OverviewProtocolPosition } from "@/server/protocol-positions/protocolPositions.types";

type MoralisHistoryRecord = Record<string, unknown>;

type AerodromeLifecycleAction = "mint" | "increaseLiquidity" | "decreaseLiquidity" | "collect";

export type AerodromeDepositLifecycleRecord = {
  txHash: string;
  occurredAt: Date;
  tokenId: string | null;
  action: AerodromeLifecycleAction;
  positionManagerAddress: string | null;
  poolAddress: string | null;
  category: string | null;
  methodLabel: string | null;
  summary: string | null;
};

export type DecodeAerodromeDepositLifecycleResult = {
  rows: OverviewProtocolPosition[];
  lifecycle: AerodromeDepositLifecycleRecord[];
  rewardCandidates: Array<{
    txHash: string;
    occurredAt: Date;
    category: string | null;
    summary: string | null;
    protocol: "aerodrome";
    targetType: "deposit";
    targetTokenId: string | null;
  }>;
  providerPartial: boolean;
  failedTokenIds: string[];
  artifacts: Awaited<ReturnType<typeof readAerodromeManualPositions>>["artifacts"];
};

export function resolveAerodromeRewardCandidateTokenId(input: {
  explicitTokenId: string | null;
  lifecycleTokenId: string | null;
}) {
  return input.explicitTokenId ?? input.lifecycleTokenId ?? null;
}

const REWARD_TOKEN_ID_KEY_PATTERN = /^(token_id|tokenId|token_ids|tokenIds|nft_token_id|position_id|positionId|position_ids|positionIds)$/i;

function normalizeTokenIdCandidates(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(Math.trunc(value))];
  }

  if (typeof value === "bigint") {
    return [value.toString()];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeTokenIdCandidates(entry));
  }

  return [];
}

function collectRewardTokenIdCandidates(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectRewardTokenIdCandidates(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const candidates: string[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (REWARD_TOKEN_ID_KEY_PATTERN.test(key)) {
      candidates.push(...normalizeTokenIdCandidates(nestedValue));
    }

    candidates.push(...collectRewardTokenIdCandidates(nestedValue, depth + 1));
  }

  return candidates;
}

export function extractAerodromeRewardRecordTokenId(record: MoralisHistoryRecord) {
  const directCandidates = Array.from(new Set([
    ...collectRewardTokenIdCandidates(record),
    ...(extractTokenId(record) ? [extractTokenId(record)] : []),
  ].filter((candidate): candidate is string => Boolean(candidate))));

  if (directCandidates.length === 1) {
    return directCandidates[0] ?? null;
  }

  return null;
}

function resolveSameTxLifecycleTokenId(input: {
  txHash: string;
  lifecycleRecords: AerodromeDepositLifecycleRecord[];
}) {
  const tokenIds = Array.from(new Set(
    input.lifecycleRecords
      .filter((record) => record.txHash === input.txHash)
      .map((record) => record.tokenId)
      .filter((tokenId): tokenId is string => Boolean(tokenId)),
  ));

  return tokenIds.length === 1 ? (tokenIds[0] ?? null) : null;
}

function parseTimestamp(record: MoralisHistoryRecord) {
  const value = asString(record.block_timestamp) ?? asString(record.block_time) ?? asString(record.created_at);
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractTxHash(record: MoralisHistoryRecord) {
  return (asString(record.transaction_hash) ?? asString(record.hash))?.toLowerCase() ?? null;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function recordHasNftBurn(record: MoralisHistoryRecord): boolean {
  const transfers = asRecordArray(record.nft_transfers);
  return transfers.some((transfer) => {
    const to = normalizeAddress(asString(transfer.to_address) ?? asString(transfer.to));
    return to === ZERO_ADDRESS;
  });
}

function recordHasNftTransferOut(record: MoralisHistoryRecord, walletAddress: string): boolean {
  const wallet = normalizeAddress(walletAddress);
  if (!wallet) return false;
  const transfers = asRecordArray(record.nft_transfers);
  return transfers.some((transfer) => {
    const from = normalizeAddress(asString(transfer.from_address) ?? asString(transfer.from));
    const to = normalizeAddress(asString(transfer.to_address) ?? asString(transfer.to));
    return from === wallet && to !== null && to !== wallet;
  });
}

function recordHasErc20ReceiveFrom(
  record: MoralisHistoryRecord,
  walletAddress: string,
  senderAddresses: Set<string>,
): boolean {
  const wallet = normalizeAddress(walletAddress);
  if (!wallet || senderAddresses.size === 0) return false;
  const transfers = asRecordArray(record.erc20_transfers);
  return transfers.some((transfer) => {
    const from = normalizeAddress(asString(transfer.from_address) ?? asString(transfer.from));
    const to = normalizeAddress(asString(transfer.to_address) ?? asString(transfer.to));
    return to === wallet && from !== null && senderAddresses.has(from);
  });
}

function extractLifecycleAction(
  record: MoralisHistoryRecord,
  context?: { walletAddress?: string },
): AerodromeLifecycleAction | null {
  // Only inspect curated fields. Descending into `collectStringSignals(record)`
  // pulls in decoded ABI method names / nested metadata that can include words
  // like "burn" or "decrease" even for a mint tx, leading to misclassification.
  const text = [
    asString(record.category),
    asString(record.method_label),
    asString(record.summary),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Mint first: the mint tx may also include an NFT transfer (from 0x0) plus
  // a multicall method label. Detect it explicitly before close-shaped checks.
  if (text.includes("mint") || text.includes("deposit")) {
    return "mint";
  }

  if (text.includes("increase")) {
    return "increaseLiquidity";
  }

  // Close-shaped transactions. Aerodrome NFT positions can close via a
  // multicall that bundles decreaseLiquidity + collect + burn, or via a
  // direct NFT burn / transfer-out. Match any of those shapes so the close
  // is recorded even when Moralis labels the tx generically.
  if (
    text.includes("decrease")
    || text.includes("withdraw")
    || text.includes("remove")
    || text.includes("burn")
    || text.includes("exit")
    || text.includes("redeem")
    || text.includes("unwind")
    || recordHasNftBurn(record)
    || (context?.walletAddress ? recordHasNftTransferOut(record, context.walletAddress) : false)
  ) {
    return "decreaseLiquidity";
  }

  if (text.includes("collect") || text.includes("claim")) {
    return "collect";
  }

  return null;
}

function extractLifecycleTokenId(record: MoralisHistoryRecord) {
  return extractAerodromeRewardRecordTokenId(record) ?? extractTokenId(asRecordArray(record.nft_transfers)[0] ?? null);
}

function buildLifecycleRecords(input: {
  walletAddress: string;
  chainId: number;
  history: MoralisHistoryRecord[];
  protocolContracts: KnownProtocolContract[];
}) {
  const metadata = buildProtocolMetadataIndex(input.chainId, input.protocolContracts);
  const lifecycle: AerodromeDepositLifecycleRecord[] = [];

  for (const record of input.history) {
    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    if (!txHash || !occurredAt) {
      continue;
    }

    const addresses = collectAddressSignals(record);
    const signals = collectStringSignals(record);
    const protocol = detectProtocolFromSignals(metadata, signals, addresses);
    if (protocol !== "aerodrome") {
      continue;
    }

    const action = extractLifecycleAction(record, { walletAddress: input.walletAddress });
    if (!action) {
      continue;
    }

    const tokenId = extractLifecycleTokenId(record);
    const knownContracts = addresses.filter((address) => metadata.byAddress.has(address));
    const touchesGauge = knownContracts.some((address) =>
      metadata.byAddress.get(address)?.contractType.toLowerCase().includes("gauge"),
    );
    if (touchesGauge && action !== "collect") {
      continue;
    }

    const gaugePoolAddresses = knownContracts
      .filter((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("gauge"))
      .map((address) => normalizeAddress(asString(metadata.byAddress.get(address)?.metadataJson.poolAddress)))
      .filter((value): value is string => Boolean(value));

    const positionManagerAddress = normalizeAddress(
      knownContracts.find((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("position"))
        ?? knownContracts[0]
        ?? null,
    );
    const poolAddress = normalizeAddress(
      knownContracts.find((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("pool"))
        ?? (gaugePoolAddresses.length === 1 ? gaugePoolAddresses[0] : null)
        ?? null,
    );

    lifecycle.push({
      txHash,
      occurredAt,
      tokenId,
      action,
      positionManagerAddress,
      poolAddress,
      category: asString(record.category),
      methodLabel: asString(record.method_label),
      summary: asString(record.summary),
    });
  }

  return lifecycle.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}

type GaugeRewardCandidate = {
  txHash: string;
  occurredAt: Date;
  category: string | null;
  summary: string | null;
  targetTokenId: string | null;
};

/**
 * Detect ERC20 receives from known Aerodrome gauges. Moralis labels these as
 * "token receive" entries, never as "claim"/"collect", so they are not picked
 * up by `extractLifecycleAction`. They must NOT be added to the deposit
 * lifecycle (which would create spurious deposit rows under the gauge address),
 * only emitted as reward candidates so phase-rewards can attribute them.
 */
function buildGaugeRewardCandidates(input: {
  walletAddress: string;
  chainId: number;
  history: MoralisHistoryRecord[];
  protocolContracts: KnownProtocolContract[];
}): GaugeRewardCandidate[] {
  const metadata = buildProtocolMetadataIndex(input.chainId, input.protocolContracts);
  const candidates: GaugeRewardCandidate[] = [];

  for (const record of input.history) {
    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    if (!txHash || !occurredAt) continue;

    const addresses = collectAddressSignals(record);
    const knownContracts = addresses.filter((address) => metadata.byAddress.has(address));
    const gaugeAddresses = new Set(
      knownContracts.filter((address) =>
        metadata.byAddress.get(address)?.contractType.toLowerCase().includes("gauge"),
      ),
    );
    if (gaugeAddresses.size === 0) continue;

    if (!recordHasErc20ReceiveFrom(record, input.walletAddress, gaugeAddresses)) continue;

    const gaugePoolAddresses = Array.from(gaugeAddresses)
      .map((address) => normalizeAddress(asString(metadata.byAddress.get(address)?.metadataJson.poolAddress)))
      .filter((value): value is string => Boolean(value));

    candidates.push({
      txHash,
      occurredAt,
      category: asString(record.category),
      summary: asString(record.summary),
      targetTokenId: extractAerodromeRewardRecordTokenId(record),
    });
  }

  return candidates;
}

export async function decodeAerodromeDepositLifecycle(input: {
  walletAddress: string;
  chainId: number;
  history: MoralisHistoryRecord[];
  protocolContracts: KnownProtocolContract[];
  now?: Date;
}): Promise<DecodeAerodromeDepositLifecycleResult> {
  const now = input.now ?? new Date();
  const lifecycle = buildLifecycleRecords(input);
  const manualTokenIds = Array.from(
    new Set(
      lifecycle
        .map((record) => record.tokenId)
        .filter((tokenId): tokenId is string => Boolean(tokenId)),
    ),
  );

  const [currentState, reconstructed] = await Promise.all([
    readAerodromeManualPositions({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      tokenIds: manualTokenIds,
      now,
    }),
    Promise.resolve(
      reconstructRecentPositionState({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        history: input.history,
        protocolMetadata: buildProtocolMetadataIndex(input.chainId, input.protocolContracts),
        now,
      }),
    ),
  ]);

  const currentTokenIds = new Set(
    currentState.rows
      .map((row) => row.tokenId)
      .filter((tokenId): tokenId is string => Boolean(tokenId)),
  );
  const failedTokenIds = new Set(currentState.failedTokenIds);
  const reconstructedRows = reconstructed.rows.filter((row) => {
    if (row.protocol !== "aerodrome") {
      return false;
    }

    if (row.family === "manual_deposit" && row.tokenId) {
      return !currentTokenIds.has(row.tokenId) && !failedTokenIds.has(row.tokenId);
    }

    return row.family === "staked_lp";
  });

  const gaugeRewardCandidates = buildGaugeRewardCandidates({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    history: input.history,
    protocolContracts: input.protocolContracts,
  });

  // Skip gauge candidates that share a tx hash with a lifecycle-derived collect
  // (to avoid emitting the same reward twice).
  const lifecycleCollectTxHashes = new Set(
    lifecycle.filter((record) => record.action === "collect").map((record) => record.txHash),
  );
  const dedupedGaugeCandidates = gaugeRewardCandidates.filter(
    (candidate) => !lifecycleCollectTxHashes.has(candidate.txHash),
  );

  return {
    rows: [...currentState.rows, ...reconstructedRows],
    lifecycle,
    rewardCandidates: [
      ...lifecycle
        .filter((record) => record.action === "collect")
        .map((record) => ({
          txHash: record.txHash,
          occurredAt: record.occurredAt,
          category: record.category,
          summary: record.summary,
          protocol: "aerodrome" as const,
          targetType: "deposit" as const,
          targetTokenId: resolveAerodromeRewardCandidateTokenId({
            explicitTokenId: null,
            lifecycleTokenId: record.tokenId,
          }),
        })),
      ...dedupedGaugeCandidates.map((candidate) => ({
        txHash: candidate.txHash,
        occurredAt: candidate.occurredAt,
        category: candidate.category,
        summary: candidate.summary,
        protocol: "aerodrome" as const,
        targetType: "deposit" as const,
        targetTokenId: resolveAerodromeRewardCandidateTokenId({
          explicitTokenId: candidate.targetTokenId,
          lifecycleTokenId: resolveSameTxLifecycleTokenId({
            txHash: candidate.txHash,
            lifecycleRecords: lifecycle,
          }),
        }),
      })),
    ],
    providerPartial: currentState.providerPartial,
    failedTokenIds: currentState.failedTokenIds,
    artifacts: currentState.artifacts,
  };
}