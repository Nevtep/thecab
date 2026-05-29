import {
  buildProtocolMetadataIndex,
  collectAddressSignals,
  collectStringSignals,
  detectProtocolFromSignals,
  type KnownProtocolContract,
} from "@/server/protocol-positions/protocolMetadata";
import {
  decomposeTxEconomics,
  isHistoryRecordEconomicallyExcluded,
  type EconomicComponentKind,
  type SurfaceKind,
} from "@/server/analysis/txClassification";
import { readMellowStrategyPositions } from "@/server/protocol-positions/readMellowStrategyPositions";
import { reconstructRecentPositionState } from "@/server/protocol-positions/reconstructRecentPositionState";
import type { OverviewProtocolPosition } from "@/server/protocol-positions/protocolPositions.types";

type MoralisHistoryRecord = Record<string, unknown>;
type WalletTokenRecord = Record<string, unknown>;

export type ComputeMellowShareLevelAccountingResult = {
  rows: OverviewProtocolPosition[];
  rewardCandidates: Array<{
    txHash: string;
    occurredAt: Date;
    category: string | null;
    summary: string | null;
    protocol: "mellow";
    targetType: "strategy";
    targetWrapperAddress: string | null;
    componentKey?: string;
    economicComponentKind?: EconomicComponentKind;
    movementLogIndexes?: number[];
    /**
     * On-chain surface this candidate originated from. See
     * docs/spec/the-cab-aerodrome-claim-surfaces-research.md §3 + §6.
     */
    surfaceKind: SurfaceKind;
  }>;
  providerPartial: boolean;
  artifacts: Awaited<ReturnType<typeof readMellowStrategyPositions>>["artifacts"];
};

function asLowerString(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function resolveMellowRewardWrapperAddress(input: {
  record: MoralisHistoryRecord;
  currentWrappers: Set<string>;
}) {
  return collectAddressSignals(input.record).find((address) => input.currentWrappers.has(address)) ?? null;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

function collectHistoricalMellowWrappers(input: {
  history: MoralisHistoryRecord[];
  currentWrappers: Set<string>;
}) {
  const wrappers = new Set(input.currentWrappers);
  for (const record of input.history) {
    for (const transfer of asRecordArray(record.erc20_transfers)) {
      const symbol = asLowerString(transfer.token_symbol);
      const name = asLowerString(transfer.token_name);
      const tokenAddress = asLowerString(transfer.address);
      if (!tokenAddress) continue;
      if (symbol.startsWith("mvs:") || name.includes("mellowvelodromestrategy")) {
        wrappers.add(tokenAddress);
      }
    }

    const methodLabel = asLowerString(record.method_label);
    if (methodLabel.includes("getreward")) {
      for (const transfer of asRecordArray(record.erc20_transfers)) {
        const fromAddress = asLowerString(transfer.from_address);
        if (fromAddress && asLowerString(transfer.direction) === "receive") {
          wrappers.add(fromAddress);
        }
      }
    }
  }
  return wrappers;
}

export function isMellowRewardRecord(input: {
  detectedProtocol: string | null;
  category: string | null;
  methodLabel: string | null;
  summary: string | null;
  wrapperAddress: string | null;
}) {
  const category = asLowerString(input.category);
  const methodLabel = asLowerString(input.methodLabel);
  const summary = asLowerString(input.summary);
  const text = [category, methodLabel, summary].filter(Boolean).join(" ");
  const hasExplicitRewardLanguage =
    text.includes("reward") || text.includes("claim") || text.includes("collect");
  const isWrapperGetRewardsReceive =
    Boolean(input.wrapperAddress)
    && category === "token receive"
    && methodLabel.includes("getreward");

  if (isWrapperGetRewardsReceive) {
    return true;
  }

  return input.detectedProtocol === "mellow" && hasExplicitRewardLanguage;
}

function parseTimestamp(record: MoralisHistoryRecord) {
  const value = typeof record.block_timestamp === "string"
    ? record.block_timestamp
    : typeof record.block_time === "string"
      ? record.block_time
      : typeof record.created_at === "string"
        ? record.created_at
        : null;
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractTxHash(record: MoralisHistoryRecord) {
  return (typeof record.transaction_hash === "string" ? record.transaction_hash : typeof record.hash === "string" ? record.hash : null)
    ?.toLowerCase() ?? null;
}

export async function computeMellowShareLevelAccounting(input: {
  walletAddress: string;
  chainId: number;
  walletTokens: WalletTokenRecord[];
  history: MoralisHistoryRecord[];
  protocolContracts: KnownProtocolContract[];
  now?: Date;
}): Promise<ComputeMellowShareLevelAccountingResult> {
  const now = input.now ?? new Date();
  const metadata = buildProtocolMetadataIndex(input.chainId, input.protocolContracts);
  const [currentState, reconstructed] = await Promise.all([
    readMellowStrategyPositions({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      walletTokens: input.walletTokens,
      now,
    }),
    Promise.resolve(
      reconstructRecentPositionState({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        history: input.history,
        protocolMetadata: metadata,
        now,
      }),
    ),
  ]);

  const currentKeys = new Set(currentState.rows.map((row) => row.positionKey));
  const currentWrappers = new Set(
    currentState.rows
      .map((row) => row.metadata.wrapperAddress?.toLowerCase() ?? null)
      .filter((value): value is string => Boolean(value)),
  );
  const historicalWrappers = collectHistoricalMellowWrappers({
    history: input.history,
    currentWrappers,
  });
  const reconstructedRows = reconstructed.rows.filter((row) =>
    row.protocol === "mellow" && row.family === "strategy_exposure" && !currentKeys.has(row.positionKey)
  );

  const rewardCandidates: ComputeMellowShareLevelAccountingResult["rewardCandidates"] = [];
  for (const record of input.history) {
    // Spec: spam/airdrop records are excluded from the economic pipeline before
    // any reward candidate is generated. See
    // docs/spec/the-cab-aerodrome-claim-surfaces-research.md §4.
    if (isHistoryRecordEconomicallyExcluded(record)) {
      continue;
    }

    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    if (!txHash || !occurredAt) {
      continue;
    }

    const category = typeof record.category === "string" ? record.category : null;
    const methodLabel = typeof record.method_label === "string" ? record.method_label : null;
    const summary = typeof record.summary === "string" ? record.summary : null;
    const protocol = detectProtocolFromSignals(metadata, collectStringSignals(record), collectAddressSignals(record));
    const wrapperAddress = resolveMellowRewardWrapperAddress({
      record,
      currentWrappers: historicalWrappers,
    });
    const methodLabelLower = asLowerString(methodLabel);

    if (wrapperAddress && methodLabelLower === "withdraw") {
      const components = decomposeTxEconomics({
        txHash,
        record,
        surfaceKind: "strategy_wrapper_withdraw",
        wrapperAddress,
      });
      rewardCandidates.push(...components
        .filter((component) => component.kind === "reward_claim")
        .map((component) => ({
          txHash,
          occurredAt,
          category,
          summary,
          protocol: "mellow" as const,
          targetType: "strategy" as const,
          targetWrapperAddress: wrapperAddress,
          surfaceKind: "strategy_wrapper_withdraw" as SurfaceKind,
          componentKey: component.componentKey,
          economicComponentKind: component.kind,
          movementLogIndexes: component.movementLogIndexes,
        })));
      continue;
    }

    if (!isMellowRewardRecord({
      detectedProtocol: protocol,
      category,
      methodLabel,
      summary,
      wrapperAddress,
    })) {
      continue;
    }

    rewardCandidates.push({
      txHash,
      occurredAt,
      category,
      summary,
      protocol: "mellow" as const,
      targetType: "strategy" as const,
      targetWrapperAddress: wrapperAddress,
      // Spec: Mellow wrapper reward inflows are always strategy-owned. See
      // docs/spec/the-cab-aerodrome-claim-surfaces-research.md §3.
      surfaceKind: "strategy_wrapper_reward_claim" as SurfaceKind,
      componentKey: `${txHash}:reward_claim`,
      economicComponentKind: "reward_claim" as const,
      movementLogIndexes: [],
    });
  }

  return {
    rows: [...currentState.rows, ...reconstructedRows],
    rewardCandidates,
    providerPartial: currentState.providerPartial,
    artifacts: currentState.artifacts,
  };
}
