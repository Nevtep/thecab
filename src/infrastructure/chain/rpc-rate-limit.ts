const DEFAULT_RPC_REQUESTS_PER_SECOND = 20;

type FetchFn = typeof fetch;
type SleepFn = (delayMs: number) => Promise<void>;
type RateLimiterState = {
  nextAvailableAt: number;
  tail: Promise<void>;
};

declare global {
  var __theCabRpcRateLimiterStates__: Map<string, RateLimiterState> | undefined;
  var __theCabRpcRateLimitedFetchFns__: Map<string, FetchFn> | undefined;
}

function getRateLimiterStates() {
  globalThis.__theCabRpcRateLimiterStates__ ??= new Map<string, RateLimiterState>();
  return globalThis.__theCabRpcRateLimiterStates__;
}

function getRateLimitedFetchFns() {
  globalThis.__theCabRpcRateLimitedFetchFns__ ??= new Map<string, FetchFn>();
  return globalThis.__theCabRpcRateLimitedFetchFns__;
}

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function buildLimiterKey(rpcUrl: string, requestsPerSecond: number) {
  return `${requestsPerSecond}:${rpcUrl}`;
}

export function createRateLimitedFetchFn(input: {
  rpcUrl: string;
  requestsPerSecond?: number;
  fetchFn?: FetchFn;
  now?: () => number;
  sleep?: SleepFn;
}): FetchFn {
  const requestsPerSecond = input.requestsPerSecond ?? DEFAULT_RPC_REQUESTS_PER_SECOND;
  const intervalMs = Math.ceil(1_000 / requestsPerSecond);
  const fetchFn = input.fetchFn ?? fetch;
  const now = input.now ?? (() => Date.now());
  const sleep = input.sleep ?? defaultSleep;
  const limiterKey = buildLimiterKey(input.rpcUrl, requestsPerSecond);
  const states = getRateLimiterStates();
  const state = states.get(limiterKey) ?? {
    nextAvailableAt: 0,
    tail: Promise.resolve()
  };

  states.set(limiterKey, state);

  return async (request, init) => {
    const slot = state.tail.then(async () => {
      const currentTime = now();
      const scheduledAt = Math.max(currentTime, state.nextAvailableAt);
      state.nextAvailableAt = scheduledAt + intervalMs;

      const delayMs = scheduledAt - currentTime;
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    });

    state.tail = slot.catch(() => undefined);
    await slot;

    return fetchFn(request, init);
  };
}

export function getRateLimitedFetchFn(
  rpcUrl: string,
  requestsPerSecond = DEFAULT_RPC_REQUESTS_PER_SECOND
) {
  const limiterKey = buildLimiterKey(rpcUrl, requestsPerSecond);
  const fetchFns = getRateLimitedFetchFns();

  if (!fetchFns.has(limiterKey)) {
    fetchFns.set(
      limiterKey,
      createRateLimitedFetchFn({
        rpcUrl,
        requestsPerSecond
      })
    );
  }

  const fetchFn = fetchFns.get(limiterKey);
  if (!fetchFn) {
    throw new Error("Rate-limited fetch function was not initialized.");
  }

  return fetchFn;
}

export function resetRpcRateLimitersForTest() {
  globalThis.__theCabRpcRateLimiterStates__?.clear();
  globalThis.__theCabRpcRateLimitedFetchFns__?.clear();
}

export { DEFAULT_RPC_REQUESTS_PER_SECOND };