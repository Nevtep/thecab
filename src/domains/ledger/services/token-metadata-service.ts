import { erc20Abi, isAddressEqual, zeroAddress } from "viem";

import { getBasePublicClient } from "@/infrastructure/chain/clients";

export type TokenMetadata = {
  tokenAddress: string;
  symbol: string | null;
  decimals: number;
};

const tokenMetadataCache = new Map<string, Promise<TokenMetadata>>();

function fallbackSymbol(tokenAddress: string) {
  return `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
}

export class TokenMetadataService {
  async getMetadata(tokenAddress: string): Promise<TokenMetadata> {
    const normalized = tokenAddress.toLowerCase();

    if (isAddressEqual(normalized as `0x${string}`, zeroAddress)) {
      return {
        tokenAddress: normalized,
        symbol: "ETH",
        decimals: 18
      };
    }

    const cached = tokenMetadataCache.get(normalized);
    if (cached) {
      return cached;
    }

    const request = this.readMetadata(normalized);
    tokenMetadataCache.set(normalized, request);
    return request;
  }

  private async readMetadata(tokenAddress: string): Promise<TokenMetadata> {
    const client = getBasePublicClient();

    const [symbolResult, decimalsResult] = await Promise.allSettled([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol"
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals"
      })
    ]);

    return {
      tokenAddress,
      symbol:
        symbolResult.status === "fulfilled" && typeof symbolResult.value === "string"
          ? symbolResult.value
          : fallbackSymbol(tokenAddress),
      decimals:
        decimalsResult.status === "fulfilled" && typeof decimalsResult.value === "number"
          ? decimalsResult.value
          : 18
    };
  }
}