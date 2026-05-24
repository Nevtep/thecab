import {
  asString,
  buildMetadataReasonCodes,
  buildProtocolLabel,
  buildProtocolMetadataIndex,
  buildProtocolPositionKey,
  buildProtocolSurface,
  collectAddressSignals,
  collectStringSignals,
  detectFamilyFromSignals,
  detectProtocolFromSignals,
  extractLockEndAt,
  extractTimestamp,
  extractTokenId,
  extractTokenSymbols,
  extractUsdValue,
  mergeProtocolCoverageReasonCodes,
  normalizeAddress,
  type KnownProtocolContract,
} from "@/server/protocol-positions/protocolMetadata";
import {
  reconstructRecentPositionState,
} from "@/server/protocol-positions/reconstructRecentPositionState";
import { readAerodromeManualPositions } from "@/server/protocol-positions/readAerodromeManualPositions";
import { readMellowStrategyPositions } from "@/server/protocol-positions/readMellowStrategyPositions";
import type {
  OverviewProtocolPosition,
  OverviewProtocolPositionsBlock,
  ProtocolPositionCoverageReasonCode,
  ProtocolPositionCoverageStatus,
  ProtocolPositionValueStatus,
} from "@/server/protocol-positions/protocolPositions.types";

type MoralisDefiPositionRecord = Record<string, unknown>;
type MoralisHistoryRecord = Record<string, unknown>;

export type DetectProtocolPositionsResult = {
  block: OverviewProtocolPositionsBlock;
  usedRecentReconstruction: boolean;
  providerPartial: boolean;
  evidenceSummary: {
    currentHintCount: number;
    reconstructedCount: number;
    valuedCount: number;
  };
  artifacts: {
    manualCurrentState: Awaited<ReturnType<typeof readAerodromeManualPositions>>["artifacts"];
    mellowCurrentState: Awaited<ReturnType<typeof readMellowStrategyPositions>>["artifacts"];
  };
};

function resolveRowCoverageStatus(input: {
  family: OverviewProtocolPosition["family"];
  valueUsd: number | null;
  reasonCodes: ProtocolPositionCoverageReasonCode[];
}): ProtocolPositionCoverageStatus {
  if (input.family === "strategy_exposure") {
    return "share_level";
  }

  if (input.reasonCodes.includes("positionMetadataIncomplete")) {
    return "unknown";
  }

  if (input.valueUsd === null || input.reasonCodes.length > 0) {
    return "partial";
  }

  return "full";
}

function resolveValueStatus(input: {
  family: OverviewProtocolPosition["family"];
  valueUsd: number | null;
}): ProtocolPositionValueStatus {
  if (input.valueUsd === null) {
    return "unavailable";
  }

  if (input.family === "strategy_exposure") {
    return "estimated";
  }

  return "current";
}

function createCurrentPositionRow(input: {
  walletAddress: string;
  chainId: number;
  position: MoralisDefiPositionRecord;
  protocolContracts: KnownProtocolContract[];
  source: "wallet_token" | "defi_position";
}): OverviewProtocolPosition | null {
  const metadata = buildProtocolMetadataIndex(input.chainId, input.protocolContracts);
  const signals = collectStringSignals(input.position);
  const addresses = collectAddressSignals(input.position);
  const protocol = detectProtocolFromSignals(metadata, signals, addresses);
  const tokenId = extractTokenId(input.position);
  const family = detectFamilyFromSignals(protocol, signals, { hasTokenId: Boolean(tokenId) });

  if (!protocol || !family) {
    return null;
  }

  const { primaryTokenSymbol, secondaryTokenSymbol } = extractTokenSymbols(input.position);
  const rawValueUsd = extractUsdValue(input.position);
  const valueUsd =
    input.source === "wallet_token" && family === "strategy_exposure" && rawValueUsd === 0
      ? null
      : rawValueUsd;
  const positionContractAddress =
    addresses.find((address) => metadata.byAddress.has(address)) ??
    normalizeAddress(asString(input.position.position_address)) ??
    normalizeAddress(asString(input.position.contract_address)) ??
    normalizeAddress(asString(input.position.pair_address)) ??
    addresses[0] ??
    null;
  const wrapperAddress =
    family === "strategy_exposure"
      ? normalizeAddress(asString(input.position.wrapper_address)) ?? positionContractAddress
      : null;
  const strategyLabel =
    family === "strategy_exposure"
      ? signals.find((signal) => /strategy|vault|mellow/i.test(signal)) ?? "Mellow strategy exposure"
      : null;
  const governanceLabel = family === "governance_lock" ? "veAERO lock" : null;
  const reasonCodes = buildMetadataReasonCodes({
    family,
    valueUsd,
    positionContractAddress,
    wrapperAddress,
    tokenId,
  });
  const coverageStatus = resolveRowCoverageStatus({ family, valueUsd, reasonCodes });
  const label = buildProtocolLabel({
    family,
    protocol,
    primaryTokenSymbol,
    secondaryTokenSymbol,
    strategyLabel,
    governanceLabel,
  });

  return {
    positionKey: buildProtocolPositionKey({
      chainId: input.chainId,
      protocol,
      family,
      walletAddress: input.walletAddress,
      positionContractAddress,
      wrapperAddress,
      tokenId,
      fallbackReference: addresses[0] ?? null,
    }),
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    family,
    protocol,
    label,
    status: family === "governance_lock" ? "locked" : family === "staked_lp" ? "staked" : "active",
    coverageStatus,
    coverageReasonCodes: reasonCodes,
    valueUsd,
    valueStatus: resolveValueStatus({ family, valueUsd }),
    valueUpdatedAt: extractTimestamp(input.position),
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
      lockEndAt: family === "governance_lock" ? extractLockEndAt(input.position) : null,
      feeTierLabel: null,
      rangeLowerTick: null,
      rangeUpperTick: null,
      currentTick: null,
      isInRange: null,
      rangeLowerPrice: null,
      rangeUpperPrice: null,
      rangeQuoteTokenSymbol: null,
      rangeDisplayFractionDigits: null,
    },
  };
}

function buildProtocolPositionsSummary(rows: OverviewProtocolPosition[], now: Date) {
  return {
    totalCount: rows.length,
    familyCounts: {
      manualDeposit: rows.filter((row) => row.family === "manual_deposit").length,
      strategyExposure: rows.filter((row) => row.family === "strategy_exposure").length,
      governanceLock: rows.filter((row) => row.family === "governance_lock").length,
      stakedLp: rows.filter((row) => row.family === "staked_lp").length,
    },
    hasPartialValuation: rows.some(
      (row) => row.valueStatus === "estimated" || row.valueStatus === "unavailable",
    ),
    hasShareLevelPositions: rows.some((row) => row.coverageStatus === "share_level"),
    lastRefreshedAt: rows.length > 0 ? now.toISOString() : null,
  };
}

function promoteReconstructedStakedRows(input: {
  reconstructedRows: OverviewProtocolPosition[];
  manualCurrentRows: OverviewProtocolPosition[];
}): OverviewProtocolPosition[] {
  const manualRowsByTokenId = new Map(
    input.manualCurrentRows
      .filter(
        (row) =>
          row.family === "manual_deposit" &&
          typeof row.tokenId === "string" &&
          row.tokenId.length > 0,
      )
      .map((row) => [row.tokenId as string, row] as const),
  );

  return input.reconstructedRows.flatMap((row) => {
    if (row.family !== "staked_lp" || typeof row.tokenId !== "string" || row.tokenId.length === 0) {
      return [];
    }

    const manualRow = manualRowsByTokenId.get(row.tokenId);
    if (!manualRow) {
      return [];
    }

    const primaryTokenSymbol = manualRow.primaryTokenSymbol ?? row.primaryTokenSymbol;
    const secondaryTokenSymbol = manualRow.secondaryTokenSymbol ?? row.secondaryTokenSymbol;
    const valueUsd = manualRow.valueUsd;
    const coverageReasonCodes = row.coverageReasonCodes;

    return [{
      ...row,
      label: buildProtocolLabel({
        family: "staked_lp",
        protocol: row.protocol,
        primaryTokenSymbol,
        secondaryTokenSymbol,
        strategyLabel: null,
        governanceLabel: null,
      }),
      coverageStatus: resolveRowCoverageStatus({
        family: "staked_lp",
        valueUsd,
        reasonCodes: coverageReasonCodes,
      }),
      valueUsd,
      valueStatus: resolveValueStatus({
        family: "staked_lp",
        valueUsd,
      }),
      valueUpdatedAt: manualRow.valueUpdatedAt,
      primaryTokenSymbol,
      secondaryTokenSymbol,
      primaryTokenAmount: manualRow.primaryTokenAmount,
      secondaryTokenAmount: manualRow.secondaryTokenAmount,
      poolLabel:
        primaryTokenSymbol && secondaryTokenSymbol
          ? `${primaryTokenSymbol} / ${secondaryTokenSymbol}`
          : null,
      metadata: {
        ...row.metadata,
        feeTierLabel: manualRow.metadata.feeTierLabel,
        rangeLowerTick: manualRow.metadata.rangeLowerTick,
        rangeUpperTick: manualRow.metadata.rangeUpperTick,
        currentTick: manualRow.metadata.currentTick,
        isInRange: manualRow.metadata.isInRange,
        rangeLowerPrice: manualRow.metadata.rangeLowerPrice,
        rangeUpperPrice: manualRow.metadata.rangeUpperPrice,
        rangeQuoteTokenSymbol: manualRow.metadata.rangeQuoteTokenSymbol,
        rangeDisplayFractionDigits: manualRow.metadata.rangeDisplayFractionDigits,
      },
    } satisfies OverviewProtocolPosition];
  });
}

export async function detectProtocolPositions(input: {
  walletAddress: string;
  chainId: number;
  protocolContracts: KnownProtocolContract[];
  walletTokens: MoralisDefiPositionRecord[];
  defiPositions: MoralisDefiPositionRecord[];
  history: MoralisHistoryRecord[];
  now?: Date;
}): Promise<DetectProtocolPositionsResult> {
  const now = input.now ?? new Date();
  const reconstructed = reconstructRecentPositionState({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    history: input.history,
    protocolMetadata: buildProtocolMetadataIndex(input.chainId, input.protocolContracts),
    now,
  });
  const manualTokenIds = Array.from(
    new Set(
      reconstructed.rows
        .filter(
          (row) =>
            row.protocol === "aerodrome" &&
            row.family === "manual_deposit" &&
            typeof row.tokenId === "string" &&
            row.tokenId.length > 0,
        )
        .map((row) => row.tokenId as string),
    ),
  );
  const manualCurrentState = await readAerodromeManualPositions({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    tokenIds: manualTokenIds,
    now,
  });
  const mellowCurrentState = await readMellowStrategyPositions({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    walletTokens: input.walletTokens,
    now,
  });
  const currentRows = input.defiPositions
    .map((position) =>
      createCurrentPositionRow({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        position,
        protocolContracts: input.protocolContracts,
        source: "defi_position",
      }),
    )
    .filter((row): row is OverviewProtocolPosition => Boolean(row));
  const rpcBackedRows = manualCurrentState.rows;
  const failedManualTokenIds = new Set(manualCurrentState.failedTokenIds);
  const promotedStakedRows = promoteReconstructedStakedRows({
    reconstructedRows: reconstructed.rows,
    manualCurrentRows: rpcBackedRows,
  });
  const filteredReconstructedRows = reconstructed.rows.filter((row) => {
    if (
      row.protocol === "aerodrome" &&
      (row.family === "manual_deposit" || row.family === "staked_lp") &&
      typeof row.tokenId === "string" &&
      row.tokenId.length > 0 &&
      failedManualTokenIds.has(row.tokenId)
    ) {
      return false;
    }

    return true;
  });

  const rowsByKey = new Map(
    [...rpcBackedRows, ...mellowCurrentState.rows, ...promotedStakedRows, ...currentRows]
      .map((row) => [row.positionKey, row] as const),
  );
  for (const row of filteredReconstructedRows) {
    if (!rowsByKey.has(row.positionKey)) {
      rowsByKey.set(row.positionKey, row);
    }
  }

  const stakedTokenIds = new Set(
    Array.from(rowsByKey.values())
      .filter(
        (row) =>
          row.protocol === "aerodrome" &&
          row.family === "staked_lp" &&
          typeof row.tokenId === "string" &&
          row.tokenId.length > 0,
      )
      .map((row) => row.tokenId as string),
  );
  const rows = Array.from(rowsByKey.values())
    .filter((row) => {
      if (
        row.protocol === "aerodrome" &&
        row.family === "manual_deposit" &&
        typeof row.tokenId === "string" &&
        stakedTokenIds.has(row.tokenId)
      ) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
    const leftValue = left.valueUsd ?? -1;
    const rightValue = right.valueUsd ?? -1;
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }

    return left.label.localeCompare(right.label);
    });

  const blockReasonCodes = mergeProtocolCoverageReasonCodes(
    rows.length > 0 ? ["protocolPositionsPresent"] : null,
    rows.some((row) => row.coverageReasonCodes.includes("recentProtocolReconstruction"))
      ? ["recentProtocolReconstruction"]
      : null,
    rows.some((row) => row.valueStatus !== "current") ? ["protocolValuationPartial"] : null,
    rows.some((row) => row.coverageStatus === "share_level") ? ["strategyShareLevelOnly"] : null,
    rows.some((row) => row.coverageReasonCodes.includes("governanceValueUnavailable"))
      ? ["governanceValueUnavailable"]
      : null,
    rows.some((row) => row.coverageReasonCodes.includes("positionMetadataIncomplete"))
      ? ["positionMetadataIncomplete"]
      : null,
  );
  const blockCoverageStatus: OverviewProtocolPositionsBlock["coverageStatus"] =
    rows.length === 0
      ? "unknown"
      : rows.every((row) => row.coverageStatus === "full")
        ? "full"
        : "partial";

  return {
    block: {
      source:
        rpcBackedRows.length > 0 || mellowCurrentState.rows.length > 0 || currentRows.length > 0
          ? "recent_provider_data"
          : filteredReconstructedRows.length > 0
            ? "partial_fallback"
            : "partial_fallback",
      coverageStatus: blockCoverageStatus,
      coverageReasonCodes: blockReasonCodes.length > 0 ? blockReasonCodes : null,
      rows,
      summary: buildProtocolPositionsSummary(rows, now),
    },
    usedRecentReconstruction: reconstructed.usedRecentReconstruction,
    providerPartial: manualCurrentState.providerPartial || mellowCurrentState.providerPartial,
    evidenceSummary: {
      currentHintCount:
        currentRows.length + mellowCurrentState.rows.length + rpcBackedRows.length + promotedStakedRows.length,
      reconstructedCount: filteredReconstructedRows.length,
      valuedCount: rows.filter((row) => row.valueUsd !== null).length,
    },
    artifacts: {
      manualCurrentState: manualCurrentState.artifacts,
      mellowCurrentState: mellowCurrentState.artifacts,
    },
  };
}