import {
  buildProtocolMetadataIndex,
  collectAddressSignals,
  collectStringSignals,
  detectProtocolFromSignals,
  type KnownProtocolContract,
} from "@/server/protocol-positions/protocolMetadata";
import { isHistoryRecordEconomicallyExcluded, type SurfaceKind } from "@/server/analysis/txClassification";
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
  const reconstructedRows = reconstructed.rows.filter((row) =>
    row.protocol === "mellow" && row.family === "strategy_exposure" && !currentKeys.has(row.positionKey)
  );

  const rewardCandidates = input.history.flatMap((record) => {
    // Spec: spam/airdrop records are excluded from the economic pipeline before
    // any reward candidate is generated. See
    // docs/spec/the-cab-aerodrome-claim-surfaces-research.md §4.
    if (isHistoryRecordEconomicallyExcluded(record)) {
      return [];
    }

    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    if (!txHash || !occurredAt) {
      return [];
    }

    const category = typeof record.category === "string" ? record.category : null;
    const methodLabel = typeof record.method_label === "string" ? record.method_label : null;
    const summary = typeof record.summary === "string" ? record.summary : null;
    const protocol = detectProtocolFromSignals(metadata, collectStringSignals(record), collectAddressSignals(record));
    const wrapperAddress = resolveMellowRewardWrapperAddress({
      record,
      currentWrappers,
    });

    if (!isMellowRewardRecord({
      detectedProtocol: protocol,
      category,
      methodLabel,
      summary,
      wrapperAddress,
    })) {
      return [];
    }

    return [{
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
    }];
  });

  return {
    rows: [...currentState.rows, ...reconstructedRows],
    rewardCandidates,
    providerPartial: currentState.providerPartial,
    artifacts: currentState.artifacts,
  };
}