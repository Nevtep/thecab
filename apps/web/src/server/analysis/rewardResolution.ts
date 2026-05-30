import type { EconomicComponentKind, SurfaceKind } from "@/server/analysis/txClassification";

export type RewardCandidateInput = {
  txHash: string;
  occurredAt: Date;
  category: string | null;
  summary: string | null;
  protocol: string | null;
  targetType: "deposit" | "strategy" | null;
  targetTokenId: string | null;
  targetPoolAddress?: string | null;
  targetPoolId?: string | null;
  targetWrapperAddress: string | null;
  targetStakingRewardsAddress?: string | null;
  sameTxTokenId?: string | null;
  shareLifecycleWrapperAddress?: string | null;
  /**
   * On-chain surface this candidate originated from. When present, drives the
   * ownership resolution branch deterministically. See
   * docs/spec/the-cab-aerodrome-claim-surfaces-research.md.
   */
  surfaceKind?: SurfaceKind | null;
  componentKey?: string | null;
  economicComponentKind?: EconomicComponentKind | string | null;
  movementLogIndexes?: number[];
};

export type RewardDepositTarget = {
  depositId: string;
  poolId: string | null;
  tokenId: string | null;
  protocol: string | null;
  createdAt?: Date;
};

export type RewardStrategyTarget = {
  strategyId: string;
  strategyExposureId: string;
  primaryPoolId: string | null;
  wrapperAddress: string;
  stakingRewardsAddress?: string | null;
  protocol: string | null;
  externalStrategyPositionReference: string | null;
  createdAt?: Date;
};

export type RewardResolutionBasis =
  | "explicit_token_id"
  | "same_tx_token_context"
  | "strategy_wrapper_pair"
  | "staking_rewards_pair"
  | "share_lifecycle_context"
  | "wallet_pool_single_holder"
  | "wallet_pool_aggregate"
  | "governance_claim"
  | "unresolved";

export type RewardOwnershipResolution = {
  resolutionStatus: "resolved" | "unresolved" | "excluded" | "unavailable";
  ownerType: "deposit" | "strategy" | null;
  depositId: string | null;
  strategyId: string | null;
  strategyExposureId: string | null;
  resolvedPoolId: string | null;
  resolutionBasis: RewardResolutionBasis;
  resolutionReasonCodes: string[];
  externalStrategyPositionReference: string | null;
  externalStrategyPositionReferenceStatus: "resolved" | "unresolved";
  feeAttributionBasis?: "wallet_pool_single_holder" | "wallet_pool_aggregate" | null;
};

function normalizeAddress(value: string | null | undefined) {
  return typeof value === "string" && value.length > 0 ? value.toLowerCase() : null;
}

export function resolveRewardOwnership(input: {
  candidate: RewardCandidateInput;
  depositTargets: RewardDepositTarget[];
  strategyTargets: RewardStrategyTarget[];
}): RewardOwnershipResolution {
  // Spec: surface-driven short-circuits. See
  // docs/spec/the-cab-aerodrome-claim-surfaces-research.md §6 ("Mapping summary
  // table") and §7 ("Implementation guardrails").
  const surfaceKind = input.candidate.surfaceKind ?? null;
  if (surfaceKind === "gauge_reward_unknown_surface") {
    return {
      resolutionStatus: "unresolved",
      ownerType: null,
      depositId: null,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: null,
      resolutionBasis: "unresolved",
      resolutionReasonCodes: ["unknownRewardSurface"],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }
  if (surfaceKind === "airdrop_spam") {
    return {
      resolutionStatus: "excluded",
      ownerType: null,
      depositId: null,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: null,
      resolutionBasis: "unresolved",
      resolutionReasonCodes: ["excludedAirdrop"],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }
  if (surfaceKind === "governance_voter_claim") {
    return {
      resolutionStatus: "resolved",
      ownerType: null,
      depositId: null,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: null,
      resolutionBasis: "governance_claim",
      resolutionReasonCodes: ["governanceReward"],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }
  if (
    input.candidate.economicComponentKind === "fee_claim" ||
    surfaceKind === "pool_fee_claim" ||
    surfaceKind === "pool_fee_claim_v2" ||
    surfaceKind === "pool_fee_claim_slipstream"
  ) {
    const targetPoolId = input.candidate.targetPoolId ?? null;
    if (!targetPoolId) {
      return {
        resolutionStatus: "unresolved",
        ownerType: input.candidate.targetType,
        depositId: null,
        strategyId: null,
        strategyExposureId: null,
        resolvedPoolId: null,
        resolutionBasis: "unresolved",
        resolutionReasonCodes: ["feeClaimNoActivePosition"],
        externalStrategyPositionReference: null,
        externalStrategyPositionReferenceStatus: "unresolved",
        feeAttributionBasis: null,
      };
    }

    const matchingDeposits = input.depositTargets.filter((target) => target.poolId === targetPoolId);
    const matchingStrategies = input.strategyTargets.filter((target) => target.primaryPoolId === targetPoolId);
    const owners = [
      ...matchingDeposits.map((target) => ({ type: "deposit" as const, target, createdAt: target.createdAt })),
      ...matchingStrategies.map((target) => ({ type: "strategy" as const, target, createdAt: target.createdAt })),
    ].sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

    const owner = owners[0] ?? null;
    if (!owner) {
      return {
        resolutionStatus: "unresolved",
        ownerType: input.candidate.targetType,
        depositId: null,
        strategyId: null,
        strategyExposureId: null,
        resolvedPoolId: targetPoolId,
        resolutionBasis: "unresolved",
        resolutionReasonCodes: ["feeClaimNoActivePosition"],
        externalStrategyPositionReference: null,
        externalStrategyPositionReferenceStatus: "unresolved",
        feeAttributionBasis: null,
      };
    }

    const feeAttributionBasis = owners.length === 1
      ? "wallet_pool_single_holder"
      : "wallet_pool_aggregate";
    if (owner.type === "deposit") {
      return {
        resolutionStatus: "resolved",
        ownerType: "deposit",
        depositId: owner.target.depositId,
        strategyId: null,
        strategyExposureId: null,
        resolvedPoolId: targetPoolId,
        resolutionBasis: feeAttributionBasis,
        resolutionReasonCodes: [],
        externalStrategyPositionReference: null,
        externalStrategyPositionReferenceStatus: "unresolved",
        feeAttributionBasis,
      };
    }
    return {
      resolutionStatus: "resolved",
      ownerType: "strategy",
      depositId: null,
      strategyId: owner.target.strategyId,
      strategyExposureId: owner.target.strategyExposureId,
      resolvedPoolId: targetPoolId,
      resolutionBasis: feeAttributionBasis,
      resolutionReasonCodes: [],
      externalStrategyPositionReference: owner.target.externalStrategyPositionReference,
      externalStrategyPositionReferenceStatus: owner.target.externalStrategyPositionReference
        ? "resolved"
        : "unresolved",
      feeAttributionBasis,
    };
  }

  const explicitTokenId = input.candidate.targetTokenId;
  const sameTxTokenId = input.candidate.sameTxTokenId ?? null;
  const targetWrapperAddress = normalizeAddress(input.candidate.targetWrapperAddress);
  const shareLifecycleWrapperAddress = normalizeAddress(input.candidate.shareLifecycleWrapperAddress);
  const targetStakingRewardsAddress = normalizeAddress(input.candidate.targetStakingRewardsAddress);

  const matchingDepositFromExplicit = explicitTokenId
    ? input.depositTargets.find((target) => target.tokenId === explicitTokenId) ?? null
    : null;
  const matchingDepositFromSameTx = !matchingDepositFromExplicit && sameTxTokenId
    ? input.depositTargets.find((target) => target.tokenId === sameTxTokenId) ?? null
    : null;

  const matchingStrategyFromWrapper = targetWrapperAddress
    ? input.strategyTargets.find((target) => normalizeAddress(target.wrapperAddress) === targetWrapperAddress) ?? null
    : null;
  const matchingStrategyFromStaking = !matchingStrategyFromWrapper && targetStakingRewardsAddress
    ? input.strategyTargets.find((target) => normalizeAddress(target.stakingRewardsAddress) === targetStakingRewardsAddress) ?? null
    : null;
  const matchingStrategyFromShareLifecycle =
    !matchingStrategyFromWrapper && !matchingStrategyFromStaking && shareLifecycleWrapperAddress
      ? input.strategyTargets.find((target) => normalizeAddress(target.wrapperAddress) === shareLifecycleWrapperAddress) ?? null
      : null;

  const matchingDeposit = matchingDepositFromExplicit ?? matchingDepositFromSameTx;
  const matchingStrategy =
    matchingStrategyFromWrapper ?? matchingStrategyFromStaking ?? matchingStrategyFromShareLifecycle;

  if (matchingDeposit && matchingStrategy) {
    return {
      resolutionStatus: "unresolved",
      ownerType: input.candidate.targetType,
      depositId: null,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: null,
      resolutionBasis: "unresolved",
      resolutionReasonCodes: ["manualStrategyConflict"],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }

  if (matchingDepositFromExplicit) {
    return {
      resolutionStatus: "resolved",
      ownerType: "deposit",
      depositId: matchingDepositFromExplicit.depositId,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: matchingDepositFromExplicit.poolId,
      resolutionBasis: "explicit_token_id",
      resolutionReasonCodes: [],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }

  if (matchingDepositFromSameTx) {
    return {
      resolutionStatus: "resolved",
      ownerType: "deposit",
      depositId: matchingDepositFromSameTx.depositId,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: matchingDepositFromSameTx.poolId,
      resolutionBasis: "same_tx_token_context",
      resolutionReasonCodes: [],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }

  if (matchingStrategy) {
    const resolutionBasis: RewardResolutionBasis = matchingStrategyFromWrapper
      ? "strategy_wrapper_pair"
      : matchingStrategyFromStaking
        ? "staking_rewards_pair"
        : "share_lifecycle_context";

    return {
      resolutionStatus: "resolved",
      ownerType: "strategy",
      depositId: null,
      strategyId: matchingStrategy.strategyId,
      strategyExposureId: matchingStrategy.strategyExposureId,
      resolvedPoolId: matchingStrategy.primaryPoolId,
      resolutionBasis,
      resolutionReasonCodes: [],
      externalStrategyPositionReference: matchingStrategy.externalStrategyPositionReference,
      externalStrategyPositionReferenceStatus: matchingStrategy.externalStrategyPositionReference
        ? "resolved"
        : "unresolved",
    };
  }

  const ownerType =
    input.candidate.targetType ??
    (targetWrapperAddress || targetStakingRewardsAddress || shareLifecycleWrapperAddress ? "strategy" : null);

  if (ownerType === "deposit") {
    return {
      resolutionStatus: "unresolved",
      ownerType,
      depositId: null,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: null,
      resolutionBasis: "unresolved",
      resolutionReasonCodes: [explicitTokenId || sameTxTokenId ? "providerDecodedOnly" : "missingTokenId"],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }

  if (ownerType === "strategy") {
    return {
      resolutionStatus: "unresolved",
      ownerType,
      depositId: null,
      strategyId: null,
      strategyExposureId: null,
      resolvedPoolId: null,
      resolutionBasis: "unresolved",
      resolutionReasonCodes: [
        targetWrapperAddress || targetStakingRewardsAddress || shareLifecycleWrapperAddress
          ? "missingStrategyExposure"
          : "providerDecodedOnly",
      ],
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
    };
  }

  return {
    resolutionStatus: "unresolved",
    ownerType: null,
    depositId: null,
    strategyId: null,
    strategyExposureId: null,
    resolvedPoolId: null,
    resolutionBasis: "unresolved",
    resolutionReasonCodes: ["providerDecodedOnly"],
    externalStrategyPositionReference: null,
    externalStrategyPositionReferenceStatus: "unresolved",
  };
}
