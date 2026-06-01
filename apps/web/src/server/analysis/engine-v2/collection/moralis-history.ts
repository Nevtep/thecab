import { createHash } from "node:crypto";

import { moralisGet } from "@/server/providers/moralis/client";

import { decodedTransactionsFromPagePayload } from "./history-normalizer";

export const MORALIS_DECODED_HISTORY_ENDPOINT_KIND = "address-transactions-decoded";
export const MORALIS_DECODED_HISTORY_LIMIT = 100;

export type MoralisDecodedHistoryRequest = {
  chainId: number;
  walletAddress: string;
  cursor?: string | null;
  limit?: number;
  fromBlock?: string | null;
};

export type MoralisDecodedHistoryPage = {
  cursor?: string | null;
  result?: unknown[];
  page?: number;
  page_size?: number;
};

export function buildMoralisDecodedHistoryPath(walletAddress: string) {
  return `/${walletAddress}/verbose`;
}

export function buildMoralisDecodedHistoryQuery(input: MoralisDecodedHistoryRequest) {
  return {
    order: "ASC",
    include: "internal_transactions",
    limit: input.limit ?? MORALIS_DECODED_HISTORY_LIMIT,
    cursor: input.cursor ?? undefined,
    from_block: input.fromBlock ?? undefined,
  };
}

export function hashMoralisDecodedHistoryRequest(input: MoralisDecodedHistoryRequest) {
  return createHash("sha256")
    .update(JSON.stringify({
      endpoint: MORALIS_DECODED_HISTORY_ENDPOINT_KIND,
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      cursor: input.cursor ?? null,
      limit: input.limit ?? MORALIS_DECODED_HISTORY_LIMIT,
      fromBlock: input.fromBlock ?? null,
      order: "ASC",
      include: "internal_transactions",
    }))
    .digest("hex");
}

export function parseMoralisDecodedHistoryPage(payload: unknown) {
  const transactions = decodedTransactionsFromPagePayload(payload);
  const cursor = payload && typeof payload === "object" && "cursor" in payload
    ? (payload as MoralisDecodedHistoryPage).cursor ?? null
    : null;

  return {
    cursor,
    transactions,
    providerRowCount: transactions.length,
  };
}

export async function fetchMoralisDecodedHistoryPage(input: MoralisDecodedHistoryRequest) {
  return moralisGet<MoralisDecodedHistoryPage>(
    buildMoralisDecodedHistoryPath(input.walletAddress),
    input.chainId,
    buildMoralisDecodedHistoryQuery(input),
  );
}
