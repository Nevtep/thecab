export const GOVERNANCE_EVENT_TYPES = [
  "all",
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
] as const;

export const GOVERNANCE_REWARD_TYPES = [
  "all",
  "fee",
  "bribe",
  "rebase",
  "relay",
  "unknown",
] as const;

export const GOVERNANCE_PROTOCOL_SURFACES = [
  "all",
  "voting_escrow",
  "voter",
  "relay",
  "briber",
  "fee_distributor",
  "reward_distributor",
  "unknown",
] as const;

export const GOVERNANCE_COVERAGE_STATES = [
  "full",
  "partial",
  "unresolved",
  "unsupported",
  "excluded",
  "unavailable",
] as const;

export const GOVERNANCE_CONFIDENCE_STATES = ["high", "medium", "low", "none"] as const;

export const GOVERNANCE_SORT_KEYS = [
  "occurredAt",
  "epoch",
  "valueUsdAtClaim",
  "rewardType",
  "coverage",
  "confidence",
] as const;

export const GOVERNANCE_PAGE_SIZES = [10, 25, 50] as const;

export const GOVERNANCE_ERROR_CODES = [
  "UNAUTHENTICATED_WALLET",
  "UNSUPPORTED_CHAIN",
  "INVALID_GOVERNANCE_FILTERS",
  "ANALYSIS_NOT_READY",
  "GOVERNANCE_READ_FAILED",
] as const;
