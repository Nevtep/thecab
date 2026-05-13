import { moralisGet } from "@/server/providers/moralis/client";

type WalletHistoryResponse = {
  result?: Array<Record<string, unknown>>;
  page?: number;
  page_size?: number;
};

export async function getWalletHistory(
  walletAddress: string,
  chainId: number,
  limit = 50,
): Promise<WalletHistoryResponse> {
  return moralisGet<WalletHistoryResponse>(`/wallets/${walletAddress}/history`, chainId, {
    order: "DESC",
    limit,
  });
}
