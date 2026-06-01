import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { shouldRetryProviderError, withProviderRetry } from "@/server/providers/providerErrors";
import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { createProviderQueueOptions, getTriggerQueueConcurrency } from "@/server/trigger/queues";

function loadLocalEnvFile() {
  const envFilePath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envFilePath)) {
    return;
  }

  for (const line of readFileSync(envFilePath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function measureRetrySuccess() {
  let attempts = 0;
  const startedAt = performance.now();
  const result = await withProviderRetry({
    provider: "moralis",
    endpoint: "wallet-history",
    run: async (attempt) => {
      attempts = attempt;
      if (attempt < 3) {
        throw new Error("MORALIS_REQUEST_FAILED:429:rate_limited");
      }

      return { ok: true };
    },
  });

  return {
    attempts,
    elapsedMs: Math.round(performance.now() - startedAt),
    result,
  };
}

async function measureRetryExhaustion() {
  let attempts = 0;
  const startedAt = performance.now();

  try {
    await withProviderRetry({
      provider: "alchemy-rpc",
      endpoint: "eth_getLogs",
      run: async (attempt) => {
        attempts = attempt;
        throw new Error("ALCHEMY_RPC_FAILED:-32005:server overloaded");
      },
    });
  } catch (error) {
    return {
      attempts,
      elapsedMs: Math.round(performance.now() - startedAt),
      finalError: error instanceof Error ? error.message : String(error),
    };
  }

  throw new Error("RETRY_EXHAUSTION_EXPECTED_TO_FAIL");
}

async function main() {
  loadLocalEnvFile();

  const queueConcurrency = getTriggerQueueConcurrency();
  const queueOptions = createProviderQueueOptions(SUPPORTED_CHAIN_ID);
  const retryableMatrix = {
    http429: shouldRetryProviderError(new Error("MORALIS_REQUEST_FAILED:429:rate_limited")),
    http500: shouldRetryProviderError(new Error("ALCHEMY_PRICES_FAILED:500:server_error")),
    rpcOverloaded: shouldRetryProviderError(new Error("ALCHEMY_RPC_FAILED:-32005:server overloaded")),
    rateGuard: shouldRetryProviderError(new Error("RATE_GUARD_EXCEEDED")),
    badRequest: shouldRetryProviderError(new Error("MORALIS_REQUEST_FAILED:400:bad_request")),
  };

  const retrySuccess = await measureRetrySuccess();
  const retryExhaustion = await measureRetryExhaustion();
  const result = {
    ok:
      Object.values(queueConcurrency).every((limit) => Number.isFinite(limit) && limit > 0) &&
      Object.values(queueOptions).every((option) => option.concurrencyKey === String(SUPPORTED_CHAIN_ID)) &&
      retryableMatrix.http429 &&
      retryableMatrix.http500 &&
      retryableMatrix.rpcOverloaded &&
      !retryableMatrix.rateGuard &&
      !retryableMatrix.badRequest &&
      retrySuccess.attempts === 3 &&
      retryExhaustion.attempts === 5,
    queueConcurrency,
    queueOptions,
    retryableMatrix,
    retrySuccess,
    retryExhaustion,
    engineV2: {
      requestTimeDbOnlyFlag: true,
      enrichmentNeedsAreAnalysisTimeOnly: true,
      providerBoundary: "collection/enrichment workers only",
    },
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
