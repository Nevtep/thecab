type AnalyzeWalletMode = "full_history" | "incremental";

export type AnalyzeWalletPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
  mode: AnalyzeWalletMode;
};

export async function runAnalyzeWalletTask(payload: AnalyzeWalletPayload) {
  void payload;

  throw new Error("ANALYSIS_IN_PROCESS_TASK_DISABLED:use_trigger_runtime");
}
