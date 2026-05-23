import {
  asRecordArray,
  asString,
  buildMetadataReasonCodes,
  buildProtocolLabel,
  buildProtocolPositionKey,
  buildProtocolSurface,
  collectAddressSignals,
  collectStringSignals,
  detectFamilyFromSignals,
  detectProtocolFromSignals,
  extractTokenId,
  extractTokenSymbols,
  mergeProtocolCoverageReasonCodes,
  normalizeAddress,
  type ProtocolMetadataIndex,
} from "@/server/protocol-positions/protocolMetadata";
import type {
  OverviewProtocolPosition,
  ProtocolPositionCoverageReasonCode,
} from "@/server/protocol-positions/protocolPositions.types";

type MoralisHistoryRecord = Record<string, unknown>;

export type RecentProtocolReconstructionResult = {
  rows: OverviewProtocolPosition[];
  usedRecentReconstruction: boolean;
};

const MAX_RECONSTRUCTION_WINDOW_DAYS = 30;

function isWithinRecentWindow(timestamp: string | null, now: Date) {
  if (!timestamp) {
    return false;
  }

  const candidate = new Date(timestamp);
  if (Number.isNaN(candidate.getTime())) {
    return false;
  }

  return now.getTime() - candidate.getTime() <= MAX_RECONSTRUCTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function pickHistoryTimestamp(record: MoralisHistoryRecord) {
  return (
    asString(record.block_timestamp) ??
    asString(record.block_time) ??
    asString(record.created_at) ??
    null
  );
}

function buildFallbackReasonCodes(
  baseReasonCodes: ProtocolPositionCoverageReasonCode[],
): ProtocolPositionCoverageReasonCode[] {
  return mergeProtocolCoverageReasonCodes(baseReasonCodes, ["recentProtocolReconstruction"]);
}

export function reconstructRecentPositionState(input: {
  walletAddress: string;
  chainId: number;
  history: MoralisHistoryRecord[];
  protocolMetadata: ProtocolMetadataIndex;
  now?: Date;
}): RecentProtocolReconstructionResult {
  const now = input.now ?? new Date();
  const reconstructedRows = new Map<string, OverviewProtocolPosition & { sortTimestamp: string | null }>();

  for (const item of input.history) {
    const timestamp = pickHistoryTimestamp(item);
    if (!isWithinRecentWindow(timestamp, now)) {
      continue;
    }

    const nftTransfers = asRecordArray(item.nft_transfers);
    const signals = collectStringSignals(item);
    const addresses = collectAddressSignals(item);
    const protocol = detectProtocolFromSignals(input.protocolMetadata, signals, addresses);
    const family = detectFamilyFromSignals(protocol, signals, {
      hasTokenId: Boolean(extractTokenId(item)),
      hasNftTransfers: nftTransfers.length > 0,
    });

    if (!protocol || !family) {
      continue;
    }

    const { primaryTokenSymbol, secondaryTokenSymbol } = extractTokenSymbols(item);
    const tokenId = extractTokenId(item) ?? extractTokenId(nftTransfers[0] ?? null);
    if (
      protocol === "aerodrome" &&
      (family === "manual_deposit" || family === "staked_lp") &&
      !tokenId &&
      nftTransfers.length === 0
    ) {
      continue;
    }
    const positionContractAddress =
      addresses.find((address) => input.protocolMetadata.byAddress.has(address)) ??
      normalizeAddress(asString(item.to_address)) ??
      normalizeAddress(asString(item.from_address));
    const wrapperAddress = family === "strategy_exposure" ? positionContractAddress : null;
    const baseReasonCodes = buildMetadataReasonCodes({
      family,
      valueUsd: null,
      positionContractAddress,
      wrapperAddress,
      tokenId,
    });
    const coverageReasonCodes = buildFallbackReasonCodes(baseReasonCodes);
    const strategyLabel =
      family === "strategy_exposure"
        ? signals.find((signal) => signal.toLowerCase().includes("mellow")) ?? "Mellow strategy exposure"
        : null;
    const governanceLabel = family === "governance_lock" ? "veAERO lock" : null;
    const label = buildProtocolLabel({
      family,
      protocol,
      primaryTokenSymbol,
      secondaryTokenSymbol,
      strategyLabel,
      governanceLabel,
    });
    const positionKey = buildProtocolPositionKey({
      chainId: input.chainId,
      protocol,
      family,
      walletAddress: input.walletAddress,
      positionContractAddress,
      wrapperAddress,
      tokenId,
      fallbackReference: asString(item.hash) ?? asString(item.transaction_hash),
    });

    const nextRow: OverviewProtocolPosition & { sortTimestamp: string | null } = {
      positionKey,
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      family,
      protocol,
      label,
      status: family === "governance_lock" ? "locked" : family === "staked_lp" ? "staked" : "active",
      coverageStatus: baseReasonCodes.includes("positionMetadataIncomplete") ? "unknown" : "partial",
      coverageReasonCodes,
      valueUsd: null,
      valueStatus: "unavailable",
      valueUpdatedAt: null,
      primaryTokenSymbol,
      secondaryTokenSymbol,
      primaryTokenAmount: null,
      secondaryTokenAmount: null,
      poolLabel:
        primaryTokenSymbol && secondaryTokenSymbol
          ? `${primaryTokenSymbol} / ${secondaryTokenSymbol}`
          : null,
      strategyLabel,
      governanceLabel,
      tokenId,
      metadata: {
        protocolSurface: buildProtocolSurface(protocol, family),
        wrapperAddress,
        positionContractAddress,
        lockEndAt: null,
        feeTierLabel: null,
      },
      sortTimestamp: timestamp,
    };

    const existingRow = reconstructedRows.get(positionKey);
    if (!existingRow) {
      reconstructedRows.set(positionKey, nextRow);
      continue;
    }

    if ((nextRow.sortTimestamp ?? "") > (existingRow.sortTimestamp ?? "")) {
      reconstructedRows.set(positionKey, nextRow);
    }
  }

  return {
    rows: Array.from(reconstructedRows.values())
      .sort((left, right) => (right.sortTimestamp ?? "").localeCompare(left.sortTimestamp ?? ""))
      .map((row) => {
        const { sortTimestamp, ...sanitizedRow } = row;
        void sortTimestamp;
        return sanitizedRow;
      }),
    usedRecentReconstruction: reconstructedRows.size > 0,
  };
}