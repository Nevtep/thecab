export const ANALYSIS_COVERAGE_LEVELS = ["full", "partial", "unknown"] as const;
export const ANALYSIS_COVERAGE_REASON_CODES = [
  "missingPrices",
  "historyPaginationExceeded",
  "partialDecoded",
  "rewardMissingTokenId",
  "rewardMissingStrategyExposure",
  "rewardManualStrategyConflict",
  "rewardProviderDecodedOnly",
  "residualAmbiguousSource",
  "providerError",
  "providerThrottled",
  "reorgSuspect",
  "decodeError",
  "pricingPartial",
  "unknownError",
] as const;

export type AnalysisCoverageLevel = (typeof ANALYSIS_COVERAGE_LEVELS)[number];
export type AnalysisCoverageReasonCode = (typeof ANALYSIS_COVERAGE_REASON_CODES)[number];

export function mapRewardResolutionReasonCodesToCoverageReasons(
  reasonCodes: string[] | null | undefined,
): AnalysisCoverageReasonCode[] {
  const mapped = (reasonCodes ?? []).flatMap((reasonCode) => {
    switch (reasonCode) {
      case "missingTokenId":
        return ["rewardMissingTokenId"];
      case "missingStrategyExposure":
        return ["rewardMissingStrategyExposure"];
      case "manualStrategyConflict":
        return ["rewardManualStrategyConflict"];
      case "providerDecodedOnly":
        return ["rewardProviderDecodedOnly"];
      default:
        return [];
    }
  });

  return dedupeCoverageReasons(mapped);
}

export function mapInferredActionCoverageReasons(
  actionTypes: string[] | null | undefined,
): AnalysisCoverageReasonCode[] {
  const mapped = (actionTypes ?? []).flatMap((actionType) => {
    switch (actionType) {
      case "unknown_source_deposit":
        return ["residualAmbiguousSource"];
      default:
        return [];
    }
  });

  return dedupeCoverageReasons(mapped);
}

export function dedupeCoverageReasons(
  reasonCodes: Array<AnalysisCoverageReasonCode | string> | null | undefined,
): AnalysisCoverageReasonCode[] {
  const normalized = Array.from(new Set((reasonCodes ?? []).filter(Boolean)));

  return normalized.filter((reasonCode): reasonCode is AnalysisCoverageReasonCode =>
    ANALYSIS_COVERAGE_REASON_CODES.includes(reasonCode as AnalysisCoverageReasonCode),
  );
}

export function resolveCoverageLevel(input: {
  failedSliceCount?: number;
  reasonCodes?: Array<AnalysisCoverageReasonCode | string> | null;
  hasCompletedData?: boolean;
}): AnalysisCoverageLevel {
  const reasonCodes = dedupeCoverageReasons(input.reasonCodes);

  if ((input.failedSliceCount ?? 0) > 0 || reasonCodes.length > 0) {
    return "partial";
  }

  if (input.hasCompletedData) {
    return "full";
  }

  return "unknown";
}