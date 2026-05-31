import { getEnv } from "@/server/env";
import { assertSupportedChain } from "@/server/chains";

export type ExplorerProvider = "basescan";

export type ExplorerClientConfig = {
  chainId: number;
  apiKey?: string | null;
  fetcher?: typeof fetch;
};

export type ExplorerEvidence = {
  chainId: number;
  txHash: string;
  provider: ExplorerProvider;
  receipt: Record<string, unknown> | null;
  logs: Array<Record<string, unknown>>;
  internalTransfers: Array<Record<string, unknown>>;
  sourceRefs: Array<{
    provider: ExplorerProvider;
    endpoint: string;
    status: "complete" | "missing_credentials" | "rate_limited" | "malformed" | "failed";
  }>;
  evidenceGapReasonCodes: string[];
};

export class ExplorerClientError extends Error {
  constructor(
    message: string,
    readonly code: "missing_credentials" | "rate_limited" | "malformed_response" | "chain_mismatch" | "request_failed",
  ) {
    super(message);
  }
}

function normalizeTxHash(txHash: string) {
  const normalized = txHash.toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
    throw new ExplorerClientError("Invalid transaction hash", "malformed_response");
  }
  return normalized;
}

function getExplorerApiBaseUrl(chainId: number) {
  const chain = assertSupportedChain(chainId);
  if (chain.key !== "base") {
    throw new ExplorerClientError(`Unsupported explorer chain: ${chainId}`, "chain_mismatch");
  }
  return "https://api.basescan.org/api";
}

export function getExplorerApiKey(chainId: number, explicitApiKey?: string | null) {
  if (explicitApiKey !== undefined) return explicitApiKey;
  assertSupportedChain(chainId);
  const env = getEnv();
  return env.BASESCAN_API_KEY ?? env.ETHERSCAN_API_KEY ?? null;
}

function buildExplorerUrl(input: {
  chainId: number;
  apiKey: string;
  params: Record<string, string>;
}) {
  const url = new URL(getExplorerApiBaseUrl(input.chainId));
  for (const [key, value] of Object.entries(input.params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", input.apiKey);
  return url;
}

async function fetchExplorerJson(input: {
  chainId: number;
  apiKey: string;
  fetcher: typeof fetch;
  params: Record<string, string>;
}) {
  const response = await input.fetcher(buildExplorerUrl(input));
  if (!response.ok) {
    throw new ExplorerClientError(`Explorer request failed: ${response.status}`, "request_failed");
  }

  const json = await response.json() as Record<string, unknown>;
  if (json.status === "0" && typeof json.message === "string" && /rate limit/i.test(json.message)) {
    throw new ExplorerClientError("Explorer rate limit", "rate_limited");
  }
  return json;
}

function extractResult(json: Record<string, unknown>) {
  return json.result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

export async function fetchExplorerTransactionReceipt(input: ExplorerClientConfig & { txHash: string }) {
  const apiKey = getExplorerApiKey(input.chainId, input.apiKey);
  if (!apiKey) throw new ExplorerClientError("Missing explorer API key", "missing_credentials");
  const txHash = normalizeTxHash(input.txHash);
  const json = await fetchExplorerJson({
    chainId: input.chainId,
    apiKey,
    fetcher: input.fetcher ?? fetch,
    params: {
      module: "proxy",
      action: "eth_getTransactionReceipt",
      txhash: txHash,
    },
  });
  const receipt = asRecord(extractResult(json));
  if (!receipt) throw new ExplorerClientError("Malformed transaction receipt", "malformed_response");
  return receipt;
}

export async function fetchExplorerInternalTransfers(input: ExplorerClientConfig & { txHash: string }) {
  const apiKey = getExplorerApiKey(input.chainId, input.apiKey);
  if (!apiKey) throw new ExplorerClientError("Missing explorer API key", "missing_credentials");
  const txHash = normalizeTxHash(input.txHash);
  const json = await fetchExplorerJson({
    chainId: input.chainId,
    apiKey,
    fetcher: input.fetcher ?? fetch,
    params: {
      module: "account",
      action: "txlistinternal",
      txhash: txHash,
    },
  });
  return asRecordArray(extractResult(json));
}

export async function fetchExplorerContractSource(input: ExplorerClientConfig & { address: string }) {
  const apiKey = getExplorerApiKey(input.chainId, input.apiKey);
  if (!apiKey) throw new ExplorerClientError("Missing explorer API key", "missing_credentials");
  const json = await fetchExplorerJson({
    chainId: input.chainId,
    apiKey,
    fetcher: input.fetcher ?? fetch,
    params: {
      module: "contract",
      action: "getsourcecode",
      address: input.address.toLowerCase(),
    },
  });
  return asRecordArray(extractResult(json));
}

export async function fetchExplorerTransactionEvidence(input: ExplorerClientConfig & { txHash: string }): Promise<ExplorerEvidence> {
  const txHash = normalizeTxHash(input.txHash);
  const base = {
    chainId: input.chainId,
    txHash,
    provider: "basescan" as const,
  };
  const apiKey = getExplorerApiKey(input.chainId, input.apiKey);
  if (!apiKey) {
    return {
      ...base,
      receipt: null,
      logs: [],
      internalTransfers: [],
      sourceRefs: [
        { provider: "basescan", endpoint: "transactionEvidence", status: "missing_credentials" },
      ],
      evidenceGapReasonCodes: ["missingExplorerCredentials"],
    };
  }

  const sourceRefs: ExplorerEvidence["sourceRefs"] = [];
  const evidenceGapReasonCodes: string[] = [];
  let receipt: Record<string, unknown> | null = null;
  let internalTransfers: Array<Record<string, unknown>> = [];

  try {
    receipt = await fetchExplorerTransactionReceipt({ ...input, txHash, apiKey });
    sourceRefs.push({ provider: "basescan", endpoint: "eth_getTransactionReceipt", status: "complete" });
  } catch (error) {
    const status = error instanceof ExplorerClientError && error.code === "rate_limited" ? "rate_limited" : "failed";
    sourceRefs.push({ provider: "basescan", endpoint: "eth_getTransactionReceipt", status });
    evidenceGapReasonCodes.push(status === "rate_limited" ? "explorerRateLimited" : "missingExplorerReceipt");
  }

  try {
    internalTransfers = await fetchExplorerInternalTransfers({ ...input, txHash, apiKey });
    sourceRefs.push({ provider: "basescan", endpoint: "txlistinternal", status: "complete" });
  } catch (error) {
    const status = error instanceof ExplorerClientError && error.code === "rate_limited" ? "rate_limited" : "failed";
    sourceRefs.push({ provider: "basescan", endpoint: "txlistinternal", status });
    evidenceGapReasonCodes.push(status === "rate_limited" ? "explorerRateLimited" : "missingExplorerInternalTransfers");
  }

  return {
    ...base,
    receipt,
    logs: asRecordArray(receipt?.logs),
    internalTransfers,
    sourceRefs,
    evidenceGapReasonCodes: [...new Set(evidenceGapReasonCodes)],
  };
}
