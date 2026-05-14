import { getAlchemyNetwork } from "@/server/chains";
import { getEnv } from "@/server/env";

const PRICES_API_BASE = "https://api.g.alchemy.com/prices/v1";

type TokenAddressInput = {
  network: string;
  address: string;
};

type AlchemyPriceByAddressResult = {
  data?: Array<{
    address: string;
    prices?: Array<{ value: string; currency: string; lastUpdatedAt: string }>;
  }>;
};

type AlchemyHistoricalPricePoint = {
  value: string;
  timestamp: string;
};

export type AlchemyHistoricalPriceResult = {
  network: string;
  address: string;
  currency: string;
  data?: AlchemyHistoricalPricePoint[];
};

export async function getCurrentTokenPricesByAddress(
  chainId: number,
  addresses: string[],
): Promise<AlchemyPriceByAddressResult> {
  const env = getEnv();
  const url = `${PRICES_API_BASE}/${env.ALCHEMY_API_KEY}/tokens/by-address`;

  const tokens: TokenAddressInput[] = addresses.map((address) => ({
    network: getAlchemyNetwork(chainId),
    address,
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ addresses: tokens }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ALCHEMY_PRICES_FAILED:${response.status}:${body}`);
  }

  return (await response.json()) as AlchemyPriceByAddressResult;
}

export async function getHistoricalTokenPricesByAddress(
  chainId: number,
  input: {
    address: string;
    startTime: string;
    endTime: string;
    interval: "1h" | "1d";
  },
): Promise<AlchemyHistoricalPriceResult> {
  const env = getEnv();
  const url = `${PRICES_API_BASE}/${env.ALCHEMY_API_KEY}/tokens/historical`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      network: getAlchemyNetwork(chainId),
      address: input.address,
      startTime: input.startTime,
      endTime: input.endTime,
      interval: input.interval,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ALCHEMY_HISTORICAL_PRICES_FAILED:${response.status}:${body}`);
  }

  return (await response.json()) as AlchemyHistoricalPriceResult;
}
