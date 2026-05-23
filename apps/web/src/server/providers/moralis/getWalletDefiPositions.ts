import { moralisGet } from "@/server/providers/moralis/client";

export type WalletDefiPositionsResponse = Array<Record<string, unknown>>;

export async function getWalletDefiPositions(
  walletAddress: string,
  chainId: number,
): Promise<WalletDefiPositionsResponse> {
  return moralisGet<WalletDefiPositionsResponse>(`/wallets/${walletAddress}/defi/positions`, chainId);
}