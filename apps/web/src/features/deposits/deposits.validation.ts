import type { DepositsScreenState } from "@/features/deposits/Deposits.component";

export function deriveDepositsScreenState(input: {
  isWalletReady: boolean;
  analysisStatus: string | null | undefined;
  analysisStatusIsLoading: boolean;
  depositsIsLoading: boolean;
  depositsErrorCode: string | null;
  totalCount: number | null;
}) {
  if (!input.isWalletReady || input.analysisStatusIsLoading || input.depositsIsLoading) {
    return "loading" satisfies DepositsScreenState;
  }

  if (input.analysisStatus && input.analysisStatus !== "ready" && input.analysisStatus !== "stale") {
    return "locked" satisfies DepositsScreenState;
  }

  if (input.depositsErrorCode) {
    return input.depositsErrorCode === "analysis_required"
      ? ("locked" satisfies DepositsScreenState)
      : ("error" satisfies DepositsScreenState);
  }

  if (input.totalCount === null || input.totalCount === 0) {
    return "empty" satisfies DepositsScreenState;
  }

  return "ready" satisfies DepositsScreenState;
}