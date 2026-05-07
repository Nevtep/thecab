import {
  createRateLimitedFetchFn,
  resetRpcRateLimitersForTest
} from "@/infrastructure/chain/rpc-rate-limit";

describe("rpc rate limit", () => {
  beforeEach(() => {
    resetRpcRateLimitersForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
  });

  afterEach(() => {
    resetRpcRateLimitersForTest();
    vi.useRealTimers();
  });

  it("limits requests to 20 per second for the same RPC URL", async () => {
    const startedAt: number[] = [];
    const fetchFn = vi.fn(async () => {
      startedAt.push(Date.now());
      return new Response(null, { status: 200 });
    });

    const rateLimitedFetchFn = createRateLimitedFetchFn({
      rpcUrl: "https://base-mainnet.g.alchemy.com/v2/example",
      fetchFn,
      requestsPerSecond: 20
    });

    const requests = [
      rateLimitedFetchFn("https://example.test"),
      rateLimitedFetchFn("https://example.test"),
      rateLimitedFetchFn("https://example.test")
    ];

    await vi.runAllTimersAsync();
    await Promise.all(requests);

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(startedAt).toEqual([0, 50, 100]);
  });
});