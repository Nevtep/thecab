import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Token = {
  symbol: string;
  address: string;
};

const chainId = 8453;
const moralisChain = "base";
const alchemyNetwork = "base-mainnet";
const sampleBlock = "36079024";
const sampleTimestamp = "2025-09-27T04:29:55Z";
const sampleEndTimestamp = "2025-09-27T05:29:55Z";

const tokens: Token[] = [
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
  { symbol: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" },
  { symbol: "AERO", address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631" },
  { symbol: "cbBTC", address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" },
];

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function extractAlchemyPrice(json: unknown) {
  const data = json && typeof json === "object" && "data" in json ? (json as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return null;
  const first = data[0];
  if (!first || typeof first !== "object") return null;
  const point = first as { value?: unknown; timestamp?: unknown };
  return {
    value: typeof point.value === "string" ? point.value : null,
    timestamp: typeof point.timestamp === "string" ? point.timestamp : null,
  };
}

function extractMoralisPrice(json: unknown) {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const rawUsd =
    typeof record.usdPrice === "number"
      ? String(record.usdPrice)
      : typeof record.usdPriceFormatted === "string"
        ? record.usdPriceFormatted
        : null;
  return {
    value: rawUsd,
    exchange: typeof record.exchangeName === "string" ? record.exchangeName : null,
    pairAddress: typeof record.pairAddress === "string" ? record.pairAddress : null,
    block: typeof record.blockNumber === "string" ? record.blockNumber : null,
    priceLastChangedAtBlock:
      typeof record.priceLastChangedAtBlock === "string" ? record.priceLastChangedAtBlock : null,
  };
}

async function fetchJson(input: {
  provider: string;
  url: string;
  init?: RequestInit;
}) {
  const startedAt = Date.now();
  const response = await fetch(input.url, input.init);
  const elapsedMs = Date.now() - startedAt;
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 240) };
  }

  return {
    provider: input.provider,
    ok: response.ok,
    status: response.status,
    elapsedMs,
    json,
  };
}

async function main() {
  loadEnvFile();
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  const moralisApiKey = process.env.MORALIS_API_KEY;
  if (!alchemyApiKey || !moralisApiKey) {
    throw new Error("Missing ALCHEMY_API_KEY or MORALIS_API_KEY");
  }

  const results = [];
  for (const token of tokens) {
    const alchemyHistorical = await fetchJson({
      provider: "alchemy_historical",
      url: `https://api.g.alchemy.com/prices/v1/${alchemyApiKey}/tokens/historical`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network: alchemyNetwork,
          address: token.address,
          startTime: sampleTimestamp,
          endTime: sampleEndTimestamp,
          interval: "1h",
        }),
      },
    });

    const moralisHistorical = await fetchJson({
      provider: "moralis_historical_to_block",
      url: `https://deep-index.moralis.io/api/v2.2/erc20/${token.address}/price?chain=${moralisChain}&to_block=${sampleBlock}`,
      init: {
        method: "GET",
        headers: { accept: "application/json", "X-API-Key": moralisApiKey },
      },
    });

    const alchemyCurrent = await fetchJson({
      provider: "alchemy_current",
      url: `https://api.g.alchemy.com/prices/v1/${alchemyApiKey}/tokens/by-address`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addresses: [{ network: alchemyNetwork, address: token.address }],
        }),
      },
    });

    const moralisCurrent = await fetchJson({
      provider: "moralis_current",
      url: `https://deep-index.moralis.io/api/v2.2/erc20/${token.address}/price?chain=${moralisChain}`,
      init: {
        method: "GET",
        headers: { accept: "application/json", "X-API-Key": moralisApiKey },
      },
    });

    results.push({
      token: token.symbol,
      address: token.address,
      sample: {
        chainId,
        block: sampleBlock,
        timestamp: sampleTimestamp,
      },
      alchemyHistorical: {
        ok: alchemyHistorical.ok,
        status: alchemyHistorical.status,
        elapsedMs: alchemyHistorical.elapsedMs,
        parsed: extractAlchemyPrice(alchemyHistorical.json),
      },
      moralisHistorical: {
        ok: moralisHistorical.ok,
        status: moralisHistorical.status,
        elapsedMs: moralisHistorical.elapsedMs,
        parsed: extractMoralisPrice(moralisHistorical.json),
      },
      alchemyCurrent: {
        ok: alchemyCurrent.ok,
        status: alchemyCurrent.status,
        elapsedMs: alchemyCurrent.elapsedMs,
        parsed: (() => {
          const json = alchemyCurrent.json as { data?: Array<{ prices?: Array<{ value?: string; lastUpdatedAt?: string }> }> };
          const price = json.data?.[0]?.prices?.[0];
          return price ? { value: price.value ?? null, timestamp: price.lastUpdatedAt ?? null } : null;
        })(),
      },
      moralisCurrent: {
        ok: moralisCurrent.ok,
        status: moralisCurrent.status,
        elapsedMs: moralisCurrent.elapsedMs,
        parsed: extractMoralisPrice(moralisCurrent.json),
      },
    });
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
