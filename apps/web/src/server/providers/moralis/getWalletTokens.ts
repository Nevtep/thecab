import { moralisGet } from "@/server/providers/moralis/client";

type WalletTokensResponse = {
  result?: Array<Record<string, unknown>>;
};

export async function getWalletTokens(
  walletAddress: string,
  chainId: number,
): Promise<WalletTokensResponse> {
  return moralisGet<WalletTokensResponse>(`/wallets/${walletAddress}/tokens`, chainId);
}
