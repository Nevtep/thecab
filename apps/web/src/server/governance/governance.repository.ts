import { and, desc, eq } from "drizzle-orm";

import { readAnalysisStatusContext } from "@/server/analysis/analysis-run.repository";
import { engineV2ReadModelsEnabled, readEngineV2SurfaceRows } from "@/server/analysis/engine-v2/materializers";
import { getDb } from "@/server/db/client";
import {
  governanceEpochSummaries,
  governanceEvents,
  governanceLockExposures,
  governanceMetricSnapshots,
  governanceRewardRows,
} from "@/server/db/schema";
import {
  deriveGovernanceLockKind,
  governanceLockIdentity,
  normalizeGovernanceLockKind,
  selectPrimaryGovernanceLockId,
  sortGovernanceLockPanels,
} from "@/server/governance/governance-locks";
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
  lockPanels: GovernanceLockPanel[];
  primaryLockId: string | null;
  epochs: GovernanceEpochSummary[];
  events: GovernanceRepositoryEventRow[];
  selectedDetailTarget: GovernanceSelectedDetailTarget | null;
  metricSnapshot: {
    summary: Record<string, unknown>;
    selectedDetail: GovernanceSelectedDetail | null;
    coverageState: GovernanceCoverageState;
    confidence: GovernanceConfidence;
  } | null;
  availableFilters: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;
export type GovernanceSelectedDetailTarget =
  | { kind: "lock"; lock: GovernanceLockPanel }
  | { kind: "reward"; reward: GovernanceRewardRow }
  | { kind: "event"; event: GovernanceRepositoryEventRow }
  | { kind: "epoch"; epoch: GovernanceEpochSummary };

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

function datePresetStart(input: GovernanceRequest) {
  const daysByPreset: Partial<Record<GovernanceRequest["datePreset"], number>> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  const days = daysByPreset[input.datePreset];
  if (!days) return null;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function isInsideDatePreset(value: string | null, input: GovernanceRequest) {
  const start = datePresetStart(input);
  if (start === null) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start;
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
  const metadata = asRecord(row.metadataJson);
  const managedTokenId = asString(metadata.managedTokenId);
  return {
    lockExposureId: row.id,
    lockId: row.lockId,
    lockKind: deriveGovernanceLockKind({
      status: row.status,
      originKind: asString(metadata.originKind),
      managedTokenId,
      provenance: asString(metadata.provenance),
      explicitKind: asString(metadata.lockKind),
    }),
    status:
      row.status === "active" || row.status === "expired" || row.status === "withdrawn" || row.status === "partial"
        ? row.status
        : "unknown",
    createdAt: toIso(row.createdAtUtc),
    expiresAt: toIso(row.expiresAtUtc),
    managedTokenId,
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
  const evidence = asRecord(row.evidenceJson);
  const contextPoolAssociation = asRecord(context.poolAssociation);
  const evidencePoolAssociation = asRecord(evidence.poolAssociation);
  const poolLabel = asString(context.poolLabel);
  const poolAssociationReasonCodes = asStringArray(
    contextPoolAssociation.reasonCodes ?? evidencePoolAssociation.reasonCodes,
  );
  return {
    governanceRewardId: row.id,
    rewardEventId: row.rewardEventId,
    governanceEventId: row.governanceEventId,
    txHash: row.txHash,
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
    affectsTotals: row.affectsTotals,
    poolAssociation: {
      status: row.poolId ? "explicit" : "unassociated",
      rule: asString(contextPoolAssociation.rule) ?? asString(evidencePoolAssociation.rule) ?? "explicit_pool_evidence_required",
      reasonCodes: poolAssociationReasonCodes,
    },
    doubleCountingNoteKey: asString(context.doubleCountingNoteKey),
    context: {
      kind: row.epochId ? "epoch" : row.poolId ? "pool" : "reward",
      label: row.epochId ? `Epoch ${row.epochId}` : poolLabel ?? asString(context.label) ?? "Governance reward",
    },
    sourceEvidenceRefs: [
      ...asObjectArray(evidence.sourceEvidenceRefs),
      ...asObjectArray(evidence.evidenceRefs),
    ],
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

function normalizeEngineV2GovernanceEvent(row: Record<string, unknown>): GovernanceRepositoryEventRow | null {
  const nested = asRecord(row.event);
  const source = Object.keys(nested).length > 0 ? nested : row;
  const txHash = asString(source.txHash);
  const eventId = asString(source.governanceEventId) ?? asString(source.eventId) ?? txHash;
  if (!eventId || !txHash) return null;
  const eventType = asString(source.eventType) ?? "unsupported_governance";
  const metadata = {
    ...asRecord(source.metadata),
    tokenId: asString(source.tokenId),
    reasonCodes: asStringArray(source.reasonCodes),
  };
  return {
    governanceEventId: eventId,
    txHash,
    logIndex: typeof source.logIndex === "number" ? source.logIndex : 0,
    eventType: normalizeEventType(eventType),
    occurredAt: asString(source.occurredAt) ?? new Date(0).toISOString(),
    protocolSurface: normalizeProtocolSurface(asString(source.protocolSurface) ?? (
      eventType.includes("vote") || eventType.includes("poke") || eventType.includes("deposit_managed") ? "voter" :
      eventType.includes("lock") ? "voting_escrow" :
      eventType.includes("bribe") ? "briber" :
      eventType.includes("fee") ? "fee_distributor" :
      eventType.includes("rebase") ? "reward_distributor" :
      "unknown"
    )),
    coverageState: normalizeCoverage(asString(source.coverageState) ?? asString(source.coverageStatus)),
    confidence: normalizeConfidence(asString(source.confidence)),
    reasonCodes: asStringArray(source.reasonCodes),
    evidenceRefs: asObjectArray(source.evidenceRefs),
    metadata,
  };
}

function normalizeEngineV2LockPanel(row: Record<string, unknown>): GovernanceLockPanel | null {
  const nested = asRecord(row.lockPanel);
  const source = Object.keys(nested).length > 0 ? nested : asString(row.kind) === "lock" ? row : null;
  if (!source) return null;
  const lockId = asString(source.lockId) ?? asString(source.tokenId) ?? asString(row.tokenId) ?? asString(row.lockId);
  const managedTokenId = asString(source.managedTokenId) ?? asString(row.managedTokenId);
  return {
    lockExposureId: asString(source.lockExposureId) ?? asString(source.lockKey) ?? asString(row.lockKey),
    lockId,
    lockKind: deriveGovernanceLockKind({
      status: asString(source.status) ?? asString(row.status),
      originKind: asString(source.originKind) ?? asString(row.originKind),
      managedTokenId,
      provenance: asString(source.provenance) ?? asString(row.provenance),
      explicitKind: normalizeGovernanceLockKind(asString(source.lockKind) ?? asString(row.lockKind)),
    }),
    status:
      asString(source.status) === "active" ||
      asString(source.status) === "expired" ||
      asString(source.status) === "withdrawn" ||
      asString(source.status) === "partial"
        ? asString(source.status) as GovernanceLockPanel["status"]
        : asString(source.status) === "deposited_managed"
          ? "partial"
          : "unknown",
    createdAt: asString(source.createdAt),
    expiresAt: asString(source.expiresAt),
    managedTokenId,
    lockedAeroAmount: asString(source.lockedAeroAmount),
    lockedAeroValueUsd: asString(source.lockedAeroValueUsd),
    veAeroExposure: asString(source.veAeroExposure),
    coverageState: normalizeCoverage(asString(source.coverageState) ?? asString(source.coverageStatus) ?? asString(row.coverageStatus)),
    confidence: normalizeConfidence(asString(source.confidence) ?? asString(row.confidence)),
    reasonCodes: asStringArray(source.reasonCodes ?? row.reasonCodes),
    lifecycle: asObjectArray(source.lifecycle)
      .map(mapLifecycleItem)
      .filter((item): item is GovernanceLockLifecycleItem => Boolean(item)),
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

export function filterGovernanceRewards(rows: GovernanceRewardRow[], input: GovernanceRequest) {
  return rows.filter((row) => {
    if (!isInsideDatePreset(row.claimedAt, input)) return false;
    if (input.eventType !== "all") {
      const rewardEventType =
        row.rewardType === "bribe" ? "bribe_claim" :
        row.rewardType === "fee" ? "fee_claim" :
        row.rewardType === "rebase" ? "rebase_claim" :
        "governance_reward";
      if (rewardEventType !== input.eventType) return false;
    }
    if (input.protocolSurface !== "all") {
      const rewardSurface =
        row.rewardType === "bribe" ? "briber" :
        row.rewardType === "fee" ? "fee_distributor" :
        "reward_distributor";
      if (rewardSurface !== input.protocolSurface) return false;
    }
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

export function filterGovernanceEvents(rows: GovernanceRepositoryEventRow[], input: GovernanceRequest) {
  return rows.filter((row) => {
    if (!isInsideDatePreset(row.occurredAt, input)) return false;
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
    eventTypes: Array.from(new Set(input.events.map((event) => event.eventType))).sort(),
    rewardTypes: Array.from(new Set(input.rewardRows.map((row) => row.rewardType))).sort(),
    tokens: Array.from(new Map(input.rewardRows.map((row) => [row.token.address ?? row.token.symbol, row.token])).values()),
    epochs: input.epochs.map((epoch) => ({ epochId: epoch.epochId, label: epoch.epochLabel })),
    protocolSurfaces: Array.from(new Set(input.events.map((event) => event.protocolSurface))).sort(),
    coverageStates: Array.from(new Set([
      ...input.rewardRows.map((row) => row.coverageState),
      ...input.events.map((event) => event.coverageState),
      ...input.epochs.map((epoch) => epoch.coverageState),
    ])).sort(),
    confidenceBands: Array.from(new Set([
      ...input.rewardRows.map((row) => row.confidence),
      ...input.events.map((event) => event.confidence),
      ...input.epochs.map((epoch) => epoch.confidence),
    ])).sort(),
  };
}

function resolveSelectedDetailTarget(input: {
  request: GovernanceRequest;
  visibleRewards: GovernanceRewardRow[];
  allRewards: GovernanceRewardRow[];
  visibleEvents: GovernanceRepositoryEventRow[];
  allEvents: GovernanceRepositoryEventRow[];
  epochs: GovernanceEpochSummary[];
  lockPanels: GovernanceLockPanel[];
}): GovernanceSelectedDetailTarget | null {
  const selectedId = input.request.selectedGovernanceId;
  if (selectedId) {
    if (input.request.selectedKind === "lock") {
      const lock = input.lockPanels.find((row) => governanceLockIdentity(row) === selectedId || row.lockId === selectedId);
      if (lock) return { kind: "lock", lock };
    }
    if (input.request.selectedKind === "reward") {
      const reward = input.allRewards.find((row) =>
        row.governanceRewardId === selectedId ||
        row.rewardEventId === selectedId ||
        row.governanceEventId === selectedId
      );
      if (reward) return { kind: "reward", reward };
    }
    if (input.request.selectedKind === "event") {
      const event = input.allEvents.find((row) => row.governanceEventId === selectedId || row.txHash === selectedId);
      if (event) return { kind: "event", event };
    }
    if (input.request.selectedKind === "epoch") {
      const epoch = input.epochs.find((row) => row.epochId === selectedId);
      if (epoch) return { kind: "epoch", epoch };
    }

    const reward = input.allRewards.find((row) =>
      row.governanceRewardId === selectedId ||
      row.rewardEventId === selectedId ||
      row.governanceEventId === selectedId
    );
    if (reward) return { kind: "reward", reward };
    const event = input.allEvents.find((row) => row.governanceEventId === selectedId || row.txHash === selectedId);
    if (event) return { kind: "event", event };
    const epoch = input.epochs.find((row) => row.epochId === selectedId);
    if (epoch) return { kind: "epoch", epoch };
    const lock = input.lockPanels.find((row) => governanceLockIdentity(row) === selectedId || row.lockId === selectedId);
    if (lock) return { kind: "lock", lock };
  }

  const primaryLock = input.lockPanels[0];
  if (primaryLock) return { kind: "lock", lock: primaryLock };
  const firstReward = input.visibleRewards[0];
  if (firstReward) return { kind: "reward", reward: firstReward };
  const firstEvent = input.visibleEvents[0];
  if (firstEvent) return { kind: "event", event: firstEvent };
  const firstEpoch = input.epochs[0];
  return firstEpoch ? { kind: "epoch", epoch: firstEpoch } : null;
}

export async function readGovernanceAnalysisContext(input: GovernanceRequest) {
  return readAnalysisStatusContext(input);
}

export async function findGovernanceDataView(input: GovernanceRequest): Promise<GovernanceRepositoryResult> {
  const engineV2Rows = await readEngineV2SurfaceRows<{
    kind: "lock" | "event" | "reward" | "epoch" | string;
    reward?: GovernanceRewardRow;
    event?: GovernanceRepositoryEventRow;
    epoch?: GovernanceEpochSummary;
    lockPanel?: GovernanceLockPanel;
    metricSnapshot?: GovernanceRepositoryResult["metricSnapshot"];
  }>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "governance",
  });
  if (engineV2Rows) {
    const rewardRows = engineV2Rows.map((row) => row.reward).filter((row): row is GovernanceRewardRow => Boolean(row));
    const eventRows = engineV2Rows
      .map((row) => normalizeEngineV2GovernanceEvent(row as Record<string, unknown>))
      .filter((row): row is GovernanceRepositoryEventRow => Boolean(row));
    const epochRows = engineV2Rows.map((row) => row.epoch).filter((row): row is GovernanceEpochSummary => Boolean(row));
    const lockPanels = sortGovernanceLockPanels(engineV2Rows
      .map((row) => normalizeEngineV2LockPanel(row as Record<string, unknown>))
      .filter((row): row is GovernanceLockPanel => Boolean(row)));
    const primaryLockId = selectPrimaryGovernanceLockId(lockPanels);
    const filteredRewards = sortRewards(filterGovernanceRewards(rewardRows, input), input);
    const events = filterGovernanceEvents(eventRows, input);
    const startIndex = (input.page - 1) * input.pageSize;
    return {
      allRewardRows: rewardRows,
      rewardRows: filteredRewards.slice(startIndex, startIndex + input.pageSize),
      totalRewardRows: filteredRewards.length,
      lockPanels,
      primaryLockId,
      epochs: epochRows,
      events,
      selectedDetailTarget: resolveSelectedDetailTarget({
        request: input,
        allRewards: rewardRows,
        visibleRewards: filteredRewards,
        allEvents: eventRows,
        visibleEvents: events,
        epochs: epochRows,
        lockPanels,
      }),
      metricSnapshot: engineV2Rows.find((row) => row.metricSnapshot)?.metricSnapshot ?? null,
      availableFilters: buildAvailableFilters({ rewardRows, epochs: epochRows, events: eventRows }),
    };
  }
  if (engineV2ReadModelsEnabled()) {
    return {
      allRewardRows: [],
      rewardRows: [],
      totalRewardRows: 0,
      lockPanels: [],
      primaryLockId: null,
      epochs: [],
      events: [],
      selectedDetailTarget: null,
      metricSnapshot: null,
      availableFilters: buildAvailableFilters({ rewardRows: [], epochs: [], events: [] }),
    };
  }

  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();

  const [lockRows, epochRows, rewardRows, eventRows, metricRows] = await Promise.all([
    db
      .select()
      .from(governanceLockExposures)
      .where(and(eq(governanceLockExposures.chainId, input.chainId), eq(governanceLockExposures.walletAddress, walletAddress)))
      .orderBy(desc(governanceLockExposures.materializedAt)),
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

  const lockPanels = sortGovernanceLockPanels(lockRows.map(mapLockPanel));
  const primaryLockId = selectPrimaryGovernanceLockId(lockPanels);
  const epochs = epochRows.map(mapEpoch);
  const allRewardRows = rewardRows.map(mapReward);
  const allEvents = eventRows.map(mapEvent);
  const events = filterGovernanceEvents(allEvents, input);
  const filteredRewards = sortRewards(filterGovernanceRewards(allRewardRows, input), input);
  const totalRewardRows = filteredRewards.length;
  const startIndex = (input.page - 1) * input.pageSize;
  const pagedRewards = filteredRewards.slice(startIndex, startIndex + input.pageSize);
  const metricRow = metricRows[0] ?? null;

  return {
    allRewardRows,
    rewardRows: pagedRewards,
    totalRewardRows,
    lockPanels,
    primaryLockId,
    epochs,
    events,
    selectedDetailTarget: resolveSelectedDetailTarget({
      request: input,
      allRewards: allRewardRows,
      visibleRewards: filteredRewards,
      allEvents,
      visibleEvents: events,
      epochs,
      lockPanels,
    }),
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
