import { getAlchemyNetwork } from "@/server/chains";
import { getEnv } from "@/server/env";

const PRICES_API_BASE = "https://api.g.alchemy.com/prices/v1";
const CURRENT_PRICE_MEMORY_TTL_MS = 60 * 1000;
const HISTORICAL_PRICE_MEMORY_TTL_MS = 10 * 60 * 1000;
const ALCHEMY_HOURLY_REQUEST_LIMIT = 260;

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

type TimedCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const currentPriceResponseCache = new Map<string, TimedCacheEntry<AlchemyPriceByAddressResult>>();
const historicalPriceResponseCache = new Map<string, TimedCacheEntry<AlchemyHistoricalPriceResult>>();
const currentPriceInFlight = new Map<string, Promise<AlchemyPriceByAddressResult>>();
const historicalPriceInFlight = new Map<string, Promise<AlchemyHistoricalPriceResult>>();

let alchemyBudgetWindowStartedAt = Date.now();
let alchemyBudgetUsedInWindow = 0;

function readCachedValue<T>(cache: Map<string, TimedCacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCachedValue<T>(cache: Map<string, TimedCacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function consumeAlchemyBudget() {
  const now = Date.now();
  if (now - alchemyBudgetWindowStartedAt >= 60 * 60 * 1000) {
    alchemyBudgetWindowStartedAt = now;
    alchemyBudgetUsedInWindow = 0;
  }

  if (alchemyBudgetUsedInWindow >= ALCHEMY_HOURLY_REQUEST_LIMIT) {
    throw new Error(`ALCHEMY_RATE_GUARD_EXCEEDED:${ALCHEMY_HOURLY_REQUEST_LIMIT}:hourly`);
  }

  alchemyBudgetUsedInWindow += 1;
}

function normalizePriceAddresses(addresses: string[]) {
  return Array.from(
    new Set(
      addresses
        .map((address) => address.toLowerCase().trim())
        .filter((address) => /^0x[a-f0-9]{40}$/.test(address)),
    ),
  );
}

export async function getCurrentTokenPricesByAddress(
  chainId: number,
  addresses: string[],
): Promise<AlchemyPriceByAddressResult> {
  const normalizedAddresses = normalizePriceAddresses(addresses);
  if (normalizedAddresses.length === 0) {
    return { data: [] };
  }

  const requestKey = `${chainId}:${normalizedAddresses.join(",")}`;
  const cachedResponse = readCachedValue(currentPriceResponseCache, requestKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const inFlightResponse = currentPriceInFlight.get(requestKey);
  if (inFlightResponse) {
    return inFlightResponse;
  }

  const requestPromise = (async () => {
    consumeAlchemyBudget();

    const env = getEnv();
    const url = `${PRICES_API_BASE}/${env.ALCHEMY_API_KEY}/tokens/by-address`;
    const tokens: TokenAddressInput[] = normalizedAddresses.map((address) => ({
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

    const parsed = (await response.json()) as AlchemyPriceByAddressResult;
    writeCachedValue(currentPriceResponseCache, requestKey, parsed, CURRENT_PRICE_MEMORY_TTL_MS);

    return parsed;
  })();

  currentPriceInFlight.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    currentPriceInFlight.delete(requestKey);
  }
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
  const normalizedAddress = input.address.toLowerCase();
  const requestKey = `${chainId}:${normalizedAddress}:${input.startTime}:${input.endTime}:${input.interval}`;
  const cachedResponse = readCachedValue(historicalPriceResponseCache, requestKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const inFlightResponse = historicalPriceInFlight.get(requestKey);
  if (inFlightResponse) {
    return inFlightResponse;
  }

  const requestPromise = (async () => {
    consumeAlchemyBudget();

    const env = getEnv();
    const url = `${PRICES_API_BASE}/${env.ALCHEMY_API_KEY}/tokens/historical`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        network: getAlchemyNetwork(chainId),
        address: normalizedAddress,
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

    const parsed = (await response.json()) as AlchemyHistoricalPriceResult;
    writeCachedValue(historicalPriceResponseCache, requestKey, parsed, HISTORICAL_PRICE_MEMORY_TTL_MS);

    return parsed;
  })();

  historicalPriceInFlight.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    historicalPriceInFlight.delete(requestKey);
  }
}
