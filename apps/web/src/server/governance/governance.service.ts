import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import { getExplorerTxUrl } from "@/server/chains";
import {
  findGovernanceDataView,
  readGovernanceAnalysisContext,
  type GovernanceRepositoryEventRow,
  type GovernanceRepositoryResult,
} from "@/server/governance/governance.repository";
import type {
  GovernanceAnalysisState,
  GovernanceCoverageState,
  GovernanceRequest,
  GovernanceResponse,
  GovernanceRewardRow,
  GovernanceSelectedDetail,
  GovernanceSummary,
  GovernanceValueState,
} from "@/server/governance/governance.types";

const COVERAGE_RANK: Record<GovernanceCoverageState, number> = {
  full: 5,
  partial: 4,
  unresolved: 3,
  unsupported: 2,
  excluded: 1,
  unavailable: 0,
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function fixed(value: number, digits = 2) {
  return value.toFixed(digits);
}

function emptyValue(reasonCodes: string[]): GovernanceValueState {
  return {
    value: null,
    valueUsd: null,
    coverageState: "unavailable",
    confidence: "none",
    reasonCodes,
  };
}

function valueState(input: {
  value: string | null;
  valueUsd?: string | null;
  coverageState?: GovernanceCoverageState;
  confidence?: GovernanceValueState["confidence"];
  reasonCodes?: string[];
}): GovernanceValueState {
  return {
    value: input.value,
    valueUsd: input.valueUsd ?? null,
    coverageState: input.coverageState ?? (input.value === null ? "unavailable" : "partial"),
    confidence: input.confidence ?? (input.value === null ? "none" : "medium"),
    reasonCodes: input.reasonCodes ?? [],
  };
}

function worstCoverage(states: GovernanceCoverageState[]): GovernanceCoverageState {
  if (states.length === 0) return "unavailable";
  return states.reduce((worst, next) => (COVERAGE_RANK[next] < COVERAGE_RANK[worst] ? next : worst), "full" as GovernanceCoverageState);
}

function remainingDays(expiresAt: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function createGovernanceActiveChips(input: GovernanceRequest): GovernanceResponse["filters"]["activeChips"] {
  const chips: GovernanceResponse["filters"]["activeChips"] = [];
  if (input.search) chips.push({ id: "search", labelKey: "governance:filters.searchPlaceholder", value: input.search, removeTarget: "search" });
  if (input.eventType !== "all") chips.push({ id: "eventType", labelKey: "governance:filters.eventType", value: input.eventType, removeTarget: "eventType" });
  if (input.rewardType !== "all") chips.push({ id: "rewardType", labelKey: "governance:filters.rewardType", value: input.rewardType, removeTarget: "rewardType" });
  if (input.protocolSurface !== "all") chips.push({ id: "protocolSurface", labelKey: "governance:filters.protocolSurface", value: input.protocolSurface, removeTarget: "protocolSurface" });
  if (input.epochId) chips.push({ id: "epochId", labelKey: "governance:filters.epoch", value: input.epochId, removeTarget: "epochId" });
  if (input.poolId) chips.push({ id: "poolId", labelKey: "governance:filters.pool", value: input.poolId, removeTarget: "poolId" });
  if (input.tokenAddress) chips.push({ id: "tokenAddress", labelKey: "governance:filters.token", value: input.tokenAddress, removeTarget: "tokenAddress" });
  if (input.coverage) chips.push({ id: "coverage", labelKey: "governance:filters.coverage", value: input.coverage, removeTarget: "coverage" });
  if (input.confidence) chips.push({ id: "confidence", labelKey: "governance:filters.confidence", value: input.confidence, removeTarget: "confidence" });
  return chips;
}

export function buildEmptyGovernanceSummary(reasonCodes = ["governanceReadModelUnavailable"]): GovernanceSummary {
  return {
    lockedAero: emptyValue(reasonCodes),
    veAeroExposure: emptyValue(reasonCodes),
    lockExpiry: {
      expiresAt: null,
      remainingDays: null,
      coverageState: "unavailable",
      confidence: "none",
      reasonCodes,
    },
    governanceRewardsClaimedUsd: emptyValue(reasonCodes),
    estimatedGovernanceReturn: emptyValue(["explicitReturnUnavailable"]),
    overallCoverage: {
      coverageState: "unavailable",
      confidence: "none",
      reasonCodes,
    },
  };
}

function buildSummary(repository: GovernanceRepositoryResult): GovernanceSummary {
  const lockPanel = repository.lockPanel;
  const rewardsUsd = repository.allRewardRows
    .filter((row) => row.coverageState !== "excluded" && row.coverageState !== "unsupported")
    .reduce((sum, row) => sum + (asNumber(row.valueUsdAtClaim) ?? 0), 0);
  const summary = repository.metricSnapshot?.summary ?? {};
  const explicitReturn = asString(summary.estimatedGovernanceReturn);
  const coverageStates = [
    lockPanel?.coverageState,
    repository.metricSnapshot?.coverageState,
    ...repository.allRewardRows.map((row) => row.coverageState),
    ...repository.epochs.map((epoch) => epoch.coverageState),
  ].filter((value): value is GovernanceCoverageState => Boolean(value));
  const coverageState = worstCoverage(coverageStates);
  const confidence = repository.metricSnapshot?.confidence ?? lockPanel?.confidence ?? "none";
  const reasonCodes = Array.from(new Set([
    ...(lockPanel?.reasonCodes ?? []),
    ...(coverageState === "unavailable" ? ["governanceReadModelUnavailable"] : []),
  ]));

  return {
    lockedAero: lockPanel
      ? valueState({
          value: lockPanel.lockedAeroAmount,
          valueUsd: lockPanel.lockedAeroValueUsd,
          coverageState: lockPanel.coverageState,
          confidence: lockPanel.confidence,
          reasonCodes: lockPanel.reasonCodes,
        })
      : emptyValue(["governanceLockUnavailable"]),
    veAeroExposure: lockPanel
      ? valueState({
          value: lockPanel.veAeroExposure,
          coverageState: lockPanel.coverageState,
          confidence: lockPanel.confidence,
          reasonCodes: lockPanel.reasonCodes,
        })
      : emptyValue(["governanceLockUnavailable"]),
    lockExpiry: {
      expiresAt: lockPanel?.expiresAt ?? null,
      remainingDays: remainingDays(lockPanel?.expiresAt ?? null),
      coverageState: lockPanel?.coverageState ?? "unavailable",
      confidence: lockPanel?.confidence ?? "none",
      reasonCodes: lockPanel?.reasonCodes ?? ["governanceLockUnavailable"],
    },
    governanceRewardsClaimedUsd: valueState({
      value: fixed(rewardsUsd),
      valueUsd: fixed(rewardsUsd),
      coverageState: repository.allRewardRows.length > 0 ? coverageState : "unavailable",
      confidence: repository.allRewardRows.length > 0 ? confidence : "none",
      reasonCodes: repository.allRewardRows.length > 0 ? reasonCodes : ["governanceRewardsUnavailable"],
    }),
    estimatedGovernanceReturn: explicitReturn
      ? valueState({
          value: explicitReturn,
          coverageState: repository.metricSnapshot?.coverageState ?? "partial",
          confidence: repository.metricSnapshot?.confidence ?? "medium",
          reasonCodes: [],
        })
      : emptyValue(["explicitReturnUnavailable"]),
    overallCoverage: {
      coverageState,
      confidence,
      reasonCodes,
    },
  };
}

function buildRewardBreakdown(rows: GovernanceRewardRow[]): GovernanceResponse["rewardBreakdown"] {
  const totals = new Map<GovernanceRewardRow["rewardType"], { value: number; coverageState: GovernanceCoverageState }>();
  for (const row of rows) {
    if (row.coverageState === "excluded" || row.coverageState === "unsupported") continue;
    const value = asNumber(row.valueUsdAtClaim) ?? 0;
    const existing = totals.get(row.rewardType) ?? { value: 0, coverageState: row.coverageState };
    totals.set(row.rewardType, {
      value: existing.value + value,
      coverageState: worstCoverage([existing.coverageState, row.coverageState]),
    });
  }
  const totalValue = [...totals.values()].reduce((sum, entry) => sum + entry.value, 0);
  return {
    totalValueUsd: totalValue > 0 ? fixed(totalValue) : null,
    coverageState: worstCoverage([...totals.values()].map((entry) => entry.coverageState)),
    segments: [...totals.entries()]
      .map(([rewardType, entry]) => ({
        rewardType,
        valueUsd: fixed(entry.value),
        percent: totalValue > 0 ? fixed((entry.value / totalValue) * 100, 2) : null,
        coverageState: entry.coverageState,
      }))
      .sort((left, right) => (Number(right.valueUsd ?? 0)) - (Number(left.valueUsd ?? 0))),
  };
}

function emptySelectedDetail(): GovernanceSelectedDetail {
  return {
    selectionKind: "empty",
    selectionId: null,
    actionSummary: {
      labelKey: "governance:detail.empty",
      contextLabel: null,
    },
    transaction: {
      txHash: null,
      occurredAt: null,
      externalTxUrl: null,
    },
    protocolSurface: "unknown",
    tokenMovements: [],
    valueEffect: {
      valueUsd: null,
      coverageState: "unavailable",
    },
    epochContext: null,
    poolContext: null,
    classificationEvidence: {
      basis: [],
      reasonCodes: ["noGovernanceSelection"],
      missingEvidenceReasonCodes: [],
    },
    linkedContexts: [],
    coverageNotes: {
      coverageState: "unavailable",
      confidence: "none",
      affectsTotals: false,
      reasonCodes: ["noGovernanceSelection"],
    },
    sourceEvidenceRefs: [],
  };
}

function selectedDetailFromReward(row: GovernanceRewardRow): GovernanceSelectedDetail {
  return {
    ...emptySelectedDetail(),
    selectionKind: "reward",
    selectionId: row.governanceRewardId,
    actionSummary: {
      labelKey: `governance:rewards.${row.rewardType}`,
      contextLabel: row.context.label,
    },
    protocolSurface: "unknown",
    tokenMovements: [
      {
        tokenSymbol: row.token.symbol,
        tokenAddress: row.token.address,
        amount: row.amount,
      },
    ],
    valueEffect: {
      valueUsd: row.valueUsdAtClaim,
      coverageState: row.coverageState,
    },
    epochContext: row.epochId ? { epochId: row.epochId, label: `Epoch ${row.epochId}` } : null,
    poolContext: row.pool,
    classificationEvidence: {
      basis: ["persistedGovernanceRewardRow"],
      reasonCodes: [],
      missingEvidenceReasonCodes: row.pool ? [] : ["explicitPoolAssociationUnavailable"],
    },
    coverageNotes: {
      coverageState: row.coverageState,
      confidence: row.confidence,
      affectsTotals: row.coverageState !== "excluded" && row.coverageState !== "unsupported",
      reasonCodes: [],
    },
  };
}

function selectedDetailFromEvent(row: GovernanceRepositoryEventRow, chainId: number): GovernanceSelectedDetail {
  return {
    ...emptySelectedDetail(),
    selectionKind: "event",
    selectionId: row.governanceEventId,
    actionSummary: {
      labelKey: `governance:events.${row.eventType}`,
      contextLabel: row.protocolSurface,
    },
    transaction: {
      txHash: row.txHash,
      occurredAt: row.occurredAt,
      externalTxUrl: getExplorerTxUrl(chainId, row.txHash),
    },
    protocolSurface: row.protocolSurface,
    classificationEvidence: {
      basis: ["persistedGovernanceEvent"],
      reasonCodes: row.reasonCodes,
      missingEvidenceReasonCodes: row.coverageState === "full" ? [] : row.reasonCodes,
    },
    coverageNotes: {
      coverageState: row.coverageState,
      confidence: row.confidence,
      affectsTotals: row.coverageState !== "excluded" && row.coverageState !== "unsupported",
      reasonCodes: row.reasonCodes,
    },
    sourceEvidenceRefs: row.evidenceRefs,
  };
}

function buildSelectedDetail(input: {
  request: GovernanceRequest;
  repository: GovernanceRepositoryResult;
}) {
  const explicitSnapshot = input.repository.metricSnapshot?.selectedDetail;
  if (explicitSnapshot) return explicitSnapshot;

  if (input.request.selectedKind === "reward" && input.request.selectedGovernanceId) {
    const reward = input.repository.allRewardRows.find((row) => row.governanceRewardId === input.request.selectedGovernanceId);
    if (reward) return selectedDetailFromReward(reward);
  }
  if (input.request.selectedKind === "event" && input.request.selectedGovernanceId) {
    const event = input.repository.events.find((row) => row.governanceEventId === input.request.selectedGovernanceId);
    if (event) return selectedDetailFromEvent(event, input.request.chainId);
  }

  const firstReward = input.repository.rewardRows[0] ?? input.repository.allRewardRows[0];
  if (firstReward) return selectedDetailFromReward(firstReward);
  const firstEvent = input.repository.events[0];
  if (firstEvent) return selectedDetailFromEvent(firstEvent, input.request.chainId);
  return emptySelectedDetail();
}

export function buildLockedGovernanceResponse(input: GovernanceRequest, analysis: GovernanceAnalysisState): GovernanceResponse {
  return {
    screenKind: "locked",
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysis,
    filters: {
      ...input,
      activeChips: createGovernanceActiveChips(input),
    },
    summary: buildEmptyGovernanceSummary(["analysisNotReady"]),
    lockPanel: null,
    epochTimeline: { epochs: [] },
    rewardBreakdown: buildRewardBreakdown([]),
    rewards: {
      rows: [],
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalRows: 0,
        totalPages: 0,
      },
    },
    selectedDetail: emptySelectedDetail(),
    availableFilters: {
      rewardTypes: [],
      tokens: [],
      epochs: [],
      protocolSurfaces: [],
    },
  };
}

export function buildReadyGovernanceResponse(input: {
  request: GovernanceRequest;
  repository: GovernanceRepositoryResult;
  analysis: GovernanceAnalysisState;
}): GovernanceResponse {
  const hasGovernanceData = Boolean(
    input.repository.lockPanel ||
    input.repository.epochs.length > 0 ||
    input.repository.allRewardRows.length > 0 ||
    input.repository.events.length > 0,
  );
  return {
    screenKind: hasGovernanceData ? "ready" : "empty",
    walletAddress: input.request.walletAddress,
    chainId: input.request.chainId,
    analysis: input.analysis,
    filters: {
      ...input.request,
      activeChips: createGovernanceActiveChips(input.request),
    },
    summary: buildSummary(input.repository),
    lockPanel: input.repository.lockPanel,
    epochTimeline: {
      epochs: input.repository.epochs,
    },
    rewardBreakdown: buildRewardBreakdown(input.repository.allRewardRows),
    rewards: {
      rows: input.repository.rewardRows,
      pagination: {
        page: input.request.page,
        pageSize: input.request.pageSize,
        totalRows: input.repository.totalRewardRows,
        totalPages: Math.ceil(input.repository.totalRewardRows / input.request.pageSize),
      },
    },
    selectedDetail: buildSelectedDetail(input),
    availableFilters: input.repository.availableFilters,
  };
}

export async function getGovernanceDataView(input: GovernanceRequest): Promise<GovernanceResponse> {
  const { run, freshness, slices } = await readGovernanceAnalysisContext(input);
  const failedSlices = slices.filter((slice) => slice.status === "failed").length;
  const lastSuccessfulRunAt = freshness?.lastAnalyzedAt ?? run?.completedAt ?? null;
  const projectedStatus = projectAnalysisStatus({
    latestRunStatus: run?.status ?? null,
    lastSuccessfulRunAt,
    coverageReasons: run?.coverageReasonsJson ?? [],
    failedSliceCount: failedSlices,
  });
  const analysis: GovernanceAnalysisState = {
    status: projectedStatus.status,
    runId: run?.id ?? freshness?.lastSuccessfulRunId ?? null,
    completedAt: lastSuccessfulRunAt?.toISOString() ?? null,
    isStale: projectedStatus.status === "stale",
  };

  if (projectedStatus.status !== "ready" && projectedStatus.status !== "stale") {
    return buildLockedGovernanceResponse(input, analysis);
  }

  const repository = await findGovernanceDataView(input);
  return buildReadyGovernanceResponse({ request: input, repository, analysis });
}
