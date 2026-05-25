export const ANALYSIS_COVERAGE_LEVELS = ["full", "partial", "unknown"] as const;
export const ANALYSIS_COVERAGE_REASON_CODES = [
  "missingPrices",
  "partialDecoded",
  "providerError",
  "providerThrottled",
  "reorgSuspect",
  "decodeError",
  "pricingPartial",
  "unknownError",
] as const;

export type AnalysisCoverageLevel = (typeof ANALYSIS_COVERAGE_LEVELS)[number];
export type AnalysisCoverageReasonCode = (typeof ANALYSIS_COVERAGE_REASON_CODES)[number];

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