import { BasescanWalletActivityProvider } from "@/domains/ledger/services/basescan-wallet-activity-provider";

vi.mock("@/infrastructure/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    priceCacheMiss: vi.fn(),
    pricingCoveragePartial: vi.fn()
  }
}));

describe("basescan wallet activity provider", () => {
  beforeEach(() => {
    process.env.BASESCAN_API_KEY = "test-key";
    process.env.BASESCAN_PAGE_SIZE = "2";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects and orders wallet activity across account endpoints", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      const url = new URL(input);
      const action = url.searchParams.get("action");
      const page = url.searchParams.get("page");

      const result = (() => {
        if (action === "txlist" && page === "1") {
          return [{ hash: "0xbbb", blockNumber: "11", transactionIndex: "3", timeStamp: "1713571200" }];
        }

        if (action === "txlistinternal" && page === "1") {
          return [{ hash: "0xaaa", blockNumber: "10", transactionIndex: "4", timeStamp: "1713571100" }];
        }

        if (action === "tokentx" && page === "1") {
          return [
            { hash: "0xbbb", blockNumber: "11", transactionIndex: "2", timeStamp: "1713571200" },
            { hash: "0xccc", blockNumber: "12", transactionIndex: "0", timeStamp: "1713571300" }
          ];
        }

        if (action === "tokennfttx" && page === "1") {
          return [{ hash: "0xddd", blockNumber: "12", transactionIndex: "1", timeStamp: "1713571301" }];
        }

        return "No transactions found";
      })();

      return {
        ok: true,
        json: async () => ({ status: "1", message: "OK", result })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BasescanWalletActivityProvider();
    const result = await provider.discover({
      walletAddress: "0xabc",
      fromBlock: 0n,
      toBlock: 100n
    });

    expect(result.activities.map((activity) => activity.txHash)).toEqual(["0xaaa", "0xbbb", "0xccc", "0xddd"]);
    expect(result.activities.find((activity) => activity.txHash === "0xbbb")?.transactionIndex).toBe(2);
    expect(result.providerCursor).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("chainid=8453"));
  });
});