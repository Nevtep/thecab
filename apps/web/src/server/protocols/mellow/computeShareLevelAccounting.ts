import {
  buildProtocolMetadataIndex,
  collectAddressSignals,
  collectStringSignals,
  detectProtocolFromSignals,
  type KnownProtocolContract,
} from "@/server/protocol-positions/protocolMetadata";
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
  }>;
  providerPartial: boolean;
  artifacts: Awaited<ReturnType<typeof readMellowStrategyPositions>>["artifacts"];
};

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
    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    if (!txHash || !occurredAt) {
      return [];
    }

    const protocol = detectProtocolFromSignals(metadata, collectStringSignals(record), collectAddressSignals(record));
    const text = [record.category, record.method_label, record.summary]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    if (protocol !== "mellow" || (!text.includes("reward") && !text.includes("claim") && !text.includes("collect"))) {
      return [];
    }

    return [{
      txHash,
      occurredAt,
      category: typeof record.category === "string" ? record.category : null,
      summary: typeof record.summary === "string" ? record.summary : null,
      protocol: "mellow" as const,
      targetType: "strategy" as const,
      targetWrapperAddress: collectAddressSignals(record).find((address) => currentWrappers.has(address)) ?? null,
    }];
  });

  return {
    rows: [...currentState.rows, ...reconstructedRows],
    rewardCandidates,
    providerPartial: currentState.providerPartial,
    artifacts: currentState.artifacts,
  };
}