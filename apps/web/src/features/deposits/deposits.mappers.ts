import type {
  DepositConfidence,
  DepositCoverageStatus,
  DepositSummaryView,
  DepositsListResponse,
} from "@/features/deposits/deposits.types";

export type DepositSummaryRowViewModel = DepositSummaryView & {
  totalReturnSign: "positive" | "negative" | "neutral";
};

export type DepositsListViewModel = {
  analysisStatus: DepositsListResponse["analysisStatus"];
  summary: DepositsListResponse["summary"];
  coveredRange: DepositsListResponse["coveredRange"];
  page: DepositsListResponse["page"];
  items: DepositSummaryRowViewModel[];
};

export function getDepositCoverageLabelKey(coverageStatus: DepositCoverageStatus) {
  return `coverage:level.${coverageStatus}`;
}

export function getDepositConfidenceLabelKey(confidence: DepositConfidence) {
  return `coverage:confidence.${confidence}`;
}

export function getDepositCoverageReasonLabelKey(reasonCode: string) {
  return `coverage:reasons.${reasonCode}`;
}

export function getDepositUnattributedReasonLabelKey(reasonCode: string) {
  return `deposits:unattributed.reasonCodes.${reasonCode}`;
}

export function mapDepositUnattributedReasonLabels(input: {
  reasonCodes: string[];
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return input.reasonCodes.map((reasonCode) => input.translate(
    getDepositUnattributedReasonLabelKey(reasonCode),
    {
      defaultValue: input.translate(getDepositCoverageReasonLabelKey(reasonCode), {
        defaultValue: reasonCode,
      }),
    },
  ));
}

function resolveSign(value: number): DepositSummaryRowViewModel["totalReturnSign"] {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export function mapDepositsListResponseToViewModel(
  response: DepositsListResponse,
): DepositsListViewModel {
  return {
    analysisStatus: response.analysisStatus,
    summary: response.summary,
    coveredRange: response.coveredRange,
    page: response.page,
    items: response.items.map((item) => ({
      ...item,
      totalReturnSign: resolveSign(item.totalReturnUsd),
    })),
  };
}
