export const ASSET_TRUST_CLASSIFIER_VERSION = "asset-trust-v1";

export const TOKEN_TRUST_STATUSES = [
  "trusted",
  "verified",
  "known_protocol",
  "priced",
  "low_confidence",
  "possible_spam",
  "blocked",
  "unknown",
] as const;

export type TokenTrustStatus = (typeof TOKEN_TRUST_STATUSES)[number];

export const TOKEN_TRUST_REASON_CODES = [
  "moralisPossibleSpam",
  "moralisVerifiedContract",
  "alchemyMissingPrice",
  "missingLogo",
  "missingMetadata",
  "suspiciousSymbol",
  "zeroOrDustValue",
  "unrecognizedContract",
  "knownAerodromeToken",
  "knownProtocolContract",
  "hasReliablePrice",
  "userHidden",
  "userAllowed",
] as const;

export type TokenTrustReasonCode = (typeof TOKEN_TRUST_REASON_CODES)[number];

export const OVERVIEW_TRUST_COVERAGE_REASON_CODES = [
  "excludedSuspiciousAssets",
  "lowConfidenceAssetsHidden",
  "missingPrices",
  "visibleUnpricedAssets",
  "hiddenAssetsPresent",
  "knownProtocolSignalConflict",
  "providerTrustSignalsMissing",
  "metadataIncomplete",
  "dustAssetsHidden",
  "valuationPartial",
] as const;

export type OverviewTrustCoverageReasonCode =
  (typeof OVERVIEW_TRUST_COVERAGE_REASON_CODES)[number];

export type AssetTrustClassifierInput = {
  walletAddress: string;
  chainId: number;
  tokenAddress: string | null;
  symbol: string | null;
  name: string | null;
  balanceRaw: string;
  balanceFormatted: string;
  valueUsd: number | null;
  hasReliableAlchemyPrice: boolean;
  moralisPossibleSpam: boolean | null;
  moralisVerifiedContract: boolean | null;
  hasLogo: boolean;
  hasMetadata: boolean;
  isKnownProtocolAsset: boolean;
  isNativeAsset: boolean;
  isDustValue: boolean;
  classifierVersion: string;
};

export type TokenTrustClassification = {
  trustStatus: TokenTrustStatus;
  trustReasonCodes: TokenTrustReasonCode[];
  isHiddenByDefault: boolean;
  classifierVersion: string;
};

export type KnownProtocolTrustReasonCode = Extract<
  TokenTrustReasonCode,
  "knownAerodromeToken" | "knownProtocolContract"
>;

export type AssetTrustKnownProtocolMatch = {
  chainId: number;
  tokenAddress: string;
  protocol: string | null;
  reasonCode: KnownProtocolTrustReasonCode;
  source: "chain_bootstrap" | "protocol_contracts" | "aerodrome_metadata" | "mellow_metadata";
};