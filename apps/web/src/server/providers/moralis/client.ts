import { getMoralisChain } from "@/server/chains";
import { getEnv } from "@/server/env";

const BASE_URL = "https://deep-index.moralis.io/api/v2.2";

type MoralisQuery = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query: MoralisQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }

  const search = params.toString();
  return `${BASE_URL}${path}${search ? `?${search}` : ""}`;
}

export async function moralisGet<T>(
  path: string,
  chainId: number,
  query: MoralisQuery = {},
): Promise<T> {
  const env = getEnv();
  const url = buildUrl(path, {
    ...query,
    chain: getMoralisChain(chainId),
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": env.MORALIS_API_KEY,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MORALIS_REQUEST_FAILED:${response.status}:${body}`);
  }

  return (await response.json()) as T;
}
