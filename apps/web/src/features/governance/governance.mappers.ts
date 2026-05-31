import type { GovernanceResponse } from "@/server/governance/governance.types";

function dedupe<TValue>(values: TValue[]) {
  return Array.from(new Set(values));
}

function normalizeReasonCodes<TValue extends { reasonCodes: string[] }>(value: TValue): TValue {
  return {
    ...value,
    reasonCodes: dedupe(value.reasonCodes),
  };
}

export function mapGovernanceResponseToViewModel(response: GovernanceResponse): GovernanceResponse {
  return {
    ...response,
    walletAddress: response.walletAddress.toLowerCase(),
    summary: {
      ...response.summary,
      lockedAero: normalizeReasonCodes(response.summary.lockedAero),
      veAeroExposure: normalizeReasonCodes(response.summary.veAeroExposure),
      lockExpiry: normalizeReasonCodes(response.summary.lockExpiry),
      governanceRewardsClaimedUsd: normalizeReasonCodes(response.summary.governanceRewardsClaimedUsd),
      estimatedGovernanceReturn: normalizeReasonCodes(response.summary.estimatedGovernanceReturn),
      overallCoverage: normalizeReasonCodes(response.summary.overallCoverage),
    },
    lockPanel: response.lockPanel
      ? {
          ...response.lockPanel,
          reasonCodes: dedupe(response.lockPanel.reasonCodes),
          lifecycle: [...response.lockPanel.lifecycle].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)),
        }
      : null,
    epochTimeline: {
      epochs: [...response.epochTimeline.epochs].sort((left, right) =>
        (left.epochStartAt ?? left.epochId).localeCompare(right.epochStartAt ?? right.epochId),
      ),
    },
    rewardBreakdown: {
      ...response.rewardBreakdown,
      segments: [...response.rewardBreakdown.segments].sort((left, right) => Number(right.valueUsd ?? 0) - Number(left.valueUsd ?? 0)),
    },
    rewards: {
      ...response.rewards,
      rows: [...response.rewards.rows].sort((left, right) =>
        (right.claimedAt ?? "").localeCompare(left.claimedAt ?? ""),
      ),
    },
    selectedDetail: {
      ...response.selectedDetail,
      classificationEvidence: {
        ...response.selectedDetail.classificationEvidence,
        basis: dedupe(response.selectedDetail.classificationEvidence.basis),
        reasonCodes: dedupe(response.selectedDetail.classificationEvidence.reasonCodes),
        missingEvidenceReasonCodes: dedupe(response.selectedDetail.classificationEvidence.missingEvidenceReasonCodes),
      },
      coverageNotes: {
        ...response.selectedDetail.coverageNotes,
        reasonCodes: dedupe(response.selectedDetail.coverageNotes.reasonCodes),
      },
    },
  };
}
