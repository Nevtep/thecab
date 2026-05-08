type TrustedCoverageStatus = "full" | "partial";

type BuildTrustBoundaryInput = {
  discardedCount: number;
  reasonCodes: string[];
};

export type TrustBoundaryResult = {
  trustedReasonCodes: string[];
  reviewableReasonCodes: string[];
  coverageStatus: TrustedCoverageStatus;
};

function isReviewableReasonCode(reasonCode: string) {
  const normalized = reasonCode.toLowerCase();
  return normalized.includes("unsupported") || normalized.includes("discard") || normalized.includes("invalid");
}

export class DashboardTrustBoundaryService {
  build(input: BuildTrustBoundaryInput): TrustBoundaryResult {
    const trustedReasonCodes = input.reasonCodes.filter((reasonCode) => !isReviewableReasonCode(reasonCode));
    const reviewableReasonCodes = input.reasonCodes.filter((reasonCode) => isReviewableReasonCode(reasonCode));

    return {
      trustedReasonCodes,
      reviewableReasonCodes,
      coverageStatus: input.discardedCount > 0 || reviewableReasonCodes.length > 0 ? "partial" : "full"
    };
  }
}
