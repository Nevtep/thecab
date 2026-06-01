import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { readAnalysisStatusContext } from "@/server/analysis/analysis-run.repository";
import { readEngineV2SurfaceRows } from "@/server/analysis/engine-v2/materializers";
import { getExplorerTxUrl, getSupportedChain } from "@/server/chains";
import { getDb } from "@/server/db/client";
import { assetMovements, ledgerEvents } from "@/server/db/schema";
import type {
  ActivityAction,
  ActivityConfidence,
  ActivityCoverage,
  ActivitySurfaceFilter,
} from "@/server/activity/activity.contract";
import type {
  ActivityAvailableFilters,
  ActivityEventRow,
  ActivityMovement,
  ActivityRepositoryResult,
  ActivityRequest,
} from "@/server/activity/activity.types";

type LedgerDbRow = {
  activityId: string;
  chainId: number;
  walletAddress: string;
  txHash: string;
  logIndex: number;
  eventType: string;
  occurredAt: Date | string;
  classification: string | null;
  confidence: string;
  metadataJson: Record<string, unknown> | null;
};

type MovementDbRow = {
  id: string;
  ledgerEventId: string | null;
  tokenAddress: string;
  directionIn: boolean;
  amountRaw: string;
  amountUsd: string | null;
  metadataJson: Record<string, unknown> | null;
};

export type ActivityLedgerReadModelInput = {
  ledgerEvent: LedgerDbRow;
  movements: ActivityMovement[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function getExternalTxUrl(chainId: number, txHash: string | null) {
  if (!txHash) return null;
  return getSupportedChain(chainId) ? getExplorerTxUrl(chainId, txHash) : null;
}

function normalizeConfidence(value: string | null): ActivityConfidence {
  if (value === "high" || value === "medium" || value === "low" || value === "none") return value;
  if (value === "unknown") return "low";
  return "medium";
}

function confidenceScore(confidence: ActivityConfidence) {
  if (confidence === "high") return 5;
  if (confidence === "medium") return 3;
  if (confidence === "low") return 2;
  return 0;
}

function normalizeAction(row: LedgerDbRow): ActivityAction {
  const metadata = asRecord(row.metadataJson);
  const explicitAction = asString(metadata.actionType) ?? asString(metadata.activityAction);
  const source = `${explicitAction ?? ""} ${row.classification ?? ""} ${row.eventType}`.toLowerCase();
  const exclusion = asString(metadata.economicExclusionReason);

  if (exclusion === "airdrop_spam" || source.includes("airdrop")) return "airdrop";
  if (source.includes("governance") || source.includes("vote") || source.includes("proposal")) return "governance";
  if (source.includes("claim") || source.includes("reward")) return "claim";
  if (source.includes("strategy")) return "strategy";
  if (source.includes("deposit") || source.includes("increase")) return "deposit";
  if (source.includes("withdraw") || source.includes("decrease")) return "withdraw";
  if (source.includes("swap") || source.includes("rebalance")) return "swap";
  if (source.includes("transfer")) return "transfer";
  if (source.includes("unsupported")) return "unsupported";
  if (source.includes("ambiguous") || source.includes("unknown")) return "ambiguous";
  return "ambiguous";
}

function normalizeSurface(row: LedgerDbRow): Exclude<ActivitySurfaceFilter, "all"> {
  const metadata = asRecord(row.metadataJson);
  const explicitSurface = asString(metadata.sourceSurface) ?? asString(metadata.surfaceKind) ?? asString(metadata.surface);
  const source = `${explicitSurface ?? ""} ${row.classification ?? ""} ${row.eventType}`.toLowerCase();

  if (source.includes("governance")) return "governance";
  if (source.includes("reward")) return "rewards";
  if (source.includes("strategy")) return "strategies";
  if (source.includes("deposit")) return "deposits";
  if (source.includes("pool") || source.includes("aerodrome") || source.includes("mellow")) return "pools";
  if (source.includes("wallet") || source.includes("transfer")) return "wallet";
  return "unknown";
}

function normalizeCoverage(row: LedgerDbRow): ActivityCoverage {
  const metadata = asRecord(row.metadataJson);
  const explicitCoverage = asString(metadata.coverageStatus) ?? asString(metadata.coverageState);
  const exclusion = asString(metadata.economicExclusionReason);
  const classification = `${row.classification ?? ""} ${row.eventType}`.toLowerCase();

  if (exclusion === "airdrop_spam" || classification.includes("spam") || classification.includes("malicious")) return "excluded";
  if (explicitCoverage === "full" || explicitCoverage === "complete" || explicitCoverage === "share_level") return "full";
  if (explicitCoverage === "partial" || explicitCoverage === "estimated") return "partial";
  if (explicitCoverage === "unavailable") return "unavailable";
  if (classification.includes("unresolved") || classification.includes("ambiguous") || classification.includes("unknown")) return "unresolved";
  return "partial";
}

function getReasonCodes(row: LedgerDbRow, coverage: ActivityCoverage) {
  const metadata = asRecord(row.metadataJson);
  const reasonCodes = metadata.reasonCodes ?? metadata.coverageReasonCodes ?? metadata.exclusionReasonCodes;
  const explicit = Array.isArray(reasonCodes) ? reasonCodes.filter((value): value is string => typeof value === "string") : [];
  const exclusion = asString(metadata.economicExclusionReason);
  if (exclusion === "airdrop_spam") return [...explicit, "airdrop_spam"];
  if (coverage === "unresolved") return explicit.length > 0 ? explicit : ["missingClassificationEvidence"];
  if (coverage === "partial") return explicit.length > 0 ? explicit : ["partialClassificationEvidence"];
  if (coverage === "unavailable") return explicit.length > 0 ? explicit : ["unavailableClassificationEvidence"];
  return explicit;
}

function resolveTokenSymbol(metadata: Record<string, unknown>, tokenAddress: string | null) {
  return asString(metadata.tokenSymbol) ??
    asString(metadata.symbol) ??
    asString(metadata.assetSymbol) ??
    (tokenAddress ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}` : null);
}

export function mapActivityMovement(row: MovementDbRow): ActivityMovement {
  const metadata = asRecord(row.metadataJson);
  return {
    id: row.id,
    tokenAddress: row.tokenAddress,
    tokenSymbol: resolveTokenSymbol(metadata, row.tokenAddress),
    direction: row.directionIn ? "in" : "out",
    amountRaw: row.amountRaw,
    amountUsd: row.amountUsd,
  };
}

export function resolveActivityPrimaryMovement(movements: ActivityMovement[]) {
  return movements
    .map((movement) => ({ movement, value: asNumber(movement.amountUsd) ?? 0 }))
    .sort((left, right) => right.value - left.value)[0]?.movement ?? movements[0] ?? null;
}

function buildSummary(row: LedgerDbRow, action: ActivityAction, movements: ActivityMovement[]) {
  const metadata = asRecord(row.metadataJson);
  const explicit = asString(metadata.summary) ?? asString(metadata.description);
  if (explicit) return explicit;
  const primary = resolveActivityPrimaryMovement(movements);
  if (primary?.tokenSymbol) return `${action}:${primary.tokenSymbol}`;
  return row.eventType;
}

function shortEntity(id: string, prefix: string) {
  return `${prefix}-${id.slice(0, 4)}...${id.slice(-4)}`;
}

function buildLinkedEntities(metadata: Record<string, unknown>, chainId: number): ActivityEventRow["linkedEntities"] {
  const linkedEntities: ActivityEventRow["linkedEntities"] = [];
  const poolId = asString(metadata.poolId) ?? asString(metadata.primaryPoolId) ?? asString(metadata.resolvedPoolId);
  const depositId = asString(metadata.depositId) ?? asString(metadata.positionId);
  const strategyId = asString(metadata.strategyId);
  const strategyExposureId = asString(metadata.strategyExposureId);
  const rewardEventId = asString(metadata.rewardEventId) ?? asString(metadata.sourceRewardEventId);
  const governanceEventId = asString(metadata.governanceEventId);

  if (poolId) {
    linkedEntities.push({
      kind: "pool",
      entityId: poolId,
      label: asString(metadata.poolLabel) ?? shortEntity(poolId, "Pool"),
      href: `/pools/${poolId}?chainId=${chainId}`,
      reasonCode: "explicitPoolEvidence",
    });
  }
  if (depositId) {
    linkedEntities.push({
      kind: "deposit",
      entityId: depositId,
      label: asString(metadata.depositLabel) ?? shortEntity(depositId, "Dep"),
      href: `/deposits/${depositId}?chainId=${chainId}`,
      reasonCode: "explicitDepositEvidence",
    });
  }
  if (strategyExposureId || strategyId) {
    const entityId = strategyExposureId ?? strategyId!;
    linkedEntities.push({
      kind: "strategy",
      entityId,
      label: asString(metadata.strategyLabel) ?? shortEntity(entityId, "Strat"),
      href: `/strategies/${entityId}?chainId=${chainId}`,
      reasonCode: "explicitStrategyEvidence",
    });
  }
  if (rewardEventId) {
    linkedEntities.push({
      kind: "reward",
      entityId: rewardEventId,
      label: asString(metadata.rewardLabel) ?? shortEntity(rewardEventId, "Reward"),
      href: `/rewards?selected=${rewardEventId}`,
      reasonCode: "explicitRewardEvidence",
    });
  }
  if (governanceEventId) {
    linkedEntities.push({
      kind: "governance",
      entityId: governanceEventId,
      label: asString(metadata.governanceLabel) ?? shortEntity(governanceEventId, "Gov"),
      href: `/governance?chainId=${chainId}&kind=event&selected=${governanceEventId}&governanceEventId=${governanceEventId}`,
      reasonCode: "explicitGovernanceEvidence",
    });
  }

  return linkedEntities;
}

export function mapActivityLedgerRow(row: LedgerDbRow, movements: ActivityMovement[]): ActivityEventRow {
  const metadata = asRecord(row.metadataJson);
  const action = normalizeAction(row);
  const surface = normalizeSurface(row);
  const coverage = normalizeCoverage(row);
  const confidence = coverage === "excluded" ? "none" : normalizeConfidence(row.confidence);
  const primaryMovement = resolveActivityPrimaryMovement(movements);
  const valueUsd = movements.reduce((sum, movement) => sum + Math.abs(asNumber(movement.amountUsd) ?? 0), 0);

  return {
    activityId: row.activityId,
    chainId: row.chainId,
    walletAddress: row.walletAddress,
    occurredAt: toIso(row.occurredAt),
    txHash: row.txHash,
    externalTxUrl: getExternalTxUrl(row.chainId, row.txHash),
    action,
    actionLabelKey: `activity:actions.${action}`,
    surface,
    surfaceLabelKey: `activity:surfaces.${surface}`,
    coverage,
    confidence,
    confidenceScore: confidenceScore(confidence),
    valueUsd: valueUsd > 0 ? valueUsd.toFixed(2) : null,
    primaryTokenAddress: primaryMovement?.tokenAddress ?? asString(metadata.tokenAddress),
    primaryTokenSymbol: primaryMovement?.tokenSymbol ?? resolveTokenSymbol(metadata, asString(metadata.tokenAddress)),
    summary: buildSummary(row, action, movements),
    reasonCodes: getReasonCodes(row, coverage),
    movements,
    linkedEntities: buildLinkedEntities(metadata, row.chainId),
    metadata,
  };
}

export function matchesActivityRequest(row: ActivityEventRow, input: ActivityRequest) {
  if (input.surface !== "all" && row.surface !== input.surface) return false;
  if (input.action !== "all" && row.action !== input.action) return false;
  if (input.coverage && row.coverage !== input.coverage) return false;
  if (input.confidence && row.confidence !== input.confidence) return false;
  if (input.poolId && !row.linkedEntities.some((entity) => entity.kind === "pool" && entity.entityId === input.poolId)) return false;
  if (input.depositId && !row.linkedEntities.some((entity) => entity.kind === "deposit" && entity.entityId === input.depositId)) return false;
  if (input.strategyId && !row.linkedEntities.some((entity) => entity.kind === "strategy" && entity.entityId === input.strategyId)) return false;
  if (input.rewardEventId && !row.linkedEntities.some((entity) => entity.kind === "reward" && entity.entityId === input.rewardEventId)) return false;
  if (input.governanceEventId && !row.linkedEntities.some((entity) => entity.kind === "governance" && entity.entityId === input.governanceEventId)) return false;
  if (input.search) {
    const needle = input.search.toLowerCase();
    const haystack = [
      row.txHash,
      row.action,
      row.surface,
      row.summary,
      row.primaryTokenAddress,
      row.primaryTokenSymbol,
      ...row.linkedEntities.map((entity) => entity.label),
      ...row.reasonCodes,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function sortActivityRows(rows: ActivityEventRow[], input: ActivityRequest) {
  return [...rows].sort((left, right) => {
    let cmp = 0;
    switch (input.sort.key) {
      case "valueUsd":
        cmp = (asNumber(left.valueUsd) ?? -Infinity) - (asNumber(right.valueUsd) ?? -Infinity);
        break;
      case "action":
        cmp = left.action.localeCompare(right.action);
        break;
      case "coverage":
        cmp = left.coverage.localeCompare(right.coverage);
        break;
      case "confidence":
        cmp = left.confidenceScore - right.confidenceScore;
        break;
      case "occurredAt":
      default:
        cmp = left.occurredAt.localeCompare(right.occurredAt);
    }
    if (cmp === 0) cmp = left.activityId.localeCompare(right.activityId);
    return input.sort.direction === "asc" ? cmp : -cmp;
  });
}

export function calculateAvailableActivityFilters(rows: ActivityEventRow[]): ActivityAvailableFilters {
  const actions = new Set<ActivityAction>();
  const surfaces = new Set<Exclude<ActivitySurfaceFilter, "all">>();
  const tokenMap = new Map<string, string | null>();

  for (const row of rows) {
    actions.add(row.action);
    surfaces.add(row.surface);
    if (row.primaryTokenAddress) tokenMap.set(row.primaryTokenAddress, row.primaryTokenSymbol);
  }

  return {
    actions: [...actions].sort(),
    surfaces: [...surfaces].sort(),
    tokens: [...tokenMap.entries()].map(([tokenAddress, symbol]) => ({ tokenAddress, symbol })),
  };
}

function buildLedgerWhere(input: ActivityRequest, includeFilters: boolean) {
  const clauses = [
    eq(ledgerEvents.walletAddress, input.walletAddress),
    eq(ledgerEvents.chainId, input.chainId),
  ];

  if (!includeFilters) return clauses;

  if (input.search) {
    const needle = `%${input.search}%`;
    clauses.push(or(
      ilike(ledgerEvents.txHash, needle),
      ilike(ledgerEvents.eventType, needle),
      ilike(ledgerEvents.classification, needle),
      sql`${ledgerEvents.metadataJson}::text ILIKE ${needle}`,
    )!);
  }

  return clauses;
}

export async function readActivityAnalysisContext(input: { walletAddress: string; chainId: number }) {
  return readAnalysisStatusContext(input);
}

export async function findActivity(input: ActivityRequest): Promise<ActivityRepositoryResult> {
  const engineV2Rows = await readEngineV2SurfaceRows<ActivityEventRow>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "activity",
  });
  if (engineV2Rows) {
    const filtered = sortActivityRows(engineV2Rows.filter((row) => matchesActivityRequest(row, input)), input);
    const startIndex = (input.page - 1) * input.pageSize;
    return {
      allRows: filtered,
      rows: filtered.slice(startIndex, startIndex + input.pageSize),
      totalRows: filtered.length,
      availableFilters: calculateAvailableActivityFilters(engineV2Rows),
    };
  }

  const db = getDb();
  const ledgerSelect = {
    activityId: ledgerEvents.id,
    chainId: ledgerEvents.chainId,
    walletAddress: ledgerEvents.walletAddress,
    txHash: ledgerEvents.txHash,
    logIndex: ledgerEvents.logIndex,
    eventType: ledgerEvents.eventType,
    occurredAt: ledgerEvents.occurredAt,
    classification: ledgerEvents.classification,
    confidence: ledgerEvents.confidence,
    metadataJson: ledgerEvents.metadataJson,
  } as const;

  const [baseDbRows, filteredDbRows] = await Promise.all([
    db.select(ledgerSelect).from(ledgerEvents).where(and(...buildLedgerWhere(input, false))),
    db.select(ledgerSelect).from(ledgerEvents).where(and(...buildLedgerWhere(input, true))),
  ]);

  const ledgerIds = (filteredDbRows as LedgerDbRow[]).map((row) => row.activityId);
  const movementRows = ledgerIds.length > 0
    ? await db
      .select({
        id: assetMovements.id,
        ledgerEventId: assetMovements.ledgerEventId,
        tokenAddress: assetMovements.tokenAddress,
        directionIn: assetMovements.directionIn,
        amountRaw: assetMovements.amountRaw,
        amountUsd: assetMovements.amountUsd,
        metadataJson: assetMovements.metadataJson,
      })
      .from(assetMovements)
      .where(and(
        eq(assetMovements.walletAddress, input.walletAddress),
        eq(assetMovements.chainId, input.chainId),
        inArray(assetMovements.ledgerEventId, ledgerIds),
      ))
    : [];
  const movementMap = new Map<string, ActivityMovement[]>();
  for (const movement of movementRows as MovementDbRow[]) {
    if (!movement.ledgerEventId) continue;
    const existing = movementMap.get(movement.ledgerEventId) ?? [];
    existing.push(mapActivityMovement(movement));
    movementMap.set(movement.ledgerEventId, existing);
  }

  const baseRows = (baseDbRows as LedgerDbRow[]).map((row) => mapActivityLedgerRow(row, []));
  const filtered = sortActivityRows(
    (filteredDbRows as LedgerDbRow[])
      .map((row) => mapActivityLedgerRow(row, movementMap.get(row.activityId) ?? []))
      .filter((row) => matchesActivityRequest(row, input)),
    input,
  );
  const startIndex = (input.page - 1) * input.pageSize;

  return {
    allRows: filtered,
    rows: filtered.slice(startIndex, startIndex + input.pageSize),
    totalRows: filtered.length,
    availableFilters: calculateAvailableActivityFilters(baseRows),
  };
}
