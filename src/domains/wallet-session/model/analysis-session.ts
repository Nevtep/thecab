export type WalletAnalysisSessionStatus = "active" | "archived" | "failed";

export type WalletAnalysisSession = {
  analysisSessionId: string;
  walletAddress: string;
  chainId: number;
  connectionSource: string;
  createdAt: Date;
  lastRequestedAt: Date;
  latestAcceptedRunId: string | null;
  status: WalletAnalysisSessionStatus;
};

export function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase();
}