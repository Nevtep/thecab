import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import { getCurrentTokenPricesByAddress } from "@/server/providers/alchemy";
import { getWalletHistory, getWalletTokens } from "@/server/providers/moralis";

type AnalyzeWalletMode = "full_history" | "incremental";

export type AnalyzeWalletPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
  mode: AnalyzeWalletMode;
};

export async function runAnalyzeWalletTask(payload: AnalyzeWalletPayload) {
  await updateAnalysisRunProgress(payload.runId, {
    status: "running",
    stage: "fetching_provider_data",
    progressPct: 20,
  });

  const [history, tokens] = await Promise.all([
    getWalletHistory(payload.walletAddress, payload.chainId, 10),
    getWalletTokens(payload.walletAddress, payload.chainId),
  ]);

  const tokenAddresses = (tokens.result ?? [])
    .map((item) => {
      const address = item.token_address;
      return typeof address === "string" ? address : null;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 20);

  if (tokenAddresses.length > 0) {
    await getCurrentTokenPricesByAddress(payload.chainId, tokenAddresses);
  }

  await updateAnalysisRunProgress(payload.runId, {
    status: "ready",
    stage: "completed",
    progressPct: 100,
  });

  return {
    runId: payload.runId,
    historyCount: history.result?.length ?? 0,
    tokenCount: tokens.result?.length ?? 0,
  };
}
