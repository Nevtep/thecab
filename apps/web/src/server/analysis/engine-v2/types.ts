export const ENGINE_V2_VERSION = "engine-v2.0";

export const ENGINE_V2_STAGES = [
  "collection",
  "canonicalization",
  "abi_registry",
  "classification",
  "enrichment",
  "accounting",
  "materialization",
  "regression",
] as const;

export type EngineV2Stage = (typeof ENGINE_V2_STAGES)[number];

export const ENGINE_V2_COVERAGE_STATES = [
  "full",
  "partial",
  "unresolved",
  "unsupported",
  "excluded",
  "unavailable",
  "unknown",
] as const;

export type EngineV2CoverageState = (typeof ENGINE_V2_COVERAGE_STATES)[number];

export const ENGINE_V2_CONFIDENCE_STATES = ["high", "medium", "low", "none", "unknown"] as const;

export type EngineV2ConfidenceState = (typeof ENGINE_V2_CONFIDENCE_STATES)[number];

export const ENGINE_V2_REASON_CODES = [
  "missing_abi",
  "missing_selector",
  "missing_event_topic",
  "missing_token_metadata",
  "missing_historical_price",
  "missing_pool_definition",
  "missing_lock_origin",
  "missing_distributor_pool_link",
  "missing_strategy_identity",
  "conflicting_evidence",
  "provider_duplicate",
  "provider_unavailable",
  "unsupported_transfer",
  "excluded_spam",
  "excluded_airdrop",
  "request_time_provider_forbidden",
] as const;

export type EngineV2ReasonCode = (typeof ENGINE_V2_REASON_CODES)[number];

export type ChainScopedWallet = {
  chainId: number;
  walletAddress: string;
};

export type EngineV2CoverageEvidence = {
  coverageStatus: EngineV2CoverageState;
  confidence: EngineV2ConfidenceState;
  reasonCodes: EngineV2ReasonCode[];
};
