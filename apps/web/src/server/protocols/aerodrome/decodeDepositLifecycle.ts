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

function extractLifecycleAction(record: MoralisHistoryRecord): AerodromeLifecycleAction | null {
  const text = [
    asString(record.category),
    asString(record.method_label),
    asString(record.summary),
    ...collectStringSignals(record),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("increase")) {
    return "increaseLiquidity";
  }

  if (text.includes("decrease") || text.includes("withdraw") || text.includes("remove")) {
    return "decreaseLiquidity";
  }

  if (text.includes("collect") || text.includes("claim")) {
    return "collect";
  }

  if (text.includes("mint") || text.includes("deposit")) {
    return "mint";
  }

  return null;
}

function extractLifecycleTokenId(record: MoralisHistoryRecord) {
  return extractTokenId(record) ?? extractTokenId(asRecordArray(record.nft_transfers)[0] ?? null);
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

    const action = extractLifecycleAction(record);
    if (!action) {
      continue;
    }

    const tokenId = extractLifecycleTokenId(record);
    const knownContracts = addresses.filter((address) => metadata.byAddress.has(address));
    const positionManagerAddress = normalizeAddress(
      knownContracts.find((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("position"))
        ?? knownContracts[0]
        ?? null,
    );
    const poolAddress = normalizeAddress(
      knownContracts.find((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("pool"))
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

  return {
    rows: [...currentState.rows, ...reconstructedRows],
    lifecycle,
    rewardCandidates: lifecycle
      .filter((record) => record.action === "collect")
      .map((record) => ({
        txHash: record.txHash,
        occurredAt: record.occurredAt,
        category: record.category,
        summary: record.summary,
        protocol: "aerodrome" as const,
        targetType: "deposit" as const,
        targetTokenId: record.tokenId,
      })),
    providerPartial: currentState.providerPartial,
    failedTokenIds: currentState.failedTokenIds,
    artifacts: currentState.artifacts,
  };
}