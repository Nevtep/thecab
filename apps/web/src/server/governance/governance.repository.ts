import { and, desc, eq } from "drizzle-orm";

import { readAnalysisStatusContext } from "@/server/analysis/analysis-run.repository";
import { getDb } from "@/server/db/client";
import {
  governanceEpochSummaries,
  governanceEvents,
  governanceLockExposures,
  governanceMetricSnapshots,
  governanceRewardRows,
} from "@/server/db/schema";
import type {
  GovernanceConfidence,
  GovernanceCoverageState,
  GovernanceEpochSummary,
  GovernanceEventType,
  GovernanceLockLifecycleItem,
  GovernanceLockPanel,
  GovernanceProtocolSurface,
  GovernanceRequest,
  GovernanceRewardRow,
  GovernanceRewardType,
  GovernanceSelectedDetail,
} from "@/server/governance/governance.types";

export type GovernanceRepositoryEventRow = {
  governanceEventId: string;
  txHash: string;
  logIndex: number;
  eventType: GovernanceEventType;
  occurredAt: string;
  protocolSurface: GovernanceProtocolSurface | "unknown";
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
  reasonCodes: string[];
  evidenceRefs: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
};

export type GovernanceRepositoryResult = {
  allRewardRows: GovernanceRewardRow[];
  rewardRows: GovernanceRewardRow[];
  totalRewardRows: number;
  lockPanel: GovernanceLockPanel | null;
  epochs: GovernanceEpochSummary[];
  events: GovernanceRepositoryEventRow[];
  metricSnapshot: {
    summary: Record<string, unknown>;
    selectedDetail: GovernanceSelectedDetail | null;
    coverageState: GovernanceCoverageState;
    confidence: GovernanceConfidence;
  } | null;
  availableFilters: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

const COVERAGE_VALUES = new Set(["full", "partial", "unresolved", "unsupported", "excluded", "unavailable"]);
const CONFIDENCE_VALUES = new Set(["high", "medium", "low", "none"]);
const EVENT_TYPES = new Set([
  "lock_created",
  "lock_increased",
  "lock_extended",
  "lock_relocked",
  "lock_withdrawn",
  "vote_cast",
  "vote_reset",
  "relay_joined",
  "relay_exited",
  "fee_claim",
  "bribe_claim",
  "rebase_claim",
  "governance_reward",
  "unsupported_governance",
  "excluded_governance",
]);
const REWARD_TYPES = new Set(["fee", "bribe", "rebase", "relay", "unknown"]);
const PROTOCOL_SURFACES = new Set([
  "voting_escrow",
  "voter",
  "relay",
  "briber",
  "fee_distributor",
  "reward_distributor",
  "unknown",
]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeCoverage(value: string | null | undefined): GovernanceCoverageState {
  return COVERAGE_VALUES.has(value ?? "") ? value as GovernanceCoverageState : "unavailable";
}

function normalizeConfidence(value: string | null | undefined): GovernanceConfidence {
  if (value === "unknown") return "low";
  return CONFIDENCE_VALUES.has(value ?? "") ? value as GovernanceConfidence : "none";
}

function normalizeEventType(value: string): GovernanceEventType {
  return EVENT_TYPES.has(value) ? value as GovernanceEventType : "unsupported_governance";
}

function normalizeRewardType(value: string | null | undefined): GovernanceRewardType {
  return REWARD_TYPES.has(value ?? "") ? value as GovernanceRewardType : "unknown";
}

function normalizeProtocolSurface(value: string | null | undefined): GovernanceProtocolSurface | "unknown" {
  return PROTOCOL_SURFACES.has(value ?? "") ? value as GovernanceProtocolSurface : "unknown";
}

function shortId(value: string, prefix: string) {
  return `${prefix}-${value.slice(0, 4)}...${value.slice(-4)}`;
}

function includesSearch(haystack: string[], search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

function mapLifecycleItem(value: Record<string, unknown>): GovernanceLockLifecycleItem | null {
  const eventId = asString(value.eventId) ?? asString(value.id);
  const eventType = asString(value.eventType);
  const occurredAt = asString(value.occurredAt);
  if (!eventId || !eventType || !occurredAt) return null;

  return {
    eventId,
    eventType: normalizeEventType(eventType),
    occurredAt,
    amountDelta: asString(value.amountDelta) ?? asString(value.amountDeltaRaw),
    durationDeltaDays: typeof value.durationDeltaDays === "number" ? value.durationDeltaDays : null,
    coverageState: normalizeCoverage(asString(value.coverageState) ?? asString(value.coverageStatus)),
    confidence: normalizeConfidence(asString(value.confidence)),
  };
}

function mapLockPanel(row: typeof governanceLockExposures.$inferSelect): GovernanceLockPanel {
  return {
    lockExposureId: row.id,
    lockId: row.lockId,
    status:
      row.status === "active" || row.status === "expired" || row.status === "withdrawn" || row.status === "partial"
        ? row.status
        : "unknown",
    createdAt: toIso(row.createdAtUtc),
    expiresAt: toIso(row.expiresAtUtc),
    lockedAeroAmount: row.lockedAeroAmount,
    lockedAeroValueUsd: row.lockedAeroValueUsd,
    veAeroExposure: row.veAeroExposure,
    coverageState: normalizeCoverage(row.coverageStatus),
    confidence: normalizeConfidence(row.confidence),
    reasonCodes: row.reasonCodes ?? [],
    lifecycle: asObjectArray(row.lifecycleJson)
      .map(mapLifecycleItem)
      .filter((item): item is GovernanceLockLifecycleItem => Boolean(item)),
  };
}

function mapEpoch(row: typeof governanceEpochSummaries.$inferSelect): GovernanceEpochSummary {
  return {
    epochId: row.epochId,
    epochLabel: `Epoch ${row.epochId}`,
    epochStartAt: toIso(row.epochStartUtc),
    epochEndAt: toIso(row.epochEndUtc),
    votedPools: asObjectArray(row.votedPoolsJson).map((pool) => {
      const poolId = asString(pool.poolId) ?? asString(pool.id) ?? "unknown";
      return {
        poolId,
        label: asString(pool.label) ?? shortId(poolId, "Pool"),
        weightPercent: asString(pool.weightPercent) ?? asString(pool.weight),
      };
    }),
    voteMode: row.voteMode === "manual" || row.voteMode === "relay" || row.voteMode === "mixed" ? row.voteMode : "unknown",
    resetState: row.resetState === "not_reset" || row.resetState === "reset" ? row.resetState : "unknown",
    rewardState:
      row.rewardState === "claimed" ||
      row.rewardState === "pending" ||
      row.rewardState === "none" ||
      row.rewardState === "partial"
        ? row.rewardState
        : "unknown",
    feesUsd: row.feesUsd,
    bribesUsd: row.bribesUsd,
    rebasesUsd: row.rebasesUsd,
    coverageState: normalizeCoverage(row.coverageStatus),
    confidence: normalizeConfidence(row.confidence),
  };
}

function mapReward(row: typeof governanceRewardRows.$inferSelect): GovernanceRewardRow {
  const context = asRecord(row.contextJson);
  const poolLabel = asString(context.poolLabel);
  return {
    governanceRewardId: row.id,
    rewardEventId: row.rewardEventId,
    claimedAt: toIso(row.claimedAt),
    rewardType: normalizeRewardType(row.rewardType),
    token: {
      address: row.tokenAddress,
      symbol: row.tokenSymbol ?? (row.tokenAddress ? shortId(row.tokenAddress, "Token") : "n/a"),
      iconUrl: asString(context.tokenIconUrl),
    },
    amount: row.amountDecimal ?? row.amountRaw,
    valueUsdAtClaim: row.valueUsdAtClaim,
    epochId: row.epochId,
    pool: row.poolId
      ? {
          poolId: row.poolId,
          label: poolLabel ?? shortId(row.poolId, "Pool"),
        }
      : null,
    coverageState: normalizeCoverage(row.coverageStatus),
    confidence: normalizeConfidence(row.confidence),
    context: {
      kind: row.epochId ? "epoch" : row.poolId ? "pool" : "reward",
      label: row.epochId ? `Epoch ${row.epochId}` : poolLabel ?? asString(context.label) ?? "Governance reward",
    },
  };
}

function mapEvent(row: typeof governanceEvents.$inferSelect): GovernanceRepositoryEventRow {
  const metadata = asRecord(row.metadataJson);
  const classification = asRecord(metadata.governanceClassification);
  const coverageState = normalizeCoverage(asString(metadata.coverageState) ?? asString(metadata.coverageStatus));
  return {
    governanceEventId: row.id,
    txHash: row.txHash,
    logIndex: row.logIndex,
    eventType: normalizeEventType(row.eventType),
    occurredAt: toIso(row.occurredAt) ?? new Date(0).toISOString(),
    protocolSurface: normalizeProtocolSurface(asString(classification.protocolSurface) ?? asString(metadata.protocolSurface)),
    coverageState,
    confidence: normalizeConfidence(asString(metadata.confidence)),
    reasonCodes: asStringArray(metadata.reasonCodes ?? metadata.coverageReasonCodes),
    evidenceRefs: asObjectArray(metadata.evidenceRefs),
    metadata,
  };
}

function sortRewards(rows: GovernanceRewardRow[], input: GovernanceRequest) {
  const direction = input.sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    switch (input.sort.key) {
      case "epoch":
        return direction * ((left.epochId ?? "").localeCompare(right.epochId ?? ""));
      case "valueUsdAtClaim":
        return direction * ((Number(left.valueUsdAtClaim ?? 0)) - (Number(right.valueUsdAtClaim ?? 0)));
      case "rewardType":
        return direction * left.rewardType.localeCompare(right.rewardType);
      case "coverage":
        return direction * left.coverageState.localeCompare(right.coverageState);
      case "confidence":
        return direction * left.confidence.localeCompare(right.confidence);
      case "occurredAt":
      default:
        return direction * ((left.claimedAt ?? "").localeCompare(right.claimedAt ?? ""));
    }
  });
}

function filterRewards(rows: GovernanceRewardRow[], input: GovernanceRequest) {
  return rows.filter((row) => {
    if (input.rewardType !== "all" && row.rewardType !== input.rewardType) return false;
    if (input.epochId && row.epochId !== input.epochId) return false;
    if (input.poolId && row.pool?.poolId !== input.poolId) return false;
    if (input.tokenAddress && row.token.address?.toLowerCase() !== input.tokenAddress.toLowerCase()) return false;
    if (input.coverage && row.coverageState !== input.coverage) return false;
    if (input.confidence && row.confidence !== input.confidence) return false;
    return includesSearch([
      row.rewardType,
      row.token.symbol,
      row.token.address ?? "",
      row.epochId ?? "",
      row.pool?.label ?? "",
      row.context.label,
    ], input.search);
  });
}

function filterEvents(rows: GovernanceRepositoryEventRow[], input: GovernanceRequest) {
  return rows.filter((row) => {
    if (input.eventType !== "all" && row.eventType !== input.eventType) return false;
    if (input.protocolSurface !== "all" && row.protocolSurface !== input.protocolSurface) return false;
    if (input.coverage && row.coverageState !== input.coverage) return false;
    if (input.confidence && row.confidence !== input.confidence) return false;
    return includesSearch([row.txHash, row.eventType, row.protocolSurface, ...row.reasonCodes], input.search);
  });
}

function buildAvailableFilters(input: {
  rewardRows: GovernanceRewardRow[];
  epochs: GovernanceEpochSummary[];
  events: GovernanceRepositoryEventRow[];
}) {
  return {
    rewardTypes: Array.from(new Set(input.rewardRows.map((row) => row.rewardType))).sort(),
    tokens: Array.from(new Map(input.rewardRows.map((row) => [row.token.address ?? row.token.symbol, row.token])).values()),
    epochs: input.epochs.map((epoch) => ({ epochId: epoch.epochId, label: epoch.epochLabel })),
    protocolSurfaces: Array.from(new Set(input.events.map((event) => event.protocolSurface))).sort(),
  };
}

export async function readGovernanceAnalysisContext(input: GovernanceRequest) {
  return readAnalysisStatusContext(input);
}

export async function findGovernanceDataView(input: GovernanceRequest): Promise<GovernanceRepositoryResult> {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();

  const [lockRows, epochRows, rewardRows, eventRows, metricRows] = await Promise.all([
    db
      .select()
      .from(governanceLockExposures)
      .where(and(eq(governanceLockExposures.chainId, input.chainId), eq(governanceLockExposures.walletAddress, walletAddress)))
      .orderBy(desc(governanceLockExposures.materializedAt))
      .limit(1),
    db
      .select()
      .from(governanceEpochSummaries)
      .where(and(eq(governanceEpochSummaries.chainId, input.chainId), eq(governanceEpochSummaries.walletAddress, walletAddress)))
      .orderBy(desc(governanceEpochSummaries.epochStartUtc), desc(governanceEpochSummaries.materializedAt))
      .limit(12),
    db
      .select()
      .from(governanceRewardRows)
      .where(and(eq(governanceRewardRows.chainId, input.chainId), eq(governanceRewardRows.walletAddress, walletAddress)))
      .orderBy(desc(governanceRewardRows.claimedAt), desc(governanceRewardRows.materializedAt)),
    db
      .select()
      .from(governanceEvents)
      .where(and(eq(governanceEvents.chainId, input.chainId), eq(governanceEvents.walletAddress, walletAddress)))
      .orderBy(desc(governanceEvents.occurredAt))
      .limit(100),
    db
      .select()
      .from(governanceMetricSnapshots)
      .where(and(eq(governanceMetricSnapshots.chainId, input.chainId), eq(governanceMetricSnapshots.walletAddress, walletAddress)))
      .orderBy(desc(governanceMetricSnapshots.materializedAt))
      .limit(1),
  ]);

  const lockPanel = lockRows[0] ? mapLockPanel(lockRows[0]) : null;
  const epochs = epochRows.map(mapEpoch);
  const allRewardRows = rewardRows.map(mapReward);
  const events = filterEvents(eventRows.map(mapEvent), input);
  const filteredRewards = sortRewards(filterRewards(allRewardRows, input), input);
  const totalRewardRows = filteredRewards.length;
  const startIndex = (input.page - 1) * input.pageSize;
  const pagedRewards = filteredRewards.slice(startIndex, startIndex + input.pageSize);
  const metricRow = metricRows[0] ?? null;

  return {
    allRewardRows,
    rewardRows: pagedRewards,
    totalRewardRows,
    lockPanel,
    epochs,
    events,
    metricSnapshot: metricRow
      ? {
          summary: asRecord(metricRow.summaryJson),
          selectedDetail: asRecord(metricRow.selectedDetailJson).selectionKind ? metricRow.selectedDetailJson as GovernanceSelectedDetail : null,
          coverageState: normalizeCoverage(metricRow.coverageStatus),
          confidence: normalizeConfidence(metricRow.confidence),
        }
      : null,
    availableFilters: buildAvailableFilters({ rewardRows: allRewardRows, epochs, events }),
  };
}
