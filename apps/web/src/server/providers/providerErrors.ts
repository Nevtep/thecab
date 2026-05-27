import type { AnalysisCoverageReasonCode } from "@/server/analysis/coverage";

const ANALYSIS_PROVIDER_FAILURE_PREFIX = "ANALYSIS_PROVIDER_FETCH_FAILED:";
const MAX_PROVIDER_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;
const RETRIABLE_RPC_CODES = new Set([-32000, -32005, -32603]);

function normalizeMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function jitterDelay(delayMs: number) {
  const jitterRange = delayMs * 0.2;
  return Math.max(0, Math.round(delayMs + (Math.random() * jitterRange * 2 - jitterRange)));
}

function waitForDuration(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function shouldRetryProviderError(error: unknown) {
  const message = normalizeMessage(error);

  if (message.includes("RATE_GUARD_EXCEEDED")) {
    return false;
  }

  if (
    message.includes(":429:") ||
    message.includes(":500:") ||
    message.includes(":502:") ||
    message.includes(":503:") ||
    message.includes(":504:") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("fetch failed") ||
    message.includes("aborted")
  ) {
    return true;
  }

  const rpcMatch = message.match(/^ALCHEMY_RPC_FAILED:(-?\d+):/);
  if (!rpcMatch) {
    return false;
  }

  const code = Number(rpcMatch[1]);
  return RETRIABLE_RPC_CODES.has(code);
}

export async function withProviderRetry<T>(input: {
  provider: string;
  endpoint: string;
  run: (attempt: number) => Promise<T>;
}) {
  let attempt = 1;

  while (true) {
    try {
      return await input.run(attempt);
    } catch (error) {
      if (attempt >= MAX_PROVIDER_ATTEMPTS || !shouldRetryProviderError(error)) {
        throw error;
      }

      const delayMs = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      await waitForDuration(jitterDelay(delayMs));
      attempt += 1;
    }
  }
}

export function getProviderCoverageReason(error: unknown): AnalysisCoverageReasonCode {
  const message = normalizeMessage(error);

  if (
    message.includes(":429:") ||
    message.includes("RATE_GUARD_EXCEEDED") ||
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("throttl")
  ) {
    return "providerThrottled";
  }

  if (message.toLowerCase().includes("decode")) {
    return "decodeError";
  }

  if (message.toLowerCase().includes("reorg")) {
    return "reorgSuspect";
  }

  if (message.startsWith("MORALIS_REQUEST_FAILED") || message.startsWith("ALCHEMY_")) {
    return "providerError";
  }

  return "unknownError";
}

export function buildAnalysisProviderFailureError(
  reasons: Array<AnalysisCoverageReasonCode | string>,
) {
  const normalizedReasons = Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean)));
  return new Error(`${ANALYSIS_PROVIDER_FAILURE_PREFIX}${normalizedReasons.join(",")}`);
}

export function readCoverageReasonsFromError(error: unknown): AnalysisCoverageReasonCode[] {
  const message = normalizeMessage(error);

  if (!message.startsWith(ANALYSIS_PROVIDER_FAILURE_PREFIX)) {
    return [getProviderCoverageReason(error)];
  }

  const normalizedReasons = message
    .slice(ANALYSIS_PROVIDER_FAILURE_PREFIX.length)
    .split(",")
    .map((reason) => reason.trim())
    .filter(Boolean)
    .filter((reason): reason is AnalysisCoverageReasonCode =>
      reason === "historyPaginationExceeded" ||
      reason === "providerError" ||
      reason === "providerThrottled" ||
      reason === "missingPrices" ||
      reason === "pricingPartial" ||
      reason === "partialDecoded" ||
      reason === "decodeError" ||
      reason === "reorgSuspect" ||
      reason === "unknownError",
    );

  return normalizedReasons.length > 0 ? Array.from(new Set(normalizedReasons)) : ["unknownError"];
}