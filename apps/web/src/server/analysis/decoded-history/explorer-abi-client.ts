import type { ContractSeed, ExplorerContractSource } from "./abi-registry";
import { buildContractAbiRecord } from "./abi-registry";
import type { ContractAbiRecord } from "./types";

export type FetchVerifiedContractAbiInput = {
  chainId: number;
  seed: ContractSeed;
  apiKey: string;
  fetcher?: typeof fetch;
};

export function buildEtherscanV2ContractSourceUrl(input: {
  chainId: number;
  address: string;
  apiKey?: string;
}) {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(input.chainId));
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getsourcecode");
  url.searchParams.set("address", input.address);
  if (input.apiKey) url.searchParams.set("apikey", input.apiKey);
  return url;
}

export async function fetchVerifiedContractAbi(input: FetchVerifiedContractAbiInput): Promise<ContractAbiRecord> {
  const fetcher = input.fetcher ?? fetch;
  const url = buildEtherscanV2ContractSourceUrl({
    chainId: input.chainId,
    address: input.seed.address,
    apiKey: input.apiKey,
  });
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Explorer ABI request failed: HTTP ${response.status}`);
  }
  const payload = await response.json() as {
    status?: string;
    message?: string;
    result?: unknown;
  };
  if (payload.status !== "1" || !Array.isArray(payload.result) || payload.result.length === 0) {
    const result = typeof payload.result === "string" ? payload.result : JSON.stringify(payload.result);
    throw new Error(`Explorer ABI request failed: ${payload.message ?? "unknown"} ${result}`);
  }

  return buildContractAbiRecord({
    chainId: input.chainId,
    seed: input.seed,
    source: payload.result[0] as ExplorerContractSource,
    apiUrl: buildEtherscanV2ContractSourceUrl({
      chainId: input.chainId,
      address: input.seed.address,
    }).toString(),
  });
}
