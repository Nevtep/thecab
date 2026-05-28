import type {
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
