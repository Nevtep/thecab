import { moralisGet } from "@/server/providers/moralis/client";

type WalletHistoryResponse = {
  result?: Array<Record<string, unknown>>;
  page?: number;
  page_size?: number;
};

type WalletHistoryOptions = {
  limit?: number;
  cursor?: string;
  fromDate?: string;
  toDate?: string;
};

export async function getWalletHistory(
  walletAddress: string,
  chainId: number,
  input: number | WalletHistoryOptions = 50,
): Promise<WalletHistoryResponse> {
  const options = typeof input === "number"
    ? { limit: input }
    : input;

  return moralisGet<WalletHistoryResponse>(`/wallets/${walletAddress}/history`, chainId, {
    order: "DESC",
    limit: options.limit ?? 50,
    cursor: options.cursor,
    from_date: options.fromDate,
    to_date: options.toDate,
  });
}
