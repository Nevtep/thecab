import type {
  OverviewTrustCoverageReasonCode,
  TokenTrustReasonCode,
} from "@/server/asset-trust/assetTrust.types";

export const TRUST_REASON_TRANSLATION_KEYS: Record<TokenTrustReasonCode, string> = {
  moralisPossibleSpam: "trust:reasons.moralisPossibleSpam",
  moralisVerifiedContract: "trust:reasons.moralisVerifiedContract",
  alchemyMissingPrice: "trust:reasons.alchemyMissingPrice",
  missingLogo: "trust:reasons.missingLogo",
  missingMetadata: "trust:reasons.missingMetadata",
  suspiciousSymbol: "trust:reasons.suspiciousSymbol",
  zeroOrDustValue: "trust:reasons.zeroOrDustValue",
  unrecognizedContract: "trust:reasons.unrecognizedContract",
  knownAerodromeToken: "trust:reasons.knownAerodromeToken",
  knownProtocolContract: "trust:reasons.knownProtocolContract",
  hasReliablePrice: "trust:reasons.hasReliablePrice",
  userHidden: "trust:reasons.userHidden",
  userAllowed: "trust:reasons.userAllowed",
};

export const TRUST_COVERAGE_REASON_TRANSLATION_KEYS: Record<
  OverviewTrustCoverageReasonCode,
  string
> = {
  excludedSuspiciousAssets: "coverage:reasons.excludedSuspiciousAssets",
  lowConfidenceAssetsHidden: "coverage:reasons.lowConfidenceAssetsHidden",
  missingPrices: "coverage:reasons.missingPrices",
  visibleUnpricedAssets: "coverage:reasons.visibleUnpricedAssets",
  hiddenAssetsPresent: "coverage:reasons.hiddenAssetsPresent",
  knownProtocolSignalConflict: "coverage:reasons.knownProtocolSignalConflict",
  providerTrustSignalsMissing: "coverage:reasons.providerTrustSignalsMissing",
  metadataIncomplete: "coverage:reasons.metadataIncomplete",
  dustAssetsHidden: "coverage:reasons.dustAssetsHidden",
  valuationPartial: "coverage:reasons.valuationPartial",
};

export function dedupeTrustReasonCodes<TCode extends string>(reasonCodes: readonly TCode[]) {
  return Array.from(new Set(reasonCodes));
}
