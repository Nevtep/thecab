import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import { getExplorerTxUrl } from "@/server/chains";
import {
  findGovernanceDataView,
  readGovernanceAnalysisContext,
  type GovernanceRepositoryEventRow,
  type GovernanceRepositoryResult,
  type GovernanceSelectedDetailTarget,
} from "@/server/governance/governance.repository";
import type {
  GovernanceAnalysisState,
  GovernanceCoverageState,
  GovernanceEpochSummary,
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
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
  if (input.datePreset !== "all") chips.push({ id: "datePreset", labelKey: "governance:filters.datePreset", value: input.datePreset, removeTarget: "datePreset" });
  if (input.eventType !== "all") chips.push({ id: "eventType", labelKey: "governance:filters.eventType", value: input.eventType, removeTarget: "eventType" });
  if (input.rewardType !== "all") chips.push({ id: "rewardType", labelKey: "governance:filters.rewardType", value: input.rewardType, removeTarget: "rewardType" });
  if (input.protocolSurface !== "all") chips.push({ id: "protocolSurface", labelKey: "governance:filters.protocolSurface", value: input.protocolSurface, removeTarget: "protocolSurface" });
  if (input.epochId) chips.push({ id: "epochId", labelKey: "governance:filters.epoch", value: input.epochId, removeTarget: "epochId" });
  if (input.poolId) chips.push({ id: "poolId", labelKey: "governance:filters.pool", value: input.poolId, removeTarget: "poolId" });
  if (input.tokenAddress) chips.push({ id: "tokenAddress", labelKey: "governance:filters.token", value: input.tokenAddress, removeTarget: "tokenAddress" });
  if (input.coverage) chips.push({ id: "coverage", labelKey: "governance:filters.coverage", value: input.coverage, removeTarget: "coverage" });
  if (input.confidence) chips.push({ id: "confidence", labelKey: "governance:filters.confidence", value: input.confidence, removeTarget: "confidence" });
  if (input.selectedGovernanceId) {
    chips.push({
      id: "selectedGovernanceId",
      labelKey: "governance:filters.selected",
      value: input.selectedGovernanceId,
      removeTarget: "selected",
    });
  }
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
    .filter((row) => row.affectsTotals)
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
    if (!row.affectsTotals) continue;
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

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function dedupeRecords(values: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveEventMetadataContext(row: GovernanceRepositoryEventRow) {
  const metadata = row.metadata;
  const classification = asRecord(metadata.governanceClassification);
  const epochId = asString(metadata.epochId) ?? asString(metadata.governanceEpochId) ?? asString(classification.epochId);
  const poolId = asString(metadata.poolId) ?? asString(metadata.resolvedPoolId) ?? asString(classification.poolId);
  const poolLabel = asString(metadata.poolLabel) ?? asString(classification.poolLabel);
  const tokenMovements = asObjectArray(metadata.tokenMovements)
    .concat(asObjectArray(metadata.assetMovements))
    .concat(asObjectArray(metadata.movements));
  const valueUsd = asString(metadata.valueUsd) ??
    asString(metadata.amountUsd) ??
    asString(metadata.attributedValueUsd) ??
    asString(classification.valueUsd);
  const sourceEvidenceRefs = dedupeRecords([
    ...row.evidenceRefs,
    ...asObjectArray(metadata.sourceEvidenceRefs),
    ...asObjectArray(metadata.evidenceRefs),
  ]);
  const evidenceBasis = dedupeStrings([
    ...asStringArray(classification.evidenceBasis),
    ...asStringArray(metadata.evidenceBasis),
  ]);
  const reasonCodes = dedupeStrings([
    ...row.reasonCodes,
    ...asStringArray(classification.reasonCodes),
    ...asStringArray(metadata.reasonCodes),
  ]);

  return {
    epochId,
    poolId,
    poolLabel,
    tokenMovements,
    valueUsd,
    sourceEvidenceRefs,
    evidenceBasis,
    reasonCodes,
  };
}

function selectedDetailFromReward(row: GovernanceRewardRow, chainId: number): GovernanceSelectedDetail {
  const linkedContexts: GovernanceSelectedDetail["linkedContexts"] = [];
  if (row.rewardEventId) {
    const params = new URLSearchParams({ source: "governance", selected: row.rewardEventId });
    linkedContexts.push({
      kind: "reward",
      entityId: row.rewardEventId,
      route: `/rewards?${params.toString()}`,
    });
  }
  if (row.pool) {
    linkedContexts.push({
      kind: "pool",
      entityId: row.pool.poolId,
      route: `/pools/${row.pool.poolId}?chainId=${chainId}`,
    });
  }
  if (row.governanceEventId) {
    const params = new URLSearchParams({
      chainId: String(chainId),
      governanceEventId: row.governanceEventId,
      surface: "governance",
    });
    linkedContexts.push({
      kind: "activity",
      entityId: row.governanceEventId,
      route: `/activity?${params.toString()}`,
    });
  } else if (row.txHash) {
    const params = new URLSearchParams({ chainId: String(chainId), search: row.txHash, surface: "governance" });
    linkedContexts.push({
      kind: "activity",
      entityId: row.txHash,
      route: `/activity?${params.toString()}`,
    });
  }
  const rewardReasonCodes = dedupeStrings([
    ...row.poolAssociation.reasonCodes,
    ...(row.doubleCountingNoteKey ? [row.doubleCountingNoteKey] : []),
  ]);

  return {
    ...emptySelectedDetail(),
    selectionKind: "reward",
    selectionId: row.governanceRewardId,
    actionSummary: {
      labelKey: `governance:rewards.${row.rewardType}`,
      contextLabel: row.context.label,
    },
    transaction: {
      txHash: row.txHash,
      occurredAt: row.claimedAt,
      externalTxUrl: row.txHash ? getExplorerTxUrl(chainId, row.txHash) : null,
    },
    protocolSurface: row.rewardType === "bribe" ? "briber" : row.rewardType === "fee" ? "fee_distributor" : "reward_distributor",
    tokenMovements: [
      {
        tokenSymbol: row.token.symbol,
        tokenAddress: row.token.address,
        amount: row.amount,
        amountUsd: row.valueUsdAtClaim,
        direction: "in",
      },
    ],
    valueEffect: {
      valueUsd: row.valueUsdAtClaim,
      coverageState: row.coverageState,
    },
    epochContext: row.epochId ? { epochId: row.epochId, label: `Epoch ${row.epochId}` } : null,
    poolContext: row.pool,
    classificationEvidence: {
      basis: ["persistedGovernanceRewardRow", "rewardEventIdentity", row.poolAssociation.rule],
      reasonCodes: rewardReasonCodes,
      missingEvidenceReasonCodes: row.poolAssociation.status === "explicit" ? [] : row.poolAssociation.reasonCodes,
    },
    linkedContexts,
    coverageNotes: {
      coverageState: row.coverageState,
      confidence: row.confidence,
      affectsTotals: row.affectsTotals,
      reasonCodes: rewardReasonCodes,
    },
    sourceEvidenceRefs: row.sourceEvidenceRefs,
  };
}

function selectedDetailFromEvent(row: GovernanceRepositoryEventRow, chainId: number): GovernanceSelectedDetail {
  const context = resolveEventMetadataContext(row);
  const linkedContexts: GovernanceSelectedDetail["linkedContexts"] = [];
  const activityParams = new URLSearchParams({
    chainId: String(chainId),
    governanceEventId: row.governanceEventId,
    surface: "governance",
  });
  linkedContexts.push({
    kind: "activity",
    entityId: row.governanceEventId,
    route: `/activity?${activityParams.toString()}`,
  });
  if (context.poolId) {
    linkedContexts.push({
      kind: "pool",
      entityId: context.poolId,
      route: `/pools/${context.poolId}?chainId=${chainId}`,
    });
  }

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
    tokenMovements: context.tokenMovements,
    valueEffect: {
      valueUsd: context.valueUsd,
      coverageState: row.coverageState,
    },
    epochContext: context.epochId ? {
      epochId: context.epochId,
      label: `Epoch ${context.epochId}`,
      coverageState: row.coverageState,
    } : null,
    poolContext: context.poolId ? {
      poolId: context.poolId,
      label: context.poolLabel ?? context.poolId,
      coverageState: row.coverageState,
    } : null,
    classificationEvidence: {
      basis: context.evidenceBasis.length > 0 ? context.evidenceBasis : ["persistedGovernanceEvent"],
      reasonCodes: context.reasonCodes,
      missingEvidenceReasonCodes: row.coverageState === "full" ? [] : context.reasonCodes,
    },
    linkedContexts,
    coverageNotes: {
      coverageState: row.coverageState,
      confidence: row.confidence,
      affectsTotals: row.coverageState !== "excluded" && row.coverageState !== "unsupported",
      reasonCodes: row.reasonCodes,
    },
    sourceEvidenceRefs: context.sourceEvidenceRefs,
  };
}

function selectedDetailFromEpoch(row: GovernanceEpochSummary, chainId: number): GovernanceSelectedDetail {
  const rewardValues = [row.feesUsd, row.bribesUsd, row.rebasesUsd]
    .map(asNumber)
    .filter((value): value is number => value !== null);
  const valueUsd = rewardValues.length > 0 ? fixed(rewardValues.reduce((sum, value) => sum + value, 0)) : null;
  const linkedContexts = row.votedPools.map((pool) => ({
    kind: "pool" as const,
    entityId: pool.poolId,
    route: `/pools/${pool.poolId}?chainId=${chainId}`,
  }));
  const reasonCodes = row.coverageState === "full" ? [] : ["partialEpochContext"];

  return {
    ...emptySelectedDetail(),
    selectionKind: "epoch",
    selectionId: row.epochId,
    actionSummary: {
      labelKey: "governance:detail.epochSummary",
      contextLabel: row.epochLabel,
    },
    protocolSurface: "voter",
    valueEffect: {
      valueUsd,
      coverageState: row.coverageState,
    },
    epochContext: {
      epochId: row.epochId,
      label: row.epochLabel,
      epochStartAt: row.epochStartAt,
      epochEndAt: row.epochEndAt,
      voteMode: row.voteMode,
      resetState: row.resetState,
      rewardState: row.rewardState,
      votedPools: row.votedPools,
    },
    poolContext: row.votedPools.length === 1 ? {
      poolId: row.votedPools[0]!.poolId,
      label: row.votedPools[0]!.label,
      weightPercent: row.votedPools[0]!.weightPercent,
    } : null,
    classificationEvidence: {
      basis: ["persistedGovernanceEpochSummary"],
      reasonCodes,
      missingEvidenceReasonCodes: reasonCodes,
    },
    linkedContexts,
    coverageNotes: {
      coverageState: row.coverageState,
      confidence: row.confidence,
      affectsTotals: false,
      reasonCodes,
    },
    sourceEvidenceRefs: [],
  };
}

function buildSelectedDetail(input: {
  request: GovernanceRequest;
  repository: GovernanceRepositoryResult;
}) {
  const explicitSnapshot = input.repository.metricSnapshot?.selectedDetail;
  if (explicitSnapshot) return explicitSnapshot;
  const target: GovernanceSelectedDetailTarget | null = input.repository.selectedDetailTarget;
  if (target?.kind === "reward") return selectedDetailFromReward(target.reward, input.request.chainId);
  if (target?.kind === "event") return selectedDetailFromEvent(target.event, input.request.chainId);
  if (target?.kind === "epoch") return selectedDetailFromEpoch(target.epoch, input.request.chainId);
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
